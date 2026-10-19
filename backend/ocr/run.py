"""Fargate task entry point: PDF in S3 -> OMR (homr / Audiveris) -> MusicXML in S3.

Environment (set by the Step Functions task overrides):
  BUCKET                 S3 bucket (required)
  INPUT_KEY              key of the uploaded PDF (required)
  OUTPUT_PREFIX          key prefix ending in '/' for the output (required)
  OMR_MAX_HEAP_MB        JVM -Xmx, default 5120 (for the 8 GB task)
  OMR_TIMEOUT_SECONDS    total budget for all OMR attempts, default 780

Two engines, tried in turn within that budget. Scans (every page one raster image)
go to homr first: on old or blurred scans Audiveris loses clefs, time signatures
and whole voices. Vector PDFs go to Audiveris first. If the first reading is poor
(few measures whose rhythm adds up, or many notes outside the key: fingerings and
letters read as notes keep the rhythm intact, see quality.py) and time remains, the
other engine runs too and the better reading wins; a tie keeps the first. Audiveris
gets scans straightened first (deskew.py); homr straightens them itself.

Pages without music (covers, blanks) are dropped by both engines.

Writes OUTPUT_PREFIX + "omr-01.mxl" (and omr-02.mxl, ... one per movement/page) and "omr-meta.json"
({engine, scan, suspect, measures, consistent, out_of_key}) describing the reading.
Exit codes: 0 ok, 2 no engine produced MusicXML / timed out (-> omr_failed),
3 bad configuration, 4 S3 error. Never leaves 0 on failure.
"""

import glob
import json
import os
import subprocess
import sys
import tempfile
import time

from deskew import deskew_pdf, is_scan
from homr_engine import run_homr
from quality import measure_quality, out_of_key_ratio

EXIT_OMR = 2
EXIT_CONFIG = 3
EXIT_S3 = 4

ACCEPT_RATIO = 0.7  # share of measures with consistent rhythm that needs no second opinion
MAX_OUT_OF_KEY = 0.12  # more notes than this outside the key and the reading is doubtful (see quality.py)
MIN_SCORE_GAIN = 0.02  # a second opinion has to beat the first by this much to replace it
MIN_COVERAGE = 0.6  # ... and read at least this share of its notes (not one page of five)
MIN_FALLBACK_SECONDS = 120  # not worth starting the second engine with less than this left


def log(message):
    print(message, flush=True)


def run_audiveris(pdf_path, out_dir, heap_mb, timeout):
    env = dict(os.environ, JAVA_TOOL_OPTIONS=f"-Xmx{heap_mb}m -XX:+ExitOnOutOfMemoryError")
    try:
        proc = subprocess.run(
            ["Audiveris", "-batch", "-export", "-output", out_dir,
             # Titles/authors are mostly Spanish: the default "eng" misreads accents (Falú -> Fahj)
             "-option", "org.audiveris.omr.text.Language.defaultSpecification=spa+eng",
             "--", pdf_path],
            capture_output=True, text=True, timeout=timeout, env=env)
    except subprocess.TimeoutExpired:
        log(f"Audiveris timed out after {timeout}s")
        return []
    base = os.path.splitext(os.path.basename(pdf_path))[0]
    files = sorted(glob.glob(os.path.join(out_dir, glob.escape(base) + "*.mxl")))
    if not files:
        tail = "\n".join((proc.stdout + proc.stderr).strip().splitlines()[-30:])
        log(f"Audiveris exit {proc.returncode}, no MusicXML exported.\n{tail}")
    return files


def _quality(files, log):
    try:
        return dict(measure_quality(files), out_of_key=out_of_key_ratio(files))
    except Exception as exc:  # noqa: BLE001 - an unreadable result is just a bad one
        log(f"cannot assess result: {exc}")
        return {"measures": 0, "consistent": 0, "notes": 0, "out_of_key": 0.0}


def _is_suspect(q):
    """A reading to doubt: rhythm that does not add up, or too many notes outside the key."""
    return not q["measures"] or q["consistent"] < ACCEPT_RATIO * q["measures"] or q.get("out_of_key", 0.0) > MAX_OUT_OF_KEY


def _score(q):
    """How much to trust a reading: the share of measures with consistent rhythm, discounted by its out-of-key notes."""
    return (q["consistent"] / q["measures"] if q["measures"] else 0.0) * (1 - q.get("out_of_key", 0.0))


