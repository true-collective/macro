# Building Macro service images for Sliplane (TC)

Upstream production uses nix + Pulumi. TC must **not** enable those deploy workflows.

## Preferred path

1. CI (GitHub Actions on the TC fork) builds Linux binaries with the repo’s nix/zig toolchain for the pinned SHA.
2. Publish GHCR images via `docker/Dockerfile.prebuilt` with `SERVICE_NAME=<bin>` and tag `sha-<full40>`.
3. Sliplane services pull those digests (`autoDeploy: false` until promote).

## First services for G1

| Binary / package | Proposed image name |
| --- | --- |
| `authentication_service` | `ghcr.io/<tc>/tc-macro-auth:sha-…` |
| `document_storage_service` | `…-dss` |
| `agent_harness_service` | `…-agent` (no Docker socket mount) |
| `search_processing_service` | `…-search` |
| `notification_service` | `…-notify` |
| `connection_gateway_service` | `…-connection-gw` |
| lexical / websocket / sync | separate Dockerfiles already under `docker/` / CF |

## Local agent note

This cloud runner cannot currently `git push` to the fork as `cursor[bot]`; use GitHub MCP `push_files` / `create_or_update_file` for packaging commits. Heavy nix builds belong in Actions, not on the shared Sliplane server.
