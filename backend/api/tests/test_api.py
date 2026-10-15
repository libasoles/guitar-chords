import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import core  # noqa: E402
import handler  # noqa: E402

ORIGIN = "https://acordesdeguitarra.com.ar"


class FakeStore:
    def __init__(self):
        self.items = {}

    def get(self, pk):
        item = self.items.get(pk)
        return json.loads(json.dumps(item)) if item else None

    def put(self, item):
        self.items[item["pk"]] = dict(item)

    def put_if_absent(self, item):
        if item["pk"] in self.items:
            return False
        self.put(item)
        return True

    def update(self, pk, fields, expect=None):
        item = self.items.get(pk)
        if item is None:
            return False
        if expect and any(item.get(k) != v for k, v in expect.items()):
            return False
        for k, v in fields.items():
            if v is None:
                item.pop(k, None)
            else:
                item[k] = v
        return True

    def increment(self, pk, field, limit, ttl=None):
        item = self.items.setdefault(pk, {"pk": pk})
        if item.get(field, 0) >= limit:
            return False
        item[field] = item.get(field, 0) + 1
        return True

    def decrement(self, pk, field):
        item = self.items.get(pk)
        if item and item.get(field, 0) > 0:
            item[field] -= 1


class FakeBlob:
    def __init__(self):
        self.objects = {}

    def presign_upload(self, key, max_bytes, expires):
        return {"url": "https://s3.test/up", "fields": {"key": key}, "max": max_bytes}

    def presign_download(self, key, filename, expires):
        return f"https://s3.test/{key}?name={filename}"

    def size(self, key):
        return self.objects.get(key)

    def put_json(self, key, data):
        self.objects[key] = len(json.dumps(data))


class FakeWorkflow:
    def __init__(self):
        self.started = []
        self.fail = False

    def start(self, kind, name, payload):
        if self.fail:
            raise RuntimeError("boom")
        self.started.append((kind, name, payload))
        return f"arn:execution:{kind}:{name}"


class FakeTurnstile:
    def __init__(self):
        self.calls = []
        self.result = {"success": True, "hostname": "acordesdeguitarra.com.ar",
                       "action": "partitura-tablatura"}

    def verify(self, token, ip):
        self.calls.append((token, ip))
        return self.result


class Env:
    def __init__(self):
        self.now = 1_800_000_000.0
        self.store, self.blob = FakeStore(), FakeBlob()
        self.wf, self.ts = FakeWorkflow(), FakeTurnstile()
        self.n = 0
        self.tok = 0
        self.svc = core.Service(self.store, self.blob, self.wf, self.ts,
                                core.Config(bucket="b"), lambda: self.now, self._id)

    def _id(self):
        self.n += 1
        return f"job{self.n:030d}"

    def call(self, route, body=None, ip="1.2.3.4", job=None, origin=ORIGIN):
        event = {"routeKey": route, "headers": {"Origin": origin},
                 "requestContext": {"http": {"sourceIp": ip, "method": route.split()[0]}},
                 "pathParameters": {"id": job} if job else None,
                 "body": json.dumps(body) if body is not None else None}
        res = handler.dispatch(self.svc, event)
        return res["statusCode"], json.loads(res["body"] or "{}"), res["headers"]

    def create(self, kind="musicxml", ip="1.2.3.4", name=None, **extra):
        self.tok += 1
        body = {"filename": name or ("a.pdf" if kind == "pdf" else "a.musicxml"),
                "kind": kind, "tuning": "auto", "turnstileToken": f"tok{self.tok}"}
        body.update(extra)
        return self.call("POST /jobs", body, ip=ip)

    def upload(self, job_id, size=1000):
        job = self.store.items[f"job#{job_id}"]
        import engine_adapter
        key = engine_adapter.keys_for(job_id, job["kind"], job["filename"])["input"]
        self.blob.objects[key] = size

    def ready_job(self, kind="musicxml"):
        _, body, _ = self.create(kind)
        jid = body["id"]
        self.upload(jid)
        self.call("POST /jobs/{id}/process", job=jid)
        self.svc.internal({"internal": "complete", "jobId": jid, "action": "process",
                           "result": {"ok": True, "tuning": "standard", "dropped": [], "measures": 4,
                                      "keys": {"preview_svgs": [f"jobs/{jid}/prepared/preview-01.svg"]}}})
        return jid


