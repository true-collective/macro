# True Collective Macro — AWS-primary deploy

**Pin:** `eeaa05d5403a84d7e2c4fd39092fbc969b03a0f9`  
**Account:** `155833351761` · **Region:** `us-east-1`  
**Hosting:** TC AWS (Pulumi / ECS Fargate) + Cloudflare sync.  
**Sliplane `tc-macro`:** **frozen** — do not expand; do not delete without Stefan GO. Historical packaging PR is not the primary path.

## Why this folder exists

Upstream `infra/` hardcodes Macro-inc VPC IDs and `macro-inc/…` stack refs. TC needs an adapter layer:

| Concern | TC approach |
| --- | --- |
| VPC | Slice 0 stack below — outputs feed adapter (no Macro-inc IDs) |
| Secrets | Azure Key Vault `tc-macro/*` → AWS Secrets Manager `/tc-macro-sync/…` → ECS `APP_SECRETS_JSON` |
| Pulumi naming | Prefer `true-collective/<project>/<stack>` (not `macro-inc`) |
| State (Slice 0) | S3 `tc-macro-pulumi-state-155833351761` + DynamoDB `tc-macro-pulumi-locks` |

Agents **never** run `pulumi up` / `wrangler deploy` unless Stefan asks in-thread. `pulumi preview` is OK with credentials.

## Slice 0 — foundation (`slice0/`)

Creates:

1. VPC `10.80.0.0/16` — 3 AZ public + private subnets, 1 NAT (staging cost), IGW
2. Secrets Manager secret `/tc-macro-sync/_bootstrap/dev` (manual AKV→SM proof placeholder)
3. Empty ECS cluster `tc-macro-dev`
4. Stack outputs shaped like `get_coparse_api_vpc()` (`vpcId`, `privateSubnetIds`, `publicSubnetIds`)

### Run (Phase 1 VM)

```bash
export AWS_DEFAULT_REGION=us-east-1
export PATH="$HOME/.pulumi/bin:$HOME/.bun/bin:$PATH"
# aws login session → env for Pulumi AWS provider
eval "$(aws configure export-credentials --format env)"
export PULUMI_CONFIG_PASSPHRASE="$(aws secretsmanager get-secret-value \
  --secret-id /tc-macro/pulumi/config-passphrase --query SecretString --output text)"
cd deploy/aws/slice0
bun install
pulumi login "s3://tc-macro-pulumi-state-155833351761?region=us-east-1&awssdk=v2"
pulumi stack select dev   # project tc-macro-foundation; logical org true-collective
pulumi preview
# pulumi up   # Stefan deploy ask
```

**Live Slice 0 (2026-10-20):** VPC `vpc-0dcb058603f786775`, ECS `tc-macro-dev`, SM `/tc-macro-sync/_bootstrap/dev`. Full IDs: agent store `macro-aws-slice0-receipt.md`.

### Adapter

See [`adapter/vpc.ts`](./adapter/vpc.ts) — reads VPC IDs from env / Pulumi config instead of Macro-inc hardcodes. Wire into TC forks of stacks later (Slice 1+).

## Slice 1 — data plane (`slice1/`)

Creates (staging, cost-bounded):

1. ALB + HTTP:80 listener (fixed 503 default — app routes later; HTTPS/ACM deferred)
2. RDS Postgres 16 `db.t4g.micro` (MacroDB) + SM `/tc-macro-sync/macrodb/dev`
3. ElastiCache Redis 7 `cache.t4g.micro` + SM `/tc-macro-sync/redis/dev`
4. Security groups: ALB → ECS:8080 → DB:5432 / Redis:6379

Depends on StackReference `organization/tc-macro-foundation/dev` (DIY S3 backend FQN).

```bash
cd deploy/aws/slice1
bun install
# same export-credentials + PULUMI_CONFIG_PASSPHRASE as Slice 0
pulumi stack select dev || pulumi stack init dev
pulumi up
```

**Live Slice 1 (2026-10-20):** ALB `tc-macro-dev-gw-229005815.us-east-1.elb.amazonaws.com` (503 stub), RDS `tc-macro-dev-macrodb`, Redis `tc-macro-dev-redis`.

## Slice 2 — platform (`slice2/`)

Creates (no MSK/OpenSearch/apps):

1. KMS `alias/tc-macro-dev`
2. S3: documents / static / uploads (KMS SSE, public access blocked)
3. SQS + DLQ: search-upload, document-upload
4. DynamoDB: connection-gateway, static-file (PAY_PER_REQUEST)
5. ECR repos `tc-macro/<service>` for G1 image push (empty)
6. SM inventory `/tc-macro-sync/platform/dev`

```bash
cd deploy/aws/slice2
bun install
pulumi stack select dev || pulumi stack init dev
pulumi up
```

**Live Slice 2 (2026-10-20):** see agent store `macro-aws-slice2-receipt.md`. Monthly budget `tc-macro-staging-monthly` ($200).

### Still blocked for full G1

- **Image builds** (nix) + push into ECR (repos ready)
- FusionAuth + SMTP from AKV
- MSK + OpenSearch (**Stefan paid GO**)
- Real AKV → SM sync for app secrets
- ACM + custom domain for HTTPS
- CF `wrangler deploy --env tc` (needs AKV account-id)

## Out of scope here

MSK, OpenSearch, FusionAuth apps, enabling upstream `deploy_on_push.yml` against TC, Sliplane changes.
