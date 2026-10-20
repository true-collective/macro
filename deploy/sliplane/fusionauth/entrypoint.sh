#!/bin/sh
set -eu

# Required env (secret values from Sliplane; never commit):
REQUIRED="
TC_FA_API_KEY
TC_FA_JWT_SECRET
TC_FA_JWT_KEY_ID
TC_FA_JWT_LAMBDA_ID
TC_FA_APPLICATION_ID
TC_FA_TENANT_ID
TC_FA_CLIENT_SECRET
TC_FA_PASSWORDLESS_TEMPLATE_ID
TC_FA_MAIL_FROM
TC_FA_ISSUER
TC_FA_SMTP_HOST
TC_FA_SMTP_PORT
TC_FA_SMTP_SECURITY
TC_FA_SMTP_USERNAME
TC_FA_SMTP_PASSWORD
TC_FA_OAUTH_REDIRECT_URI
TC_INTERNAL_API_KEY
"

for v in $REQUIRED; do
  eval "val=\${$v-}"
  if [ -z "$val" ]; then
    echo "missing required env: $v" >&2
    exit 1
  fi
done

mkdir -p /usr/local/fusionauth/kickstart

if command -v python3 >/dev/null 2>&1; then
  python3 - <<'PY'
import os, pathlib, re
t = pathlib.Path("/opt/tc/kickstart.template.json").read_text()
# Numeric SMTP port: replace quoted placeholder with bare JSON number
port = os.environ["TC_FA_SMTP_PORT"]
if not port.isdigit():
    raise SystemExit("TC_FA_SMTP_PORT must be digits")
t = t.replace('"#{TC_FA_SMTP_PORT}"', port)
keys = [
    "TC_FA_API_KEY", "TC_FA_JWT_SECRET", "TC_FA_JWT_KEY_ID", "TC_FA_JWT_LAMBDA_ID",
    "TC_FA_APPLICATION_ID", "TC_FA_TENANT_ID", "TC_FA_CLIENT_SECRET",
    "TC_FA_PASSWORDLESS_TEMPLATE_ID", "TC_FA_MAIL_FROM", "TC_FA_ISSUER",
    "TC_FA_SMTP_HOST", "TC_FA_SMTP_SECURITY", "TC_FA_SMTP_USERNAME",
    "TC_FA_SMTP_PASSWORD", "TC_FA_OAUTH_REDIRECT_URI", "TC_INTERNAL_API_KEY",
]
for k in keys:
    t = t.replace("#{%s}" % k, os.environ[k])
if re.search(r"#\{TC_[A-Z0-9_]+\}", t):
    raise SystemExit("unsubstituted kickstart placeholders remain")
pathlib.Path("/usr/local/fusionauth/kickstart/kickstart.json").write_text(t)
PY
else
  echo "python3 required to render kickstart safely" >&2
  exit 1
fi

exec /usr/local/fusionauth/fusionauth-app/bin/start.sh