def _better(candidate, best):
    """Replace the first reading only with one clearly more trustworthy that also covers most of its notes."""
    return (_score(candidate) > _score(best) + MIN_SCORE_GAIN
            and candidate["notes"] >= MIN_COVERAGE * best["notes"])


def recognize(pdf, work, deadline, heap_mb, log=log, info=None):
    """MusicXML files of the best reading of the PDF, [] if no engine produced one.

    `deadline` is a time.monotonic() value shared by every attempt. If `info` is a dict it is filled with
    what the caller may tell the user: the engine, whether the PDF is a scan, whether the reading is still
    doubtful, and its measures / consistent / out_of_key figures.
    """
    def audiveris():
        straight_dir = os.path.join(work, "deskew")
        os.makedirs(straight_dir, exist_ok=True)
        straight = deskew_pdf(pdf, straight_dir, log)
        return run_audiveris(straight, os.path.join(work, "audiveris"), heap_mb,
                             max(1, int(deadline - time.monotonic())))

    def homr():
        return run_homr(pdf, os.path.join(work, "homr"), deadline, log)

    scan = is_scan(pdf)
    order = [("homr", homr), ("audiveris", audiveris)] if scan else [("audiveris", audiveris), ("homr", homr)]
    log("engine order: " + " then ".join(name for name, _ in order))
    best = None
    for name, run in order:
        if best is not None:
            if not _is_suspect(best["quality"]):
                break
            if deadline - time.monotonic() < MIN_FALLBACK_SECONDS:
                log("no time left for a second opinion")
                break
        files = run()
        if not files:
            log(f"{name}: no MusicXML")
            continue
        quality = _quality(files, log)
        log(f"{name}: {len(files)} file(s), {quality['consistent']}/{quality['measures']} measures with consistent rhythm, "
            f"{quality['notes']} notes, {quality['out_of_key']:.0%} out of key")
        if best is None or _better(quality, best["quality"]):
            best = {"name": name, "files": files, "quality": quality}
    if best:
        log(f"using {best['name']}")
        if info is not None:
            q = best["quality"]
            info.update(engine=best["name"], scan=scan, suspect=_is_suspect(q), measures=q["measures"],
                        consistent=q["consistent"], out_of_key=q["out_of_key"])
    return best["files"] if best else []


def main():
    try:
        bucket = os.environ["BUCKET"]
        input_key = os.environ["INPUT_KEY"]
        prefix = os.environ["OUTPUT_PREFIX"]
        if not prefix.endswith("/"):
            raise KeyError("OUTPUT_PREFIX must end with '/'")
        heap_mb = int(os.environ.get("OMR_MAX_HEAP_MB", "5120"))
        timeout = int(os.environ.get("OMR_TIMEOUT_SECONDS", "780"))
    except (KeyError, ValueError) as exc:
        log(f"bad configuration: {exc}")
        return EXIT_CONFIG

    import boto3  # imported late so config errors do not need the SDK

    s3 = boto3.client("s3")
    with tempfile.TemporaryDirectory() as work:
        pdf = os.path.join(work, "score.pdf")
        try:
            s3.download_file(bucket, input_key, pdf)
        except Exception as exc:
            log(f"download failed: {exc}")
            return EXIT_S3
        log(f"downloaded {input_key} ({os.path.getsize(pdf)} bytes)")
        info = {}
        files = recognize(pdf, work, time.monotonic() + timeout, heap_mb, info=info)
        if not files:
            return EXIT_OMR
        try:
            for i, path in enumerate(files, 1):
                key = f"{prefix}omr-{i:02d}.mxl"
                s3.upload_file(path, bucket, key, ExtraArgs={
                    "ContentType": "application/vnd.recordare.musicxml"})
                log(f"uploaded {key}")
            # How the reading went (scan? still doubtful?): the engine Lambda forwards it to the Job.
            s3.put_object(Bucket=bucket, Key=f"{prefix}omr-meta.json", Body=json.dumps(info).encode(),
                          ContentType="application/json")
        except Exception as exc:
            log(f"upload failed: {exc}")
            return EXIT_S3
    return 0


if __name__ == "__main__":
    sys.exit(main())
