"""Production adapters (boto3 / urllib). Imported lazily by handler.py."""
import json
import time
import urllib.parse
import urllib.request
from decimal import Decimal


def _py(v):
    if isinstance(v, Decimal):
        return int(v) if v == v.to_integral_value() else float(v)
    if isinstance(v, dict):
        return {k: _py(x) for k, x in v.items()}
    if isinstance(v, list):
        return [_py(x) for x in v]
    return v


def _dec(v):
    if isinstance(v, float):
        return Decimal(str(v))
    if isinstance(v, dict):
        return {k: _dec(x) for k, x in v.items() if x is not None}
    if isinstance(v, list):
        return [_dec(x) for x in v]
    return v


def _is_conditional_failure(err):
    return err.response["Error"]["Code"] == "ConditionalCheckFailedException"


class DynamoStore:
    def __init__(self, table_name):
        import boto3
        from botocore.exceptions import ClientError
        self.t = boto3.resource("dynamodb").Table(table_name)
        self.ClientError = ClientError

    def get(self, pk):
        item = self.t.get_item(Key={"pk": pk}, ConsistentRead=True).get("Item")
        return _py(item) if item else None

    def put(self, item):
        self.t.put_item(Item=_dec(item))

    def put_if_absent(self, item):
        try:
            self.t.put_item(Item=_dec(item), ConditionExpression="attribute_not_exists(pk)")
            return True
        except self.ClientError as e:
            if _is_conditional_failure(e):
                return False
            raise

    def update(self, pk, fields, expect=None):
        names, values, sets, removes = {}, {}, [], []
        for i, (k, v) in enumerate(fields.items()):
            names[f"#f{i}"] = k
            if v is None:
                removes.append(f"#f{i}")
            else:
                values[f":v{i}"] = _dec(v)
                sets.append(f"#f{i} = :v{i}")
        expr = ""
        if sets:
            expr += "SET " + ", ".join(sets)
        if removes:
            expr += " REMOVE " + ", ".join(removes)
        if expect:
            conds = []
            for i, (k, v) in enumerate(expect.items()):
                names[f"#e{i}"], values[f":e{i}"] = k, v
                conds.append(f"#e{i} = :e{i}")
            cond = " AND ".join(conds)
        else:
            cond = "attribute_exists(pk)"
        kwargs = {"Key": {"pk": pk}, "UpdateExpression": expr.strip(),
                  "ConditionExpression": cond, "ExpressionAttributeNames": names}
        if values:
            kwargs["ExpressionAttributeValues"] = values
        try:
            self.t.update_item(**kwargs)
            return True
        except self.ClientError as e:
            if _is_conditional_failure(e):
                return False
            raise

    def increment(self, pk, field, limit, ttl=None):
        expr = "ADD #c :one"
        names, values = {"#c": field}, {":one": 1, ":lim": limit}
        if ttl:
            expr = "SET #t = :ttl ADD #c :one"
            names["#t"], values[":ttl"] = "ttl", ttl
        try:
            self.t.update_item(
                Key={"pk": pk}, UpdateExpression=expr,
                ConditionExpression="attribute_not_exists(#c) OR #c < :lim",
                ExpressionAttributeNames=names, ExpressionAttributeValues=values)
            return True
        except self.ClientError as e:
            if _is_conditional_failure(e):
                return False
            raise

    def decrement(self, pk, field):
        try:
            self.t.update_item(
                Key={"pk": pk}, UpdateExpression="ADD #c :m",
                ConditionExpression="#c > :zero",
                ExpressionAttributeNames={"#c": field},
                ExpressionAttributeValues={":m": -1, ":zero": 0})
        except self.ClientError as e:
            if not _is_conditional_failure(e):
                raise


class S3Blob:
    def __init__(self, bucket):
        import boto3
        from botocore.config import Config
        from botocore.exceptions import ClientError
        self.bucket = bucket
        self.s3 = boto3.client("s3", config=Config(signature_version="s3v4"))
        self.ClientError = ClientError

    def presign_upload(self, key, max_bytes, expires):
        return self.s3.generate_presigned_post(
            self.bucket, key, ExpiresIn=expires,
            Conditions=[["content-length-range", 1, max_bytes]])

    def presign_download(self, key, filename, expires):
        return self.s3.generate_presigned_url(
            "get_object", ExpiresIn=expires,
            Params={"Bucket": self.bucket, "Key": key,
                    "ResponseContentDisposition": f'attachment; filename="{filename}"'})

    def size(self, key):
        try:
            return self.s3.head_object(Bucket=self.bucket, Key=key)["ContentLength"]
        except self.ClientError as e:
            if e.response["Error"]["Code"] in ("404", "NoSuchKey", "NotFound"):
                return None
            raise

    def put_json(self, key, data):
        self.s3.put_object(Bucket=self.bucket, Key=key, Body=json.dumps(data).encode(),
                           ContentType="application/json")


class StepFunctions:
    def __init__(self, process_arn, export_arn):
        import boto3
        self.sfn = boto3.client("stepfunctions")
        self.arns = {"process": process_arn, "export": export_arn}

    def start(self, kind, name, payload):
        res = self.sfn.start_execution(stateMachineArn=self.arns[kind],
                                       name=f"{kind}-{name}-{int(time.time())}"[:80],
                                       input=json.dumps(payload))
        return res["executionArn"]


class CloudflareTurnstile:
    URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

    def __init__(self, secret_param):
        self.param, self._secret = secret_param, None

    def _get_secret(self):
        if self._secret is None:
            import boto3
            self._secret = boto3.client("ssm").get_parameter(
                Name=self.param, WithDecryption=True)["Parameter"]["Value"]
        return self._secret

    def verify(self, token, ip):
        data = urllib.parse.urlencode({"secret": self._get_secret(), "response": token,
                                       "remoteip": ip}).encode()
        req = urllib.request.Request(self.URL, data=data)
        with urllib.request.urlopen(req, timeout=5) as r:
            return json.loads(r.read())
