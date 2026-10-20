# FusionAuth deploy gate

**Status:** `tc-macro-fusionauth` is **not** deployed on Sliplane.

Live today: only `tc-macro-fusionauth-db` (Postgres).

## Required before createService

All must exist in **True Collective Azure Key Vault** (`tc-macro/fusionauth/*`), then injected as Sliplane secrets:

- `TC_FA_SMTP_HOST`, `TC_FA_SMTP_PORT`, `TC_FA_SMTP_SECURITY`, `TC_FA_SMTP_USERNAME`, `TC_FA_SMTP_PASSWORD`
- `TC_FA_MAIL_FROM`
- Remaining kickstart vars in `README.md`

Forbidden substitutes: Mailpit, dummy SMTP, M365 Phase 2 mailbox as auth mailer.

When SMTP lands in AKV, deploy proceeds in a follow-up turn — not before.