"""Fargate task entry point: PDF in S3 -> Audiveris -> MusicXML in S3.

Environment (set by the Step Functions task overrides):
  BUCKET                 S3 bucket (required)
  INPUT_KEY              key of the uploaded PDF (required)
  OUTPUT_PREFIX          key prefix ending in '/' for the output (required)
  OMR_MAX_HEAP_MB        JVM -Xmx, default 5120 (for the 8 GB task)
  OMR_TIMEOUT_SECONDS    kill Audiveris after this long, default 780

Writes OUTPUT_PREFIX + "omr-01.mxl" (and omr-02.mxl, ... one per movement).
Exit codes: 0 ok, 2 Audiveris produced no MusicXML / failed / timed out
(-> omr_failed), 3 bad configuration, 4 S3 error. Never leaves 0 on failure.
"""

import glob
import os
import subprocess
import sys
import tempfile

EXIT_OMR = 2
EXIT_CONFIG = 3
EXIT_S3 = 4


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
        files = run_audiveris(pdf, os.path.join(work, "omr"), heap_mb, timeout)
        if not files:
            return EXIT_OMR
        try:
            for i, path in enumerate(files, 1):
                key = f"{prefix}omr-{i:02d}.mxl"
                s3.upload_file(path, bucket, key, ExtraArgs={
                    "ContentType": "application/vnd.recordare.musicxml"})
                log(f"uploaded {key}")
        except Exception as exc:
            log(f"upload failed: {exc}")
            return EXIT_S3
    return 0


if __name__ == "__main__":
    sys.exit(main())
