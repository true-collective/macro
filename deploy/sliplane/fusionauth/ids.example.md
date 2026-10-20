# Non-secret FusionAuth identity pins (example)

Generate once, store secrets separately, put **ids** here or in config (ids are not secrets).
Do not commit real `TC_FA_API_KEY` / JWT / client secrets.

Suggested generation:

```bash
python3 - <<'PY'
import uuid
for name in [
  "TC_FA_TENANT_ID",
  "TC_FA_APPLICATION_ID",
  "TC_FA_JWT_KEY_ID",
  "TC_FA_JWT_LAMBDA_ID",
  "TC_FA_PASSWORDLESS_TEMPLATE_ID",
]:
    print(f"{name}={uuid.uuid4()}")
PY
```

Record chosen values in **True Collective Azure Key Vault** (`tc-macro/fusionauth/*`)
alongside SMTP when Decision D is approved. Do not deploy FA until SMTP is present.
