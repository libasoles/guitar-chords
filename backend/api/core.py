"""Business logic of the partitura-y-tablatura API.

Everything that touches AWS or the network goes through the ports defined in
this module (Store, Blob, Workflow, Turnstile, Clock), so tests use in-memory
fakes. Production adapters live in adapters.py.
"""
from __future__ import annotations

import base64
import hashlib
import json
import re
import posixpath
import secrets
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Optional, Protocol

import engine_adapter

# ---------------------------------------------------------------- error codes

STATUS_BY_CODE = {
    "invalid_request": 400,
    "turnstile_failed": 403,
    "not_found": 404,
    "expired": 410,
    "not_uploaded": 409,
    "invalid_state": 409,
    "too_large": 413,
    "rate_limited": 429,
    "export_limit": 429,
    "busy": 503,
    "budget_paused": 503,
    "omr_failed": 422,
    "invalid_score": 422,
    "export_failed": 500,
    "no_notes": 422,
    "timeout": 504,
    "internal_error": 500,
}
# Codes the engine / state machine may report for a failed job.
JOB_FAILURE_CODES = {"omr_failed", "no_notes", "invalid_score", "export_failed", "timeout",
                     "too_large", "internal_error"}

KINDS = ("pdf", "musicxml")
TUNINGS = ("auto", "standard", "dropd")
EXTENSIONS = {"pdf": (".pdf",), "musicxml": (".musicxml", ".xml", ".mxl")}


class ApiError(Exception):
    def __init__(self, code: str, message: str = ""):
        super().__init__(code)
        self.code = code
        self.message = message or code
        self.status = STATUS_BY_CODE.get(code, 400)


# ---------------------------------------------------------------------- ports

class Store(Protocol):
    def get(self, pk: str) -> Optional[dict]: ...
    def put(self, item: dict) -> None: ...
    def put_if_absent(self, item: dict) -> bool: ...
    def update(self, pk: str, fields: dict, expect: Optional[dict] = None) -> bool: ...
    def increment(self, pk: str, field: str, limit: int, ttl: Optional[int] = None) -> bool:
        """Atomically add 1 to `field` only while it is < limit. True if done."""
    def decrement(self, pk: str, field: str) -> None: ...


class Blob(Protocol):
    def presign_upload(self, key: str, max_bytes: int, expires: int) -> dict: ...
    def presign_download(self, key: str, filename: str, expires: int) -> str: ...
    def size(self, key: str) -> Optional[int]: ...
    def put_json(self, key: str, data: Any) -> None: ...


class Workflow(Protocol):
    def start(self, kind: str, name: str, payload: dict) -> str: ...


class Turnstile(Protocol):
    def verify(self, token: str, ip: str) -> dict: ...


@dataclass
class Config:
    bucket: str = "bucket"
    allowed_origins: tuple = (
        "https://acordesdeguitarra.com.ar",
        "https://www.acordesdeguitarra.com.ar",
    )
    turnstile_hostnames: tuple = ("acordesdeguitarra.com.ar", "www.acordesdeguitarra.com.ar")
    turnstile_action: str = "partitura-tablatura"
    limits: dict = field(default_factory=lambda: {"pdf": 2, "musicxml": 10})
    export_limit: int = 10
    ocr_slots: int = 2
    max_upload_bytes: int = 20 * 1024 * 1024
    job_ttl: int = 24 * 3600
    stale_after: int = 15 * 60 + 60   # state machine timeout + grace
    url_ttl: int = 15 * 60
    salt: str = ""

    def origin_allowed(self, origin: str) -> bool:
        if origin in self.allowed_origins:
            return True
        return bool(re.fullmatch(r"http://(localhost|127\.0\.0\.1)(:\d+)?", origin or ""))


# ------------------------------------------------------------------- service

class Service:
    def __init__(self, store: Store, blob: Blob, workflow: Workflow,
                 turnstile: Turnstile, config: Config,
                 clock: Callable[[], float], new_id: Callable[[], str] = None):
        self.store, self.blob, self.workflow = store, blob, workflow
        self.turnstile, self.cfg, self.clock = turnstile, config, clock
        self.new_id = new_id or (lambda: secrets.token_urlsafe(32))

    # -- helpers
    def _hash(self, value: str) -> str:
        return hashlib.sha256((self.cfg.salt + value).encode()).hexdigest()[:32]

    def _day(self) -> str:
        return time.strftime("%Y%m%d", time.gmtime(self.clock()))

    def budget_paused(self) -> bool:
        flag = self.store.get("flag#budget")
        if not flag or not flag.get("paused"):
            return False
        until = flag.get("until")
        return not (until and until <= self.clock())

    def _job(self, job_id: str) -> dict:
        if not re.fullmatch(r"[A-Za-z0-9_-]{20,128}", job_id or ""):
            raise ApiError("not_found")
        job = self.store.get(f"job#{job_id}")
        if not job:
            raise ApiError("not_found")
        if job["expires_at"] <= self.clock():
            raise ApiError("expired", "job expired")
        self._fail_if_stale(job)
        return job

    def _fail_if_stale(self, job: dict) -> None:
        """Backstop: the state machine timeout cannot be caught inside the
        machine, so a job stuck 'processing' is failed lazily on read."""
        if job["status"] in ("processing", "exporting") and \
                self.clock() - job.get("started_at", self.clock()) > self.cfg.stale_after:
            self._fail(job, "timeout")

    def _fail(self, job: dict, code: str) -> None:
        code = code if code in JOB_FAILURE_CODES else "internal_error"
        job.update(status="failed", error=code, finished_at=self.clock())
        self.store.update(job["pk"], {"status": "failed", "error": code,
                                      "finished_at": job["finished_at"]})
        self._release_slot(job)

    def _release_slot(self, job: dict) -> None:
        """Idempotent: only the caller that flips slot_held True->False decrements."""
        if self.store.update(job["pk"], {"slot_held": False}, expect={"slot_held": True}):
            self.store.decrement("ocr#slots", "active")
        job["slot_held"] = False

    def _keys(self, job_id: str, kind: str, filename: str) -> dict:
        return engine_adapter.keys_for(job_id, kind, filename)

    # -- POST /jobs
    def create_job(self, body: dict, ip: str) -> dict:
        filename = str(body.get("filename") or "")
        kind = body.get("kind")
        tuning = body.get("tuning", "auto")
        token = body.get("turnstileToken")
        size = body.get("size")
        if kind not in KINDS or tuning not in TUNINGS or not filename or len(filename) > 200:
            raise ApiError("invalid_request")
        if not filename.lower().endswith(EXTENSIONS[kind]):
            raise ApiError("invalid_request", "extension does not match kind")
        if size is not None:
            if not isinstance(size, int) or isinstance(size, bool) or size <= 0:
                raise ApiError("invalid_request")
            if size > self.cfg.max_upload_bytes:
                raise ApiError("too_large")
        if self.budget_paused():
            raise ApiError("budget_paused")
        self._check_turnstile(token, ip)
        day = self._day()
        ip_hash = self._hash(ip)
        ok = self.store.increment(f"limit#{day}#{kind}#{ip_hash}", "count",
                                  self.cfg.limits[kind], ttl=int(self.clock()) + 2 * 86400)
        if not ok:
            raise ApiError("rate_limited")
        job_id = self.new_id()
        now = self.clock()
        keys = self._keys(job_id, kind, filename)
        job = {"pk": f"job#{job_id}", "id": job_id, "kind": kind, "tuning": tuning,
               "filename": filename, "status": "created", "stage": None,
               "created_at": now, "expires_at": now + self.cfg.job_ttl,
               "ttl": int(now + self.cfg.job_ttl + 3600), "ip_hash": ip_hash,
               "exports": 0, "slot_held": False}
        self.store.put(job)
        upload = self.blob.presign_upload(keys["input"], self.cfg.max_upload_bytes, self.cfg.url_ttl)
        return {"id": job_id, "upload": upload, "maxBytes": self.cfg.max_upload_bytes,
                "expiresAt": job["expires_at"]}

    def _check_turnstile(self, token: Any, ip: str) -> None:
        if not isinstance(token, str) or not token or len(token) > 4096:
            raise ApiError("turnstile_failed")
        # reuse guard: each token may be presented once
        if not self.store.put_if_absent({"pk": f"token#{self._hash(token)}",
                                         "ttl": int(self.clock()) + 2 * 86400}):
            raise ApiError("turnstile_failed", "token already used")
        try:
            res = self.turnstile.verify(token, ip) or {}
        except Exception:
            raise ApiError("turnstile_failed", "verification unavailable")
        if not (res.get("success") is True
                and res.get("hostname") in self.cfg.turnstile_hostnames
                and res.get("action") == self.cfg.turnstile_action):
            raise ApiError("turnstile_failed")

    # -- POST /jobs/{id}/process
    def process(self, job_id: str) -> dict:
        job = self._job(job_id)
        if job["status"] in ("processing", "ready", "exporting", "exported"):
            return self._view(job)
        if job["status"] == "failed":
            raise ApiError("invalid_state", "job failed")
        keys = self._keys(job_id, job["kind"], job["filename"])
        size = self.blob.size(keys["input"])
        if size is None:
            raise ApiError("not_uploaded")
        if size > self.cfg.max_upload_bytes:
            self._fail(job, "too_large")
            raise ApiError("too_large")
        is_pdf = job["kind"] == "pdf"
        if is_pdf:
            if not self.store.increment("ocr#slots", "active", self.cfg.ocr_slots):
                raise ApiError("busy")
            self.store.update(job["pk"], {"slot_held": True})
            job["slot_held"] = True
        try:
            payload = engine_adapter.process_input(job, self.cfg.bucket, keys)
            arn = self.workflow.start("process", job_id, payload)
        except Exception:
            self._fail(job, "internal_error")
            raise ApiError("internal_error")
        fields = {"status": "processing", "stage": "ocr" if is_pdf else "preparing",
                  "started_at": self.clock(), "execution_arn": arn}
        self.store.update(job["pk"], fields)
        job.update(fields)
        return self._view(job)

    # -- GET /jobs/{id}
    def get_job(self, job_id: str) -> dict:
        return self._view(self._job(job_id))

    def _view(self, job: dict) -> dict:
        end = job.get("finished_at") or self.clock()
        started = job.get("started_at")
        out = {"id": job["id"], "status": job["status"], "stage": job.get("stage"),
               "kind": job["kind"], "tuning": job.get("resolved_tuning") or job["tuning"],
               "error": job.get("error"),
               "elapsedSeconds": int(max(0, end - started)) if started else 0,
               "expiresAt": job["expires_at"], "exports": job.get("exports", 0),
               "discardedNotes": job.get("dropped", []), "measures": job.get("measures"),
               "title": job.get("title"), "preview": None}
        if job["status"] in ("ready", "exporting", "exported"):
            keys = self._keys(job["id"], job["kind"], job["filename"])
            ttl = self.cfg.url_ttl
            out["preview"] = {
                "json": self.blob.presign_download(keys["preview"], "preview.json", ttl),
                "suggestion": self.blob.presign_download(keys["suggestion"], "suggestion.json", ttl),
                "svgs": [self.blob.presign_download(k, posixpath.basename(k), ttl)
                         for k in job.get("preview_svgs") or []]}
        return out

    # -- POST /jobs/{id}/export
    def export(self, job_id: str, body: dict) -> dict:
        job = self._job(job_id)
        tabs = body.get("tabs")
        if not isinstance(tabs, list) or len(json.dumps(tabs)) > 2_000_000:
            raise ApiError("invalid_request")
        if job["status"] not in ("ready", "exported"):
            raise ApiError("invalid_state", f"cannot export from {job['status']}")
        if not self.store.increment(job["pk"], "exports", self.cfg.export_limit):
            raise ApiError("export_limit")
        n = job.get("exports", 0) + 1
        keys = engine_adapter.keys_for(job_id, job["kind"], job["filename"], n)
        try:
            self.blob.put_json(keys["edits"], tabs)   # engine `tabs_key`: the Tab[] itself
            payload = engine_adapter.export_input(job, self.cfg.bucket, keys)
            arn = self.workflow.start("export", f"{job_id}-{n}", payload)
        except Exception:
            self.store.decrement(job["pk"], "exports")
            raise ApiError("internal_error")
        fields = {"status": "exporting", "stage": "exporting", "started_at": self.clock(),
                  "finished_at": None, "execution_arn": arn}
        self.store.update(job["pk"], fields)
        job.update(fields)
        job["exports"] = n
        return self._view(job)

    # -- GET /jobs/{id}/downloads
    def downloads(self, job_id: str) -> dict:
        job = self._job(job_id)
        if job["status"] not in ("ready", "exporting", "exported"):
            raise ApiError("invalid_state", f"no downloads in {job['status']}")
        keys = engine_adapter.keys_for(job_id, job["kind"], job["filename"], job.get("exports", 0))
        links = {}
        if job["status"] == "exported":
            for name, key, fname in (("pdf", "pdf", "tablatura.pdf"),
                                     ("musicxml", "final", "tablatura.musicxml"),
                                     ("tabs", "tabs", "tablaturas.json")):
                if self.blob.size(keys[key]) is not None:
                    links[name] = self.blob.presign_download(keys[key], fname, self.cfg.url_ttl)
        if job["kind"] == "pdf" and self.blob.size(keys["intermediate"]) is not None:
            links["intermediate"] = self.blob.presign_download(
                keys["intermediate"], "intermedio.musicxml", self.cfg.url_ttl)
        return {"id": job_id, "status": job["status"], "downloads": links}

    # ------------------------------------------- internal (state machine/SNS)
    def internal(self, event: dict) -> dict:
        op = event.get("internal")
        job_id = event.get("jobId")
        job = self.store.get(f"job#{job_id}") if job_id else None
        if job is None:
            return {"ok": False}
        if op == "stage":
            if event.get("stage") == "preparing":
                self._release_slot(job)       # OCR finished, free the slot
            self.store.update(job["pk"], {"stage": event.get("stage")})
        elif op == "complete":
            result = event.get("result")
            result = result if isinstance(result, dict) else {}
            if result.get("ok") is False or result.get("error"):
                self._fail(job, engine_adapter.map_engine_error(result.get("error"), job["kind"]))
            else:
                exporting = event.get("action") == "export"
                fields = {"status": "exported" if exporting else "ready",
                          "stage": None, "finished_at": self.clock()}
                if not exporting:
                    fields["dropped"] = result.get("dropped") or []
                    fields["preview_svgs"] = list((result.get("keys") or {}).get("preview_svgs") or [])
                    for src, dst in (("tuning", "resolved_tuning"), ("measures", "measures"),
                                     ("title", "title")):
                        if result.get(src) is not None:
                            fields[dst] = result[src]
                self.store.update(job["pk"], fields)
                self._release_slot(job)
        elif op == "fail":
            self._fail(job, classify_failure(event.get("error"), job.get("stage")))
        return {"ok": True}

    def execution_status_change(self, detail: dict) -> dict:
        """EventBridge 'Step Functions Execution Status Change'. Catches what the
        machine cannot catch itself (machine-level timeout, abort, crash)."""
        status = detail.get("status")
        if status not in ("TIMED_OUT", "FAILED", "ABORTED"):
            return {"ok": True, "ignored": True}
        try:
            job_id = json.loads(detail.get("input") or "{}").get("jobId")
        except (TypeError, ValueError, AttributeError):
            job_id = None
        job = self.store.get(f"job#{job_id}") if isinstance(job_id, str) and job_id else None
        if job is None:
            return {"ok": False}
        # A job already finished (ready/exported/failed) keeps its outcome.
        if job["status"] in ("processing", "exporting"):
            if status == "TIMED_OUT":
                code = "timeout"
            else:
                code = classify_failure({"Error": detail.get("error") or "",
                                         "Cause": detail.get("cause") or ""}, job.get("stage"))
            self._fail(job, code)
        else:
            self._release_slot(job)
        return {"ok": True}

    def set_budget_paused(self, until: Optional[float] = None) -> None:
        item = {"pk": "flag#budget", "paused": True}
        if until:
            item.update(until=until, ttl=int(until) + 86400)
        self.store.put(item)


