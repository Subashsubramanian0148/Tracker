#!/usr/bin/env bash
# Post-deployment smoke test. Must run from inside the VNet (or a peered/VPN network).
#
#   smoke-test.sh https://<app-fqdn-or-custom-domain>
#
# Env: SMOKE_CA_BUNDLE  optional PEM bundle when the custom domain uses an internal CA.

set -euo pipefail

if [[ $# -ne 1 || "$1" != https://* ]]; then
  echo "usage: $0 https://<host>" >&2
  exit 2
fi

base_url=${1%/}
host=${base_url#https://}
curl_opts=(--silent --show-error --max-time 10 --retry 5 --retry-delay 5 --retry-all-errors --proto '=https,http')
if [[ -n "${SMOKE_CA_BUNDLE:-}" ]]; then
  curl_opts+=(--cacert "$SMOKE_CA_BUNDLE")
fi

failures=0
pass() { echo "PASS  $1"; }
fail() {
  echo "FAIL  $1"
  failures=$((failures + 1))
}

status_of() { curl "${curl_opts[@]}" --output /dev/null --write-out '%{http_code}' "$@" || true; }

# 1. Health endpoints
for path in /api/health/live /api/health/ready; do
  code=$(status_of "$base_url$path")
  if [[ "$code" == "200" ]]; then pass "$path -> 200"; else fail "$path -> $code (expected 200)"; fi
done

# 2. Authentication is enforced on the API
code=$(status_of "$base_url/api/auth/me")
if [[ "$code" == "401" ]]; then pass "/api/auth/me unauthenticated -> 401"; else fail "/api/auth/me unauthenticated -> $code (expected 401)"; fi

# 3. SPA is served with security headers
headers=$(curl "${curl_opts[@]}" --fail --dump-header - --output /dev/null "$base_url/" | tr -d '\r' | tr '[:upper:]' '[:lower:]')
for header in content-security-policy strict-transport-security x-content-type-options referrer-policy; do
  if grep -q "^$header:" <<<"$headers"; then pass "header $header present"; else fail "header $header missing"; fi
done
if grep -q '^x-powered-by:' <<<"$headers"; then fail "x-powered-by header must not be sent"; else pass "no x-powered-by header"; fi

# 4. Plain HTTP is redirected to HTTPS (ingress allowInsecure=false)
redirect=$(curl --silent --max-time 10 --output /dev/null --write-out '%{http_code} %{redirect_url}' "http://$host/" || true)
if [[ "$redirect" =~ ^30[1278]\ https:// ]]; then pass "http -> https redirect ($redirect)"; else fail "http -> https redirect (got '$redirect')"; fi

if ((failures > 0)); then
  echo "Smoke test failed: $failures check(s)."
  exit 1
fi
echo "Smoke test passed."