class CreationTests(unittest.TestCase):
    def test_create_returns_long_random_id_and_upload(self):
        env = Env()
        import secrets
        env.svc.new_id = lambda: secrets.token_urlsafe(32)
        status, body, headers = env.create()
        self.assertEqual(status, 201)
        self.assertGreaterEqual(len(body["id"]), 40)
        self.assertEqual(body["upload"]["max"], 20 * 1024 * 1024)
        self.assertEqual(headers["access-control-allow-origin"], ORIGIN)
        item = env.store.items[f"job#{body['id']}"]
        self.assertEqual(item["status"], "created")
        self.assertEqual(item["expires_at"] - env.now, 86400)
        self.assertIn("ttl", item)

    def test_cors_localhost_allowed_and_unknown_origin_not(self):
        env = Env()
        _, _, h = env.call("GET /jobs/{id}", job="x" * 30, origin="http://localhost:5173")
        self.assertEqual(h["access-control-allow-origin"], "http://localhost:5173")
        _, _, h = env.call("GET /jobs/{id}", job="x" * 30, origin="https://evil.example")
        self.assertNotIn("access-control-allow-origin", h)

    def test_invalid_input_and_too_large(self):
        env = Env()
        self.assertEqual(env.create(kind="pdf", name="a.musicxml")[1]["error"]["code"], "invalid_request")
        self.assertEqual(env.create(size=21 * 1024 * 1024)[1]["error"]["code"], "too_large")

    def test_upload_url_too_large_detected_on_process(self):
        env = Env()
        jid = env.create()[1]["id"]
        env.upload(jid, size=25 * 1024 * 1024)
        status, body, _ = env.call("POST /jobs/{id}/process", job=jid)
        self.assertEqual(body["error"]["code"], "too_large")
        self.assertEqual(env.call("GET /jobs/{id}", job=jid)[1]["error"], "too_large")


class TurnstileTests(unittest.TestCase):
    def test_invalid_token_wrong_hostname_action(self):
        for result in ({"success": False}, {"success": True, "hostname": "evil.com", "action": "partitura-tablatura"},
                       {"success": True, "hostname": "acordesdeguitarra.com.ar", "action": "other"}):
            env = Env()
            env.ts.result = result
            status, body, _ = env.create()
            self.assertEqual((status, body["error"]["code"]), (403, "turnstile_failed"))
            self.assertEqual(env.store.get("limit#x"), None)

    def test_reused_token_rejected(self):
        env = Env()
        body = {"filename": "a.musicxml", "kind": "musicxml", "turnstileToken": "same"}
        self.assertEqual(env.call("POST /jobs", body)[0], 201)
        status, res, _ = env.call("POST /jobs", body)
        self.assertEqual((status, res["error"]["code"]), (403, "turnstile_failed"))
        self.assertEqual(len(env.ts.calls), 1)

    def test_missing_token(self):
        env = Env()
        status, res, _ = env.call("POST /jobs", {"filename": "a.pdf", "kind": "pdf"})
        self.assertEqual(res["error"]["code"], "turnstile_failed")


class LimitTests(unittest.TestCase):
    def test_third_pdf_of_day_rate_limited_other_ip_ok(self):
        env = Env()
        self.assertEqual(env.create("pdf")[0], 201)
        self.assertEqual(env.create("pdf")[0], 201)
        status, body, _ = env.create("pdf")
        self.assertEqual((status, body["error"]["code"]), (429, "rate_limited"))
        self.assertEqual(env.create("pdf", ip="5.6.7.8")[0], 201)
        self.assertEqual(env.create("musicxml")[0], 201)   # separate kind counter

    def test_limit_resets_next_day(self):
        env = Env()
        env.create("pdf"), env.create("pdf")
        env.now += 86400
        self.assertEqual(env.create("pdf")[0], 201)

    def test_eleventh_musicxml(self):
        env = Env()
        for _ in range(10):
            self.assertEqual(env.create()[0], 201)
        self.assertEqual(env.create()[1]["error"]["code"], "rate_limited")

    def test_eleventh_export(self):
        env = Env()
        jid = env.ready_job()
        for i in range(10):
            status, body, _ = env.call("POST /jobs/{id}/export", {"tabs": [[]]}, job=jid)
            self.assertEqual(status, 202, body)
            env.svc.internal({"internal": "complete", "jobId": jid, "action": "export", "result": {}})
        status, body, _ = env.call("POST /jobs/{id}/export", {"tabs": [[]]}, job=jid)
        self.assertEqual((status, body["error"]["code"]), (429, "export_limit"))

    def test_budget_paused_rejects_new_jobs_until_month_end(self):
        env = Env()
        handler.dispatch(env.svc, {"Records": [{"EventSource": "aws:sns", "Sns": {}}]})
        status, body, _ = env.create()
        self.assertEqual((status, body["error"]["code"]), (503, "budget_paused"))
        self.assertEqual(env.ts.calls, [])
        env.now += 40 * 86400
        self.assertEqual(env.create()[0], 201)


