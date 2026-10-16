import json
import os
import sys
import tempfile

import aws_cdk as cdk
import pytest
from aws_cdk.assertions import Match, Template

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from guitar_chords.backend_stack import BackendStack  # noqa: E402
from guitar_chords.ci_role_stack import CiRoleStack  # noqa: E402

API_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "backend", "api")


@pytest.fixture(scope="module")
def template():
    tmp = tempfile.mkdtemp()
    for name in ("engine", "ocr"):
        os.makedirs(os.path.join(tmp, name))
        with open(os.path.join(tmp, name, "Dockerfile"), "w") as f:
            f.write("FROM scratch\n")
    app = cdk.App()
    stack = BackendStack(app, "T", api_dir=API_DIR, engine_dir=os.path.join(tmp, "engine"),
                         ocr_dir=os.path.join(tmp, "ocr"),
                         env=cdk.Environment(account="123456789012", region="us-east-1"))
    return Template.from_stack(stack)


def test_bucket_private_with_one_day_lifecycle(template):
    template.has_resource_properties("AWS::S3::Bucket", {
        "PublicAccessBlockConfiguration": {"BlockPublicAcls": True, "BlockPublicPolicy": True,
                                           "IgnorePublicAcls": True, "RestrictPublicBuckets": True},
        "LifecycleConfiguration": {"Rules": Match.array_with([Match.object_like(
            {"ExpirationInDays": 1, "Status": "Enabled"})])}})


def test_table_ttl(template):
    template.has_resource_properties("AWS::DynamoDB::Table", {
        "TimeToLiveSpecification": {"AttributeName": "ttl", "Enabled": True},
        "BillingMode": "PAY_PER_REQUEST"})


def test_engine_lambda_container_arm64(template):
    template.has_resource_properties("AWS::Lambda::Function", {
        "PackageType": "Image", "Architectures": ["arm64"]})


def test_fargate_ocr_task_arm64_2vcpu_8gb(template):
    template.has_resource_properties("AWS::ECS::TaskDefinition", {
        "Cpu": "2048", "Memory": "8192", "RequiresCompatibilities": ["FARGATE"],
        "RuntimePlatform": {"CpuArchitecture": "ARM64", "OperatingSystemFamily": "LINUX"}})


def test_execution_failure_rule_targets_events_lambda(template):
    template.has_resource_properties("AWS::Events::Rule", {
        "EventPattern": Match.object_like({
            "source": ["aws.states"],
            "detail-type": ["Step Functions Execution Status Change"],
            "detail": Match.object_like({"status": ["TIMED_OUT", "FAILED", "ABORTED"]})})})


def test_no_nat_or_load_balancer(template):
    template.resource_count_is("AWS::EC2::NatGateway", 0)
    template.resource_count_is("AWS::ElasticLoadBalancingV2::LoadBalancer", 0)


def test_standard_state_machines_with_15_minute_timeout_and_catch(template):
    machines = template.find_resources("AWS::StepFunctions::StateMachine")
    assert len(machines) == 2
    for res in machines.values():
        assert res["Properties"].get("StateMachineType", "STANDARD") == "STANDARD"
        definition = json.dumps(res["Properties"]["DefinitionString"])
        assert '\\"TimeoutSeconds\\":900' in definition
        assert "States.ALL" in definition and "MarkFailed" in definition
    assert any("ecs:runTask" in json.dumps(r["Properties"]["DefinitionString"])
               for r in machines.values())


def test_http_api_routes_and_cors(template):
    template.has_resource_properties("AWS::ApiGatewayV2::Api", {
        "ProtocolType": "HTTP",
        "CorsConfiguration": Match.object_like({
            "AllowOrigins": Match.array_with(["https://acordesdeguitarra.com.ar", "http://localhost:5173"])})})
    routes = {r["Properties"]["RouteKey"] for r in
              template.find_resources("AWS::ApiGatewayV2::Route").values()}
    assert routes == {"POST /jobs", "POST /jobs/{id}/process", "GET /jobs/{id}",
                      "POST /jobs/{id}/export", "GET /jobs/{id}/downloads"}


def test_turnstile_secret_is_only_referenced_by_name(template):
    text = json.dumps(template.to_json())
    assert "/guitar-chords/turnstile-secret" in text
    template.resource_count_is("AWS::SSM::Parameter", 0)


def test_budget_ten_dollars_alerts_and_pause_subscriber(template):
    template.has_resource_properties("AWS::Budgets::Budget", {
        "Budget": Match.object_like({"BudgetLimit": {"Amount": 10, "Unit": "USD"}, "TimeUnit": "MONTHLY"}),
        "NotificationsWithSubscribers": [
            Match.object_like({"Notification": Match.object_like({"Threshold": 50}),
                               "Subscribers": [{"SubscriptionType": "EMAIL", "Address": "gperez78@gmail.com"}]}),
            Match.object_like({"Notification": Match.object_like({"Threshold": 100}),
                               "Subscribers": Match.array_with(
                                   [{"SubscriptionType": "EMAIL", "Address": "gperez78@gmail.com"}])}),
        ]})
    template.has_resource_properties("AWS::SNS::Subscription", {"Protocol": "lambda"})


def test_ci_role_trust_limited_to_repo_main():
    app = cdk.App()
    stack = CiRoleStack(app, "R", env=cdk.Environment(account="123456789012", region="us-east-1"))
    t = Template.from_stack(stack)
    t.has_resource_properties("AWS::IAM::Role", {"AssumeRolePolicyDocument": {"Statement": [Match.object_like({
        "Action": "sts:AssumeRoleWithWebIdentity",
        "Condition": {"StringEquals": {
            "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
            "token.actions.githubusercontent.com:sub": "repo:libasoles/guitar-chords:ref:refs/heads/main"}}})]}})


def test_engine_lambda_memory_timeout_tmp(template):
    template.has_resource_properties("AWS::Lambda::Function", {
        "PackageType": "Image", "MemorySize": 2048, "Timeout": 120,
        "EphemeralStorage": {"Size": 1024}})


def test_ocr_container_env_from_state_input(template):
    text = json.dumps(template.to_json())
    for name in ("BUCKET", "INPUT_KEY", "OUTPUT_PREFIX"):
        assert f"$.ocr.{name}" in text
    assert "OMR_MAX_HEAP_MB" in text and "OCR_EVENT" not in text


def test_engine_tasks_receive_state_input_object_not_literal_path(template):
    # payload_response_only + from_json_path_at rendered Parameters as the string "$.prepare".
    machines = template.find_resources("AWS::StepFunctions::StateMachine")
    states = {}
    for res in machines.values():
        parts = res["Properties"]["DefinitionString"]["Fn::Join"][1]
        definition = json.loads("".join(p if isinstance(p, str) else "x" for p in parts))
        states.update(definition["States"])
    for name, path in (("Prepare", "$.prepare"), ("Export", "$.export")):
        assert states[name]["InputPath"] == path
        assert not isinstance(states[name].get("Parameters"), str)
