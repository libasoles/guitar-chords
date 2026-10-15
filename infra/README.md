# Backend infrastructure (CDK, Python, us-east-1)

Stacks:

- `GuitarChordsBackend`: bucket (1-day lifecycle), DynamoDB (TTL), engine Lambda (arm64 image from `backend/engine`),
  Fargate OCR task (arm64, 2 vCPU / 8 GB, image from `backend/ocr`), Step Functions (process, export),
  HTTP API, $10/month budget.
- `GuitarChordsCiRole`: GitHub OIDC provider + deploy role, trust limited to
  `repo:libasoles/guitar-chords:ref:refs/heads/main`. Deployed by hand once; CI never deploys it.

## Local checks

```sh
python3 -m venv /tmp/cdkvenv && /tmp/cdkvenv/bin/pip install -r requirements.txt
/tmp/cdkvenv/bin/python -m pytest tests      # template assertions
python3 -m unittest discover -s ../backend/api/tests   # API handler tests
```

## One-time owner steps

1. `cdk bootstrap aws://<account>/us-east-1` (once per account).
2. `cdk deploy GuitarChordsCiRole` (add `-c create_github_oidc_provider=false` if the account already has the
   GitHub OIDC provider). Copy the `DeployRoleArn` output into the GitHub repo variable `AWS_DEPLOY_ROLE_ARN`.
3. First `cdk deploy GuitarChordsBackend` by hand (requires `backend/engine` and `backend/ocr` Dockerfiles).
4. Load the Turnstile secret yourself, never via chat or repo:
   `aws ssm put-parameter --name /guitar-chords/turnstile-secret --type SecureString --value ... --region us-east-1`
   (type it at a prompt or use `--cli-input-json` from a file kept out of history).
5. Confirm the AWS Budgets email subscription (50% / 100% alerts to gperez78@gmail.com).
6. Set the site build variables: API URL (`ApiUrl` output) and Turnstile site key.

The budget flag: at 100% the SNS topic invokes the events Lambda, which sets `flag#budget` until the first
of next month (UTC). To resume earlier, delete the `flag#budget` item in the table.
