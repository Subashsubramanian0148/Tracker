#!/usr/bin/env bash
# Wait until a URL returns HTTP 200.
#
#   wait-for-url.sh <url> [timeout-seconds]

set -euo pipefail

url=${1:?usage: $0 <url> [timeout-seconds]}
timeout_seconds=${2:-60}
deadline=$((SECONDS + timeout_seconds))

until [[ "$(curl --silent --max-time 5 --output /dev/null --write-out '%{http_code}' "$url" || true)" == "200" ]]; do
  if ((SECONDS >= deadline)); then
    echo "Timed out after ${timeout_seconds}s waiting for $url" >&2
    exit 1
  fi
  sleep 2
done
echo "$url is up"
