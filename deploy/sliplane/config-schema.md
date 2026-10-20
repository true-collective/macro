# TC Macro config schema (names only)

No secret **values** belong in this file, in git, or in chat. Store values in
**True Collective Azure Key Vault** (prefix `tc-macro/`). Infisical is not used
for Macro. Reference by vault path / Sliplane secret name / Cloudflare binding id.

## Runtime profile

| Key | Required for G1 | Notes |
| --- | --- | --- |
| `ENVIRONMENT` | yes | TC value, not `dev`/`prod` Macro-hosted |
| `OVERRIDE_*` service URLs | yes | Point at `*.internal` / TC public origin only |
| Feature flags disabling email/calendar/CRM write | yes | Explicit off |

## Datastores

| Key name (category) | Required |
| --- | --- |
| MacroDB URL / user / password / db name | yes |
| Redis host/port/(password) | yes |
| Kafka bootstrap | yes |
| OpenSearch URL + credentials | yes |
| FusionAuth URL + API key + application/tenant ids | yes |
| Object storage endpoint, region, bucket names, access key **ids** | yes |
| Queue URLs / DynamoDB table names / KMS key ids | yes (or blocked until AWS/port decision) |

## Auth & mail

| Key name (category) | Required |
| --- | --- |
| Authentication service signing secrets | yes |
| FusionAuth kickstart / admin credentials | yes |
| Transactional mail provider API key | yes |
| Web origin / cookie domain / OAuth redirect allowlist for **auth** | yes |

## Agents

| Key name (category) | Required |
| --- | --- |
| LLM provider API key(s) | yes for G1 agentchat criterion |
| Internal API keys between services | yes |

## Sync (Cloudflare)

| Key name (category) | Required | Notes |
| --- | --- | --- |
| `tc-macro/cf/account-id` | yes | Dashboard; not returned by bindings MCP |
| `tc-macro/cf/api-token` | yes | Token **name**/path only in git |
| Worker secrets: `INTERNAL_API_SECRET_KEY`, DSS/Lexical auth | yes | `wrangler secret put --env tc` |
| Public DSS/Lexical/SPS URLs | yes | `https://tc-macro-gateway.sliplane.app/...` — never `*.internal` |
| D1 / KV / R2 / DO binding ids | yes | See `[env.tc]` in `services/sync-service/wrangler.toml` |

## Azure Key Vault (Macro keystore)

| Path prefix | Purpose |
| --- | --- |
| `tc-macro/fusionauth/*` | SMTP + FA kickstart secrets |
| `tc-macro/cf/*` | Account id + API token |
| `tc-macro/llm/anthropic-api-key` | Agent harness |
| `tc-macro/aws/*` | S3/SQS/DDB/KMS |
| `tc-macro/db/*`, `tc-macro/redis/*`, `tc-macro/internal-api-key` | Datastores + service auth |

Sliplane has no native AKV pull: copy vault → Sliplane/`wrangler` secrets at deploy time.

## Sliplane platform

| Key | Notes |
| --- | --- |
| `PORT` | Per public/private HTTP service as required by Sliplane |
| `SLIPLANE_DOMAIN` | Injected by platform |
| Deploy hook URL | Treat as secret |
