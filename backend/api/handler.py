"""Lambda entry point. Handles:
 - API Gateway HTTP API v2 events (public API)
 - {"internal": ...} direct invocations from Step Functions
 - SNS records from the AWS Budgets topic (sets the budget_paused flag)
"""
import calendar
import os
import time

import core

_service = None


def _next_month_start(now):
    t = time.gmtime(now)
    year, month = (t.tm_year + 1, 1) if t.tm_mon == 12 else (t.tm_year, t.tm_mon + 1)
    return calendar.timegm((year, month, 1, 0, 0, 0))


def _csv(name, default):
    return tuple(filter(None, os.environ.get(name, "").split(","))) or default


def build_service():
    import adapters
    env = os.environ
    defaults = core.Config()
    cfg = core.Config(
        bucket=env["BUCKET"],
        allowed_origins=_csv("ALLOWED_ORIGINS", defaults.allowed_origins),
        turnstile_hostnames=_csv("TURNSTILE_HOSTNAMES", defaults.turnstile_hostnames),
        turnstile_action=env.get("TURNSTILE_ACTION", defaults.turnstile_action),
        salt=env.get("IP_SALT", ""),
    )
    return core.Service(
        adapters.DynamoStore(env["TABLE"]), adapters.S3Blob(env["BUCKET"]),
        adapters.StepFunctions(env.get("PROCESS_SM_ARN", ""), env.get("EXPORT_SM_ARN", "")),
        adapters.CloudflareTurnstile(env.get("TURNSTILE_SECRET_PARAM", "")), cfg, time.time)


def dispatch(svc, event):
    if "internal" in event:
        return svc.internal(event)
    records = event.get("Records")
    if records and records[0].get("EventSource") == "aws:sns":
        svc.set_budget_paused(until=_next_month_start(svc.clock()))
        return {"ok": True}
    return core.handle_http(svc, event)


def lambda_handler(event, context):
    global _service
    if _service is None:
        _service = build_service()
    return dispatch(_service, event)
