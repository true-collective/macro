# TC Sliplane packaging (Phase 1)

True Collective deployment adapter for Macro on Sliplane.

- **Pinned base:** `eeaa05d5403a84d7e2c4fd39092fbc969b03a0f9`
- **Host:** existing Dreamers Collective server `true-collective` only
- **Rule:** do not modify other live Sliplane apps or shared datastores
- **Compose:** Sliplane is not a Compose orchestrator — map each container to one service (see [docs.sliplane.io](https://docs.sliplane.io/services/deploying-a-service/))

## Files

| Path | Purpose |
| --- | --- |
| `service-map.md` | G1 services + infra and where each runs |
| `config-schema.md` | Required config keys (names only; Azure Key Vault paths) |
| `accept-g1.md` | Gate G1 accept checklist |
| `RELEASE.md` | Image tagging, migrate order, rollback |
| `SYNC.md` | Cloudflare sync-service `[env.tc]` deploy path |
| `fusionauth/` | FA image + kickstart — **deploy only after SMTP in AKV** |

Secrets: **True Collective Azure Key Vault** (`tc-macro/*`). Infisical unused. Multica out of Macro scope.

Upstream AWS/Pulumi/Doppler deploy workflows stay disabled for TC.
