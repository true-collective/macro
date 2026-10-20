# G1 service map (Sliplane)

Base: `eeaa05d5403a84d7e2c4fd39092fbc969b03a0f9`

Sliplane project (to create): `tc-macro` on server `true-collective`.  
Private hostname pattern: `<service-name>.internal`.

## Must run for G1

| Proposed Sliplane name | Image / source | Public? | Volume | Depends on |
| --- | --- | --- | --- | --- |
| `tc-macro-gateway` | nginx/Caddy TC config | yes HTTP | no | backends healthy |
| `tc-macro-web` | built `apps/web` | via gateway | no | gateway routes |
| `tc-macro-postgres` | `pgvector/pgvector:pg18` | no | yes `/var/lib/postgresql` | — |
| `tc-macro-redis` | `redis/redis-stack` slim or redis | no | yes | — |
| `tc-macro-kafka` | `apache/kafka:3.9.1` | no | yes | — |
| `tc-macro-opensearch` | TC-built OpenSearch image | no | yes | — |
| `tc-macro-fusionauth-db` | `postgres:16` | no | yes | — |
| `tc-macro-fusionauth` | `fusionauth/fusionauth-app:1.62.1` | no | yes config | fusionauth-db |
| `tc-macro-auth` | rust `authentication_service` | no | no | postgres, redis, fusionauth |
| `tc-macro-dss` | `document_storage_service` | no | no | postgres, object store |
| `tc-macro-lexical` | lexical-service image | no | no | — |
| `tc-macro-ws` | websocket-service | no | no | — |
| `tc-macro-connection-gw` | connection_gateway | no | no | redis, DynamoDB-compat |
| `tc-macro-search` | search_processing_service | no | no | kafka, opensearch |
| `tc-macro-agent` | agent_harness_service | no | no | model API, postgres |
| `tc-macro-static` | static_file_service | no | no | object store |
| `tc-macro-preview` | preview_gateway | no | no | — |
| `tc-macro-notify` | notification_service | no | no | — |
| `tc-macro-sync` (sync-service) | Cloudflare Worker `[env.tc]` | CF edge | DO/D1/KV/R2 | TC CF resources created; deploy pending account-id in AKV |

## External / decision (not inventable as Docker-only)

| Need | Options |
| --- | --- |
| Object storage | Sliplane bucket (paid) or TC AWS S3 — prove presigned URL/CORS |
| SQS / DynamoDB / KMS | TC AWS account **or** explicit porting project |
| Auth mail | Transactional provider (not Phase-2 M365) |
| LLM | Authorized model account |
| Capacity | Server headroom insufficient for naïve full stack — Stefan package |

## Explicitly out of G1 runtime

`email_service`, `calendar_service`, Slack import, MCP public surface, analytics, LocalStack, Mailpit, Datadog/Jaeger/LGTM, headless Chrome. Disable in TC config profile; verify startup does not call Macro hosted `*-dev`.
