#!/usr/bin/env bash
# Create a throwaway .env for the docker compose DAST stack: dev auth mode, random secrets.
# Starts from the backend's .env.example (if present) so every variable the app expects exists.
#
#   create-dast-env.sh [output-file]

set -euo pipefail

out=${1:-.env}
umask 077

if [[ -f .env.example ]]; then
  cp .env.example "$out"
else
  : >"$out"
fi

upsert() {
  local key=$1 value=$2 tmp
  tmp=$(mktemp)
  grep -v "^${key}=" "$out" >"$tmp" || true
  printf '%s=%s\n' "$key" "$value" >>"$tmp"
  mv "$tmp" "$out"
}

upsert NODE_ENV development
upsert AUTH_MODE dev
upsert LOG_LEVEL info
upsert POSTGRES_PASSWORD "$(openssl rand -hex 24)"
upsert SESSION_SECRET "$(openssl rand -hex 32)"
upsert WEBHOOK_BASIC_USER dast
upsert WEBHOOK_BASIC_PASSWORD "$(openssl rand -hex 24)"

echo "Wrote $out ($(wc -l <"$out" | tr -d ' ') variables; secrets are random and single-use)."
