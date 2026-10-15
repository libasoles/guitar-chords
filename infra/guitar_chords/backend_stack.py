"""Backend stack for /partitura-y-tablatura (us-east-1, arm64).

S3 (1-day lifecycle) + DynamoDB (TTL) + engine Lambda (container) +
Fargate OCR task (public subnet, no NAT/ALB) + Step Functions (process/export)
+ HTTP API + Budget with a pause flag.
"""
from aws_cdk import (
    Duration, RemovalPolicy, Size, Stack, CfnOutput,
    aws_apigatewayv2 as apigw,
    aws_apigatewayv2_integrations as integrations,
    aws_budgets as budgets,
    aws_dynamodb as dynamodb,
    aws_ec2 as ec2,
    aws_ecs as ecs,
    aws_iam as iam,
    aws_lambda as lambda_,
    aws_logs as logs,
    aws_s3 as s3,
    aws_sns as sns,
    aws_sns_subscriptions as subs,
    aws_stepfunctions as sfn,
    aws_stepfunctions_tasks as tasks,
)
from constructs import Construct

SITE_ORIGINS = ["https://acordesdeguitarra.com.ar", "https://www.acordesdeguitarra.com.ar"]
DEV_ORIGINS = [f"http://localhost:{p}" for p in (3000, 4173, 5173, 8000, 8080)]
TURNSTILE_PARAM = "/guitar-chords/turnstile-secret"
PROCESS_TIMEOUT = Duration.minutes(15)


class BackendStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, *, engine_dir: str, ocr_dir: str,
                 api_dir: str, alert_email: str = "gperez78@gmail.com", **kwargs):
        super().__init__(scope, construct_id, **kwargs)
        origins = SITE_ORIGINS + DEV_ORIGINS

        # ---- storage
        bucket = s3.Bucket(
            self, "Files", block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            encryption=s3.BucketEncryption.S3_MANAGED, enforce_ssl=True,
            removal_policy=RemovalPolicy.DESTROY,
            lifecycle_rules=[s3.LifecycleRule(
                expiration=Duration.days(1),
                abort_incomplete_multipart_upload_after=Duration.days(1))],
            cors=[s3.CorsRule(allowed_methods=[s3.HttpMethods.POST, s3.HttpMethods.GET],
                              allowed_origins=origins, allowed_headers=["*"], max_age=3600)])
        table = dynamodb.Table(
            self, "Jobs", partition_key=dynamodb.Attribute(name="pk", type=dynamodb.AttributeType.STRING),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST, time_to_live_attribute="ttl",
            removal_policy=RemovalPolicy.DESTROY)

        # ---- API Lambda code (same package: public API + internal events)
        common_env = {"BUCKET": bucket.bucket_name, "TABLE": table.table_name,
                      "ALLOWED_ORIGINS": ",".join(origins),
                      "TURNSTILE_SECRET_PARAM": TURNSTILE_PARAM,
                      "TURNSTILE_ACTION": "partitura-tablatura"}

        def api_function(name: str, **extra) -> lambda_.Function:
            fn = lambda_.Function(
                self, name, runtime=lambda_.Runtime.PYTHON_3_12, architecture=lambda_.Architecture.ARM_64,
                handler="handler.lambda_handler", memory_size=256, timeout=Duration.seconds(20),
                code=lambda_.Code.from_asset(api_dir, exclude=["tests", "__pycache__", "*.txt"]),
                environment={**common_env, **extra}, log_retention=logs.RetentionDays.ONE_MONTH)
            bucket.grant_read_write(fn)
            table.grant_read_write_data(fn)
            return fn

        # Receives Step Functions / Budget events. Kept separate from the public
        # function so the state machines do not create a dependency cycle.
        events_fn = api_function("JobEventsFunction")

        # ---- engine Lambda (container, arm64, no Java)
        engine_fn = lambda_.DockerImageFunction(
            self, "EngineFunction",
            code=lambda_.DockerImageCode.from_image_asset(engine_dir, platform=_arm64_platform()),
            architecture=lambda_.Architecture.ARM_64, memory_size=2048, timeout=Duration.seconds(120),
            ephemeral_storage_size=Size.gibibytes(1),
            log_retention=logs.RetentionDays.ONE_MONTH)
        bucket.grant_read_write(engine_fn)

        # ---- OCR Fargate task: public subnet + public IP, no NAT, no ALB, no ingress
        vpc = ec2.Vpc(self, "Vpc", max_azs=2, nat_gateways=0,
                      subnet_configuration=[ec2.SubnetConfiguration(
                          name="public", subnet_type=ec2.SubnetType.PUBLIC, cidr_mask=24)])
        cluster = ecs.Cluster(self, "Cluster", vpc=vpc)
        ocr_sg = ec2.SecurityGroup(self, "OcrSg", vpc=vpc, allow_all_outbound=True,
                                   description="OCR task: egress only")
        task_def = ecs.FargateTaskDefinition(
            self, "OcrTask", cpu=2048, memory_limit_mib=8192,
            runtime_platform=ecs.RuntimePlatform(
                cpu_architecture=ecs.CpuArchitecture.ARM64,
                operating_system_family=ecs.OperatingSystemFamily.LINUX))
        task_def.add_container(
            "ocr", image=ecs.ContainerImage.from_asset(ocr_dir, platform=_arm64_platform()),
            environment={"OMR_MAX_HEAP_MB": "5120", "OMR_TIMEOUT_SECONDS": "780"},
            logging=ecs.LogDrivers.aws_logs(stream_prefix="ocr", log_retention=logs.RetentionDays.ONE_MONTH))
        bucket.grant_read_write(task_def.task_role)

        # ---- Step Functions
        def invoke_events(name: str, payload: dict, **kw) -> tasks.LambdaInvoke:
            return tasks.LambdaInvoke(self, name, lambda_function=events_fn,
                                      payload=sfn.TaskInput.from_object(payload),
                                      result_path=sfn.JsonPath.DISCARD, **kw)

        job_id = sfn.JsonPath.string_at("$.jobId")

        def engine_task(name: str, input_path: str, timeout: Duration) -> tasks.LambdaInvoke:
            return tasks.LambdaInvoke(
                self, name, lambda_function=engine_fn, payload=sfn.TaskInput.from_json_path_at(input_path),
                payload_response_only=True, result_path="$.engineResult",
                task_timeout=sfn.Timeout.duration(timeout))

        def complete(name: str, action: str) -> tasks.LambdaInvoke:
            return invoke_events(name, {"internal": "complete", "action": action, "jobId": job_id,
                                        "result": sfn.JsonPath.object_at("$.engineResult")})

        # process: PDF -> OCR -> prepare ; MusicXML -> prepare
        process_fail = invoke_events("ProcessMarkFailed", {
            "internal": "fail", "jobId": job_id, "error": sfn.JsonPath.object_at("$.error")})
        process_fail.next(sfn.Fail(self, "ProcessFailed", error="JobFailed"))
        ocr = tasks.EcsRunTask(
            self, "Ocr", cluster=cluster, task_definition=task_def,
            launch_target=tasks.EcsFargateLaunchTarget(platform_version=ecs.FargatePlatformVersion.LATEST),
            assign_public_ip=True, subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PUBLIC),
            security_groups=[ocr_sg], integration_pattern=sfn.IntegrationPattern.RUN_JOB,
            container_overrides=[tasks.ContainerOverride(
                container_definition=task_def.default_container,
                environment=[
                    tasks.TaskEnvironmentVariable(
                        name=name, value=sfn.JsonPath.string_at(f"$.ocr.{name}"))
                    for name in ("BUCKET", "INPUT_KEY", "OUTPUT_PREFIX")])],
            # Audiveris self-kills at OMR_TIMEOUT_SECONDS (780s, exit 2 -> omr_failed);
            # this is only the backstop, below the 15 min machine timeout.
            result_path=sfn.JsonPath.DISCARD, task_timeout=sfn.Timeout.duration(Duration.minutes(14)))
        stage_preparing = invoke_events("StagePreparing", {
            "internal": "stage", "jobId": job_id, "stage": "preparing"})
        prepare = engine_task("Prepare", "$.prepare", Duration.seconds(150))
        process_done = complete("ProcessComplete", "process")
        for state in (ocr, stage_preparing, prepare, process_done):
            state.add_catch(process_fail, result_path="$.error")
        prepare.next(process_done)
        process_done.next(sfn.Succeed(self, "ProcessSucceeded"))
        ocr.next(stage_preparing).next(prepare)
        process_def = sfn.Choice(self, "IsPdf").when(
            sfn.Condition.string_equals("$.kind", "pdf"), ocr).otherwise(prepare)
        process_sm = sfn.StateMachine(
            self, "ProcessMachine", state_machine_type=sfn.StateMachineType.STANDARD,
            definition_body=sfn.DefinitionBody.from_chainable(process_def), timeout=PROCESS_TIMEOUT)

        # export
        export_fail = invoke_events("ExportMarkFailed", {
            "internal": "fail", "jobId": job_id, "error": sfn.JsonPath.object_at("$.error")})
        export_fail.next(sfn.Fail(self, "ExportFailed", error="JobFailed"))
        export = engine_task("Export", "$.export", Duration.seconds(150))
        export_done = complete("ExportComplete", "export")
        for state in (export, export_done):
            state.add_catch(export_fail, result_path="$.error")
        export_done.next(sfn.Succeed(self, "ExportSucceeded"))
        export_sm = sfn.StateMachine(
            self, "ExportMachine", state_machine_type=sfn.StateMachineType.STANDARD,
            definition_body=sfn.DefinitionBody.from_chainable(export.next(export_done)),
            timeout=PROCESS_TIMEOUT)

        # ---- public API function
        api_fn = api_function("ApiFunction", PROCESS_SM_ARN=process_sm.state_machine_arn,
                              EXPORT_SM_ARN=export_sm.state_machine_arn)
        process_sm.grant_start_execution(api_fn)
        export_sm.grant_start_execution(api_fn)
        param_arn = self.format_arn(service="ssm", resource="parameter",
                                    resource_name=TURNSTILE_PARAM.lstrip("/"))
        api_fn.add_to_role_policy(iam.PolicyStatement(actions=["ssm:GetParameter"], resources=[param_arn]))

        # ---- HTTP API (default execute-api URL)
        http_api = apigw.HttpApi(
            self, "Api", api_name="guitar-chords-partitura",
            cors_preflight=apigw.CorsPreflightOptions(
                allow_origins=origins, allow_methods=[apigw.CorsHttpMethod.GET, apigw.CorsHttpMethod.POST,
                                                      apigw.CorsHttpMethod.OPTIONS],
                allow_headers=["content-type"], max_age=Duration.days(1)))
        integration = integrations.HttpLambdaIntegration("ApiIntegration", api_fn)
        for path, method in (("/jobs", apigw.HttpMethod.POST),
                             ("/jobs/{id}/process", apigw.HttpMethod.POST),
                             ("/jobs/{id}", apigw.HttpMethod.GET),
                             ("/jobs/{id}/export", apigw.HttpMethod.POST),
                             ("/jobs/{id}/downloads", apigw.HttpMethod.GET)):
            http_api.add_routes(path=path, methods=[method], integration=integration)
        stage = http_api.default_stage.node.default_child
        stage.default_route_settings = apigw.CfnStage.RouteSettingsProperty(
            throttling_burst_limit=20, throttling_rate_limit=10)

        # ---- Budget: $10/month, email 50%/100%, 100% -> SNS -> pause flag
        topic = sns.Topic(self, "BudgetTopic")
        topic.add_to_resource_policy(iam.PolicyStatement(
            principals=[iam.ServicePrincipal("budgets.amazonaws.com")], actions=["sns:Publish"],
            resources=[topic.topic_arn],
            conditions={"StringEquals": {"aws:SourceAccount": self.account}}))
        topic.add_subscription(subs.LambdaSubscription(events_fn))
        email = budgets.CfnBudget.SubscriberProperty(subscription_type="EMAIL", address=alert_email)
        sns_sub = budgets.CfnBudget.SubscriberProperty(subscription_type="SNS", address=topic.topic_arn)

        def notification(threshold: int, subscribers: list) -> budgets.CfnBudget.NotificationWithSubscribersProperty:
            return budgets.CfnBudget.NotificationWithSubscribersProperty(
                notification=budgets.CfnBudget.NotificationProperty(
                    notification_type="ACTUAL", comparison_operator="GREATER_THAN",
                    threshold=threshold, threshold_type="PERCENTAGE"),
                subscribers=subscribers)

        budgets.CfnBudget(
            self, "MonthlyBudget",
            budget=budgets.CfnBudget.BudgetDataProperty(
                budget_name="guitar-chords-monthly", budget_type="COST", time_unit="MONTHLY",
                budget_limit=budgets.CfnBudget.SpendProperty(amount=10, unit="USD")),
            notifications_with_subscribers=[notification(50, [email]), notification(100, [email, sns_sub])])

        CfnOutput(self, "ApiUrl", value=http_api.api_endpoint)
        CfnOutput(self, "BucketName", value=bucket.bucket_name)
        CfnOutput(self, "TurnstileSecretParameter", value=TURNSTILE_PARAM)
        self.bucket, self.table, self.process_machine, self.export_machine = bucket, table, process_sm, export_sm


def _arm64_platform():
    from aws_cdk import aws_ecr_assets as ecr_assets
    return ecr_assets.Platform.LINUX_ARM64
