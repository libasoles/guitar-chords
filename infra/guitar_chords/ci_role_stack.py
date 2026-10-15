"""GitHub Actions OIDC deploy role. Deployed once by hand (cdk deploy
GuitarChordsCiRole); the workflow only deploys GuitarChordsBackend, so the
role never modifies itself."""
from aws_cdk import CfnOutput, Duration, Stack, aws_iam as iam
from constructs import Construct

REPO = "libasoles/guitar-chords"
OIDC_HOST = "token.actions.githubusercontent.com"


class CiRoleStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, *, create_provider: bool = True,
                 repo: str = REPO, **kwargs):
        super().__init__(scope, construct_id, **kwargs)
        if create_provider:
            provider = iam.OpenIdConnectProvider(
                self, "GithubOidc", url=f"https://{OIDC_HOST}", client_ids=["sts.amazonaws.com"])
            provider_arn = provider.open_id_connect_provider_arn
        else:
            provider_arn = f"arn:aws:iam::{self.account}:oidc-provider/{OIDC_HOST}"

        principal = iam.FederatedPrincipal(
            provider_arn,
            conditions={
                "StringEquals": {f"{OIDC_HOST}:aud": "sts.amazonaws.com",
                                 f"{OIDC_HOST}:sub": f"repo:{repo}:ref:refs/heads/main"}},
            assume_role_action="sts:AssumeRoleWithWebIdentity")
        role = iam.Role(self, "DeployRole", role_name="guitar-chords-github-deploy",
                        assumed_by=principal, max_session_duration=Duration.hours(1))
        # CDK deploys through the bootstrap roles; nothing else is granted.
        role.add_to_policy(iam.PolicyStatement(
            actions=["sts:AssumeRole"],
            resources=[f"arn:aws:iam::{self.account}:role/cdk-*"]))
        role.add_to_policy(iam.PolicyStatement(
            actions=["cloudformation:DescribeStacks"],
            resources=[f"arn:aws:cloudformation:{self.region}:{self.account}:stack/CDKToolkit/*"]))
        CfnOutput(self, "DeployRoleArn", value=role.role_arn)