def classify_failure(error: Any, stage: Optional[str]) -> str:
    err = error if isinstance(error, dict) else {}
    name = str(err.get("Error", ""))
    cause = str(err.get("Cause", ""))
    if name in ("States.Timeout", "Sandbox.Timedout") or "timed out" in cause.lower():
        return "timeout"
    for code in ("no_notes", "invalid_score", "export_failed", "omr_failed", "too_large", "timeout"):
        if name == code or f'"{code}"' in cause:
            return code
    return "omr_failed" if stage == "ocr" else "internal_error"


# ----------------------------------------------------------------- HTTP layer

def respond(status: int, body: Any, origin: str = "", cfg: Optional[Config] = None) -> dict:
    headers = {"content-type": "application/json", "cache-control": "no-store"}
    if cfg and cfg.origin_allowed(origin):
        headers.update({"access-control-allow-origin": origin, "vary": "Origin",
                        "access-control-allow-headers": "content-type",
                        "access-control-allow-methods": "GET,POST,OPTIONS"})
    return {"statusCode": status, "headers": headers,
            "body": json.dumps(body) if body != "" else ""}


def handle_http(svc: Service, event: dict) -> dict:
    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    origin = headers.get("origin", "")
    http = (event.get("requestContext") or {}).get("http") or {}
    route = event.get("routeKey") or ""
    method = http.get("method") or route.split(" ")[0]
    if method == "OPTIONS":
        return respond(204, "", origin, svc.cfg)
    params = event.get("pathParameters") or {}
    ip = http.get("sourceIp") or "0.0.0.0"
    try:
        body = {}
        if event.get("body"):
            raw = event["body"]
            if event.get("isBase64Encoded"):
                raw = base64.b64decode(raw).decode()
            try:
                body = json.loads(raw)
            except ValueError:
                raise ApiError("invalid_request", "invalid JSON")
            if not isinstance(body, dict):
                raise ApiError("invalid_request")
        job_id = params.get("id", "")
        if route == "POST /jobs":
            res, status = svc.create_job(body, ip), 201
        elif route == "POST /jobs/{id}/process":
            res, status = svc.process(job_id), 202
        elif route == "GET /jobs/{id}":
            res, status = svc.get_job(job_id), 200
        elif route == "POST /jobs/{id}/export":
            res, status = svc.export(job_id, body), 202
        elif route == "GET /jobs/{id}/downloads":
            res, status = svc.downloads(job_id), 200
        else:
            raise ApiError("not_found")
        return respond(status, res, origin, svc.cfg)
    except ApiError as e:
        return respond(e.status, {"error": {"code": e.code, "message": e.message}}, origin, svc.cfg)