class StateTests(unittest.TestCase):
    def test_musicxml_flow_states_and_downloads(self):
        env = Env()
        jid = env.create()[1]["id"]
        self.assertEqual(env.call("POST /jobs/{id}/process", job=jid)[1]["error"]["code"], "not_uploaded")
        env.upload(jid)
        status, body, _ = env.call("POST /jobs/{id}/process", job=jid)
        self.assertEqual((status, body["status"], body["stage"]), (202, "processing", "preparing"))
        self.assertEqual(env.wf.started[0][0], "process")
        self.assertNotIn("ocr#slots", env.store.items)    # MusicXML never takes a slot
        env.now += 7
        self.assertEqual(env.call("GET /jobs/{id}", job=jid)[1]["elapsedSeconds"], 7)
        env.svc.internal({"internal": "complete", "jobId": jid, "action": "process",
                          "result": {"ok": True, "tuning": "dropd", "measures": 8,
                                    "dropped": [{"measure": 3, "pitch": "E2"}],
                                    "keys": {"preview_svgs": [f"jobs/{jid}/prepared/preview-01.svg",
                                                              f"jobs/{jid}/prepared/preview-02.svg"]}}})
        _, body, _ = env.call("GET /jobs/{id}", job=jid)
        self.assertEqual((body["status"], body["tuning"]), ("ready", "dropd"))
        self.assertEqual(body["discardedNotes"][0]["measure"], 3)
        self.assertIn("preview.json", body["preview"]["json"])
        self.assertIn("suggestion.json", body["preview"]["suggestion"])
        self.assertEqual(len(body["preview"]["svgs"]), 2)
        self.assertIn("preview-02.svg", body["preview"]["svgs"][1])
        self.assertEqual(body["measures"], 8)
        started = env.wf.started[0][2]
        self.assertEqual(started["prepare"]["kind"], "musicxml")
        self.assertEqual(started["prepare"]["input_key"], f"jobs/{jid}/input.musicxml")
        self.assertEqual(started["prepare"]["out_prefix"], f"jobs/{jid}/prepared/")
        status, body, _ = env.call("POST /jobs/{id}/export", {"tabs": [[1, None]]}, job=jid)
        self.assertEqual((status, body["status"]), (202, "exporting"))
        self.assertEqual(env.wf.started[-1][0], "export")
        self.assertEqual(env.call("POST /jobs/{id}/export", {"tabs": []}, job=jid)[1]["error"]["code"], "invalid_state")
        env.svc.internal({"internal": "complete", "jobId": jid, "action": "export", "result": {}})
        export_event = env.wf.started[-1][2]["export"]
        self.assertEqual(export_event["out_prefix"], f"jobs/{jid}/export/1/")
        self.assertEqual(export_event["tuning"], "dropd")
        for name in ("score.pdf", "score.musicxml", "tabs.json"):
            env.blob.objects[f"jobs/{jid}/export/1/{name}"] = 10
        _, body, _ = env.call("GET /jobs/{id}/downloads", job=jid)
        self.assertEqual(sorted(body["downloads"]), ["musicxml", "pdf", "tabs"])

    def test_downloads_before_ready_invalid_state(self):
        env = Env()
        jid = env.create()[1]["id"]
        self.assertEqual(env.call("GET /jobs/{id}/downloads", job=jid)[1]["error"]["code"], "invalid_state")

    def test_unknown_job_and_expiry(self):
        env = Env()
        self.assertEqual(env.call("GET /jobs/{id}", job="z" * 40)[0], 404)
        jid = env.create()[1]["id"]
        env.now += 86400 + 1
        status, body, _ = env.call("GET /jobs/{id}", job=jid)
        self.assertEqual((status, body["error"]["code"]), (410, "expired"))
        self.assertEqual(env.call("POST /jobs/{id}/export", {"tabs": []}, job=jid)[0], 410)

    def test_failure_codes_from_state_machine(self):
        env = Env()
        jid = env.create()[1]["id"]
        env.upload(jid)
        env.call("POST /jobs/{id}/process", job=jid)
        env.svc.internal({"internal": "complete", "jobId": jid, "action": "process",
                          "result": {"ok": False, "error": "no_notes", "message": "x"}})
        body = env.call("GET /jobs/{id}", job=jid)[1]
        self.assertEqual((body["status"], body["error"]), ("failed", "no_notes"))

    def test_invalid_score_maps_by_kind(self):
        env = Env()
        a = env.create("musicxml")[1]["id"]
        env.upload(a)
        env.call("POST /jobs/{id}/process", job=a)
        env.svc.internal({"internal": "complete", "jobId": a, "action": "process",
                          "result": {"ok": False, "error": "invalid_score"}})
        self.assertEqual(env.call("GET /jobs/{id}", job=a)[1]["error"], "invalid_score")
        b = env.create("pdf", ip="9.9.9.9")[1]["id"]
        env.upload(b)
        env.call("POST /jobs/{id}/process", job=b)
        started = env.wf.started[-1][2]
        self.assertEqual(started["prepare"]["kind"], "pdf-ocr-output")
        self.assertEqual(started["prepare"]["input_prefix"], f"jobs/{b}/omr/")
        self.assertEqual(started["ocr"], {"BUCKET": "b", "INPUT_KEY": f"jobs/{b}/input.pdf",
                                          "OUTPUT_PREFIX": f"jobs/{b}/omr/"})
        env.svc.internal({"internal": "complete", "jobId": b, "action": "process",
                          "result": {"ok": False, "error": "invalid_score"}})
        self.assertEqual(env.call("GET /jobs/{id}", job=b)[1]["error"], "omr_failed")

    def test_pdf_ready_offers_intermediate_download(self):
        env = Env()
        jid = env.ready_job("pdf")
        env.blob.objects[f"jobs/{jid}/omr/omr-01.mxl"] = 5
        body = env.call("GET /jobs/{id}/downloads", job=jid)[1]
        self.assertEqual(list(body["downloads"]), ["intermediate"])

    def test_stuck_job_marked_timeout_lazily(self):
        env = Env()
        jid = env.create()[1]["id"]
        env.upload(jid)
        env.call("POST /jobs/{id}/process", job=jid)
        env.now += 20 * 60
        body = env.call("GET /jobs/{id}", job=jid)[1]
        self.assertEqual((body["status"], body["error"]), ("failed", "timeout"))


