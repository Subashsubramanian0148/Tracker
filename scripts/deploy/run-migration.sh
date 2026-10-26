#!/usr/bin/env bash
# Point the migration Container Apps Job at a new migrator image, start one execution and wait for it.
#
#   run-migration.sh <resource-group> <job-name> <migrator-image@sha256:...> [timeout-seconds]
#
# Exits non-zero if the execution fails or does not finish in time. The app rollout must not proceed then.

set -euo pipefail

if [[ $# -lt 3 ]]; then
  echo "usage: $0 <resource-group> <job-name> <migrator-image> [timeout-seconds]" >&2
  exit 2
fi

resource_group=$1
job_name=$2
image=$3
timeout_seconds=${4:-900}

echo "Updating $job_name to $image"
az containerapp job update \
  --name "$job_name" \
  --resource-group "$resource_group" \
  --image "$image" \
  --only-show-errors --output none

execution=$(az containerapp job start \
  --name "$job_name" \
  --resource-group "$resource_group" \
  --query name --output tsv)
echo "Started execution $execution"

deadline=$((SECONDS + timeout_seconds))
status=""
while ((SECONDS < deadline)); do
  status=$(az containerapp job execution show \
    --name "$job_name" \
    --resource-group "$resource_group" \
    --job-execution-name "$execution" \
    --query properties.status --output tsv)
  case "$status" in
    Succeeded)
      echo "Migration execution $execution succeeded"
      exit 0
      ;;
    Failed | Stopped | Degraded)
      break
      ;;
    *)
      echo "  status: ${status:-unknown}"
      sleep 10
      ;;
  esac
done

echo "::error::Migration execution $execution ended with status '${status:-timeout}'."
cat <<EOF
Inspect the job output in Log Analytics:
  ContainerAppConsoleLogs
  | where ContainerGroupName startswith "$execution"
  | project TimeGenerated, Log
  | order by TimeGenerated asc
EOF
exit 1
