# TC Macro — Cloudflare sync-service deploy

Worker script name: `tc-macro-sync`  
Wrangler env: `[env.tc]` in `services/sync-service/wrangler.toml`  
Ban: Miniflare, `wrangler dev` as production, Macro-inc resource UUIDs.

## Resources (MCP-created 2026-10-20)

| Binding | Resource | Id |
| --- | --- | --- |
| `USER_PEER_MAPPING` | D1 `tc-macro-user-peer-mapping` | `7c72c4a7-4cf2-46cb-871a-55150d01c763` |
| `DOCUMENT_VERSIONING_KV` | KV `tc-macro-doc-versioning` | `0f2aa8b3f5d244d4a3209cbf98027e25` |
| `SNAPSHOT_STORE_KV` | KV `tc-macro-snapshot-store` | `94752ca5eca4488db8d24f46027c4f9b` |
| `DOCUMENT_SNAPSHOT_BUCKET` | R2 `tc-macro-document-snapshots` | name |
| `DOCUMENT_SYNC_SESSION` | DO `DocumentSyncSession` | via migration v1 on first deploy |

Cloudflare **account id** is not returned by Project bindings MCP. Read from Azure Key Vault `tc-macro/cf/account-id` (dashboard Workers & Pages → Account Details).

## Deploy steps

1. Export from vault (values never logged):
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_API_TOKEN`
2. From `services/sync-service`:
   ```bash
   npx wrangler secret put INTERNAL_API_SECRET_KEY --env tc
   npx wrangler secret put DSS_INTERNAL_AUTH_KEY --env tc
   npx wrangler secret put LEXICAL_SERVICE_AUTH_KEY --env tc
   npx wrangler deploy --env tc
   ```
3. Run D1 migrations if not applied by deploy (`wrangler d1 migrations apply … --env tc`).
4. Point web client sync URL at the deployed Worker hostname (not the Sliplane gateway).
5. Gateway Caddyfile intentionally does **not** proxy sync — browser talks to CF directly.

## Backend URL rule

Worker vars use `https://tc-macro-gateway.sliplane.app/{dss,lexical,search-processing}`.
Workers cannot resolve Sliplane `*.internal` DNS.
