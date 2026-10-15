"""AWS Lambda entry point for the tab engine (container image, arm64).

Thin S3 adapter around the pure operations in tabify.py: download the input
artifacts to /tmp, call `prepare`/`export`, upload the outputs. All contracts
are documented in backend/README.md.

Errors are returned, not raised: {"ok": false, "error": <code>, "message": ...}
so the state machine can branch on `ok` and store the code on the Job.
"""

import json
import os
import shutil
import tempfile

import tabify

_s3 = None


def s3():
    global _s3
    if _s3 is None:
        import boto3  # provided by the Lambda runtime; imported lazily for tests

        _s3 = boto3.client("s3")
    return _s3


CONTENT_TYPES = {
    ".pdf": "application/pdf",
    ".svg": "image/svg+xml",
    ".json": "application/json",
    ".musicxml": "application/vnd.recordare.musicxml+xml",
}


def _prefix(value):
    if not value or not value.endswith("/"):
        raise ValueError("out_prefix must end with '/'")
    return value


def _download(bucket, key, folder):
    path = os.path.join(folder, os.path.basename(key))
    n = 0
    while os.path.exists(path):  # same basename under different prefixes
        n += 1
        path = os.path.join(folder, f"{n}-{os.path.basename(key)}")
    s3().download_file(bucket, key, path)
    # Object keys may carry no extension; music21 picks the reader from it.
    if os.path.splitext(path)[1].lower() not in (".mxl", ".musicxml", ".xml"):
        with open(path, "rb") as f:
            zipped = f.read(2) == b"PK"
        renamed = path + (".mxl" if zipped else ".musicxml")
        os.rename(path, renamed)
        path = renamed
    return path


def _upload(bucket, key, path):
    ext = os.path.splitext(path)[1].lower()
    s3().upload_file(path, bucket, key,
                     ExtraArgs={"ContentType": CONTENT_TYPES.get(ext, "application/octet-stream")})


def _list_scores(bucket, prefix):
    keys = []
    for page in s3().get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix=prefix):
        keys += [o["Key"] for o in page.get("Contents", [])
                 if o["Key"].lower().endswith((".mxl", ".musicxml", ".xml"))]
    return keys


def handle_prepare(event, workdir):
    bucket, prefix = event["bucket"], _prefix(event["out_prefix"])
    keys = event.get("input_keys") or ([event["input_key"]] if event.get("input_key") else None)
    if not keys:  # OCR output: every movement Audiveris exported under a prefix
        keys = sorted(_list_scores(bucket, event["input_prefix"]))
        if not keys:
            raise ValueError("no MusicXML under input_prefix")
    inputs = [_download(bucket, k, workdir) for k in keys]
    out_dir = os.path.join(workdir, "out")
    result = tabify.prepare(inputs, event.get("kind", "musicxml"), event.get("tuning", "auto"),
                            out_dir, per_row=int(event.get("per_row", 4)))
    for name in sorted(os.listdir(out_dir)):
        _upload(bucket, prefix + name, os.path.join(out_dir, name))
    return {
        "ok": True,
        "keys": {
            "musicxml": prefix + tabify.NORMALIZED_NAME,
            "suggestion": prefix + tabify.SUGGESTION_NAME,
            "preview": prefix + tabify.PREVIEW_NAME,
            "preview_svgs": [prefix + os.path.basename(p) for p in result["preview_svgs"]],
        },
        "tuning": result["tuning"],
        "title": result["title"],
        "dropped": result["dropped"],
        "measures": result["measures"],
    }


def handle_export(event, workdir):
    bucket, prefix = event["bucket"], _prefix(event["out_prefix"])
    tabs = event.get("tabs")
    if tabs is None:
        tabs = json.loads(s3().get_object(Bucket=bucket, Key=event["tabs_key"])["Body"].read())
    musicxml = _download(bucket, event["musicxml_key"], workdir)
    suggestion = _download(bucket, event["suggestion_key"], workdir)
    out_dir = os.path.join(workdir, "out")
    result = tabify.export(musicxml, suggestion, tabs, event.get("tuning"), out_dir)
    keys = {}
    for field in ("pdf", "musicxml", "tabs"):
        key = prefix + os.path.basename(result[field])
        _upload(bucket, key, result[field])
        keys[field] = key
    return {"ok": True, "keys": keys, "tuning": result["tuning"]}


ACTIONS = {"prepare": handle_prepare, "export": handle_export}


def handler(event, context=None):
    action = event.get("action")
    if action not in ACTIONS:
        return {"ok": False, "error": "bad_request", "message": f"unknown action: {action}"}
    workdir = tempfile.mkdtemp(prefix="engine-")
    try:
        return ACTIONS[action](event, workdir)
    except tabify.NoNotesError as exc:
        return {"ok": False, "error": "no_notes", "message": str(exc)}
    except Exception as exc:  # unreadable scores, malformed events: the Job fails, not the Lambda
        print(f"{action} failed: {type(exc).__name__}: {exc}")
        code = "bad_request" if isinstance(exc, KeyError) else (
            "invalid_score" if action == "prepare" else "export_failed")
        return {"ok": False, "error": code, "message": f"{type(exc).__name__}: {exc}"}
    finally:
        shutil.rmtree(workdir, ignore_errors=True)
