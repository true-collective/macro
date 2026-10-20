# TC release adapter (draft)

## Image tags

- Build from pinned git SHA only.
- Publish to GHCR (or TC registry) as `…:sha-<full40>` and record digest.
- Never deploy mutable `latest` to staging/production.

## Order

1. Infra volumes + Postgres/Redis/Kafka/OpenSearch/FusionAuth-DB healthy
2. Run MacroDB migrations **once** with lock/fence
3. FusionAuth kickstart / config (production mode)
4. Private app services
5. Cloudflare sync-service deploy (TC account)
6. Public gateway/web
7. Smoke + G1 accept (`accept-g1.md`)
8. Write release receipt: phase, SHA, digests, Sliplane deployment ids, migration version, backup evidence, failures

## Rollback

- Redeploy previous digests for stateless services.
- Restore Postgres dump (preferred) or volume backup into isolated env before production rewind.
- Volume-backed deploys imply stop/start downtime — document window.

## Forbidden triggers

Do not enable upstream `deploy_on_push.yml` / Pulumi production against TC.
