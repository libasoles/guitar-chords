#!/usr/bin/env python3
import os

import aws_cdk as cdk

from guitar_chords.backend_stack import BackendStack
from guitar_chords.ci_role_stack import CiRoleStack

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
app = cdk.App()
env = cdk.Environment(account=os.environ.get("CDK_DEFAULT_ACCOUNT"), region="us-east-1")

BackendStack(
    app, "GuitarChordsBackend", env=env,
    api_dir=os.path.join(ROOT, "backend", "api"),
    engine_dir=app.node.try_get_context("engine_dir") or os.path.join(ROOT, "backend", "engine"),
    ocr_dir=app.node.try_get_context("ocr_dir") or os.path.join(ROOT, "backend", "ocr"))
CiRoleStack(
    app, "GuitarChordsCiRole", env=env,
    create_provider=app.node.try_get_context("create_github_oidc_provider") != "false")
app.synth()
