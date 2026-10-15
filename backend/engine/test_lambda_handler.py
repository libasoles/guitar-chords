"""Lambda adapter with an in-memory S3 (no AWS)."""

import json
import unittest

import lambda_handler
from test_operations import SCORE


class FakeS3:
    def __init__(self):
        self.objects = {}

    def download_file(self, bucket, key, path):
        with open(path, "wb") as f:
            f.write(self.objects[(bucket, key)])

    def upload_file(self, path, bucket, key, ExtraArgs=None):
        with open(path, "rb") as f:
            self.objects[(bucket, key)] = f.read()

    def get_paginator(self, name):
        fake = self

        class Paginator:
            def paginate(self, Bucket, Prefix):
                yield {"Contents": [{"Key": k} for (b, k) in sorted(fake.objects)
                                    if b == Bucket and k.startswith(Prefix)]}
        return Paginator()

    def get_object(self, Bucket, Key):
        import io
        return {"Body": io.BytesIO(self.objects[(Bucket, Key)])}


class HandlerTests(unittest.TestCase):
    def setUp(self):
        self.s3 = FakeS3()
        lambda_handler._s3 = self.s3
        self.addCleanup(setattr, lambda_handler, "_s3", None)
        self.s3.objects[("b", "jobs/1/input")] = SCORE.encode()

    def prepare(self):
        return lambda_handler.handler({
            "action": "prepare", "bucket": "b", "input_key": "jobs/1/input",
            "kind": "musicxml", "tuning": "auto", "out_prefix": "jobs/1/prepared/"})

    def test_prepare_then_export_through_s3(self):
        res = self.prepare()
        self.assertTrue(res["ok"], res)
        for key in [res["keys"]["musicxml"], res["keys"]["suggestion"], res["keys"]["preview"],
                    *res["keys"]["preview_svgs"]]:
            self.assertIn(("b", key), self.s3.objects)
        tabs = json.loads(self.s3.objects[("b", res["keys"]["suggestion"])])["tabs"]
        out = lambda_handler.handler({
            "action": "export", "bucket": "b", "musicxml_key": res["keys"]["musicxml"],
            "suggestion_key": res["keys"]["suggestion"], "tabs": tabs, "tuning": res["tuning"],
            "out_prefix": "jobs/1/export/1/"})
        self.assertTrue(out["ok"], out)
        self.assertEqual(self.s3.objects[("b", out["keys"]["pdf"])][:4], b"%PDF")
        self.assertEqual(json.loads(self.s3.objects[("b", out["keys"]["tabs"])]), tabs)

    def test_prepare_from_ocr_prefix(self):
        import io
        import zipfile
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as z:
            z.writestr("META-INF/container.xml", '<container><rootfiles><rootfile '
                       'full-path="score.xml"/></rootfiles></container>')
            z.writestr("score.xml", SCORE)
        self.s3.objects[("b", "jobs/1/omr/omr-01.mxl")] = buf.getvalue()
        res = lambda_handler.handler({
            "action": "prepare", "bucket": "b", "input_prefix": "jobs/1/omr/",
            "kind": "pdf-ocr-output", "tuning": "dropd", "out_prefix": "jobs/1/prepared/"})
        self.assertTrue(res["ok"], res)
        self.assertEqual(res["tuning"], "dropd")

    def test_errors_are_returned(self):
        self.s3.objects[("b", "bad")] = b"<score-partwise/>"
        res = lambda_handler.handler({"action": "prepare", "bucket": "b", "input_key": "bad",
                                      "kind": "musicxml", "tuning": "auto", "out_prefix": "p/"})
        self.assertFalse(res["ok"])
        self.assertIn(res["error"], ("no_notes", "invalid_score"))
        self.assertEqual(lambda_handler.handler({"action": "x"})["error"], "bad_request")


if __name__ == "__main__":
    unittest.main()