class OcrConcurrencyTests(unittest.TestCase):
    def pdf(self, env):
        env.ipn = getattr(env, "ipn", 0) + 1
        jid = env.create("pdf", ip=f"10.0.0.{env.ipn}")[1]["id"]
        env.upload(jid)
        return jid

    def test_busy_and_slot_release_on_prepare_stage(self):
        env = Env()
        a, b = self.pdf(env), self.pdf(env)
        self.assertEqual(env.call("POST /jobs/{id}/process", job=a)[1]["stage"], "ocr")
        self.assertEqual(env.call("POST /jobs/{id}/process", job=b)[1]["stage"], "ocr")
        c = self.pdf(env)
        status, body, _ = env.call("POST /jobs/{id}/process", job=c)
        self.assertEqual((status, body["error"]["code"]), (503, "busy"))
        self.assertEqual(env.store.items["ocr#slots"]["active"], 2)
        # OCR of `a` finishes -> prepare stage frees the slot (idempotent)
        env.svc.internal({"internal": "stage", "jobId": a, "stage": "preparing"})
        env.svc.internal({"internal": "stage", "jobId": a, "stage": "preparing"})
        self.assertEqual(env.store.items["ocr#slots"]["active"], 1)
        self.assertEqual(env.call("POST /jobs/{id}/process", job=c)[0], 202)

    def test_slot_released_on_failure_and_on_start_error(self):
        env = Env()
        a, b = self.pdf(env), self.pdf(env)
        env.call("POST /jobs/{id}/process", job=a)
        env.call("POST /jobs/{id}/process", job=b)
        env.svc.internal({"internal": "fail", "jobId": a, "action": "process",
                          "error": {"Error": "States.Timeout", "Cause": ""}})
        self.assertEqual(env.call("GET /jobs/{id}", job=a)[1]["error"], "timeout")
        self.assertEqual(env.store.items["ocr#slots"]["active"], 1)
        env.svc.internal({"internal": "fail", "jobId": b, "action": "process",
                          "error": {"Error": "States.TaskFailed", "Cause": "exit 1"}})
        self.assertEqual(env.call("GET /jobs/{id}", job=b)[1]["error"], "omr_failed")
        self.assertEqual(env.store.items["ocr#slots"]["active"], 0)
        # workflow start failure must not leak a slot
        c = self.pdf(env)
        env.wf.fail = True
        self.assertEqual(env.call("POST /jobs/{id}/process", job=c)[0], 500)
        self.assertEqual(env.store.items["ocr#slots"]["active"], 0)


if __name__ == "__main__":
    unittest.main()
