"""Only place that knows the engine/OCR container event contract.

Contract assumed (to be reconciled with backend/README.md when the engine lands):
  {"action": "ocr"|"prepare"|"export", "bucket": ..., "keys": {...}, "tuning": ...}
Adapt here; the state machine just forwards the objects built below
($.ocr, $.prepare, $.export).
"""
import posixpath


def keys_for(job_id: str, kind: str, filename: str) -> dict:
    ext = posixpath.splitext(filename.lower())[1] or (".pdf" if kind == "pdf" else ".musicxml")
    base = f"jobs/{job_id}"
    return {
        "input": f"{base}/input{ext}",
        "intermediate": f"{base}/intermediate.musicxml",
        "normalized": f"{base}/normalized.musicxml",
        "suggestion": f"{base}/suggestion.json",
        "preview": f"{base}/preview.json",
        "edits": f"{base}/edits.json",
        "pdf": f"{base}/out/score.pdf",
        "final": f"{base}/out/final.musicxml",
        "json": f"{base}/out/tabs.json",
    }


def process_input(job: dict, bucket: str, keys: dict) -> dict:
    """Step Functions input for the `process` machine."""
    source = keys["intermediate"] if job["kind"] == "pdf" else keys["input"]
    return {
        "jobId": job["id"], "kind": job["kind"],
        "ocr": {"action": "ocr", "bucket": bucket,
                "keys": {"input": keys["input"], "output": keys["intermediate"]}},
        "prepare": {"action": "prepare", "bucket": bucket, "tuning": job["tuning"],
                    "keys": {"input": source, "normalized": keys["normalized"],
                             "suggestion": keys["suggestion"], "preview": keys["preview"]}},
    }


def export_input(job: dict, bucket: str, keys: dict) -> dict:
    return {
        "jobId": job["id"], "kind": job["kind"],
        "export": {"action": "export", "bucket": bucket,
                   "tuning": job.get("resolved_tuning") or job["tuning"],
                   "keys": {"normalized": keys["normalized"], "suggestion": keys["suggestion"],
                            "edits": keys["edits"], "pdf": keys["pdf"],
                            "musicxml": keys["final"], "json": keys["json"]}},
    }
