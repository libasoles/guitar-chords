"""Only place that knows the engine Lambda / OCR task contract (backend/README.md).

The state machines just forward the objects built here:
  $.ocr      -> Fargate container overrides (env BUCKET / INPUT_KEY / OUTPUT_PREFIX)
  $.prepare  -> engine Lambda event {"action": "prepare", ...}
  $.export   -> engine Lambda event {"action": "export", ...}
"""
import posixpath

# Engine error code -> API error code. `invalid_score` from a PDF means OCR
# produced garbage, so it is reported as `omr_failed`.
ENGINE_ERRORS = {"no_notes": "no_notes", "invalid_score": "invalid_score",
                 "export_failed": "export_failed", "bad_request": "internal_error"}


def map_engine_error(code, kind: str) -> str:
    code = str(code or "")
    if code == "invalid_score" and kind == "pdf":
        return "omr_failed"
    return ENGINE_ERRORS.get(code, "internal_error")


def keys_for(job_id: str, kind: str, filename: str, export_n: int = 0) -> dict:
    ext = posixpath.splitext(filename.lower())[1] or (".pdf" if kind == "pdf" else ".musicxml")
    base = f"jobs/{job_id}"
    prepared = f"{base}/prepared/"
    omr = f"{base}/omr/"
    export = f"{base}/export/{max(export_n, 0)}/"
    return {
        "input": f"{base}/input{ext}",
        "omr_prefix": omr,
        "intermediate": f"{omr}omr-01.mxl",
        "prepared_prefix": prepared,
        "normalized": f"{prepared}normalized.musicxml",
        "suggestion": f"{prepared}suggestion.json",
        "preview": f"{prepared}preview.json",
        "edits": f"{base}/edits.json",
        "export_prefix": export,
        "pdf": f"{export}score.pdf",
        "final": f"{export}score.musicxml",
        "tabs": f"{export}tabs.json",
    }


def process_input(job: dict, bucket: str, keys: dict) -> dict:
    """Step Functions input for the `process` machine."""
    prepare = {"action": "prepare", "bucket": bucket, "tuning": job["tuning"],
               "out_prefix": keys["prepared_prefix"]}
    if job["kind"] == "pdf":
        prepare.update(kind="pdf-ocr-output", input_prefix=keys["omr_prefix"])
    else:
        prepare.update(kind="musicxml", input_key=keys["input"])
    return {
        "jobId": job["id"], "kind": job["kind"],
        "ocr": {"BUCKET": bucket, "INPUT_KEY": keys["input"], "OUTPUT_PREFIX": keys["omr_prefix"]},
        "prepare": prepare,
    }


def export_input(job: dict, bucket: str, keys: dict) -> dict:
    """`keys` must come from keys_for(..., export_n=<this export's number>)."""
    event = {"action": "export", "bucket": bucket,
             "musicxml_key": keys["normalized"], "suggestion_key": keys["suggestion"],
             "tabs_key": keys["edits"], "out_prefix": keys["export_prefix"]}
    tuning = job.get("resolved_tuning") or job["tuning"]
    if tuning in ("standard", "dropd"):
        event["tuning"] = tuning
    return {"jobId": job["id"], "kind": job["kind"], "export": event}
