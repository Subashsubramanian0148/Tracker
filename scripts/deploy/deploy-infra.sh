#!/usr/bin/env bash
# Deploy infra/main.bicep to a resource group with a what-if preview.
#
#   deploy-infra.sh <resource-group> <parameters.json> --phase 1|2 [--yes]
#
# Phase 1: platform only (deployApp=false). Phase 2: also the app and migration job (deployApp=true).
#
# Images: the CD pipeline changes the app/job images outside Bicep. To avoid rolling them back, this
# script re-uses the images currently deployed unless RUNTIME_IMAGE / MIGRATOR_IMAGE are set.
# First creation of the PostgreSQL server needs POSTGRES_ADMIN_PASSWORD in the environment.

set -euo pipefail

usage() {
  echo "usage: $0 <resource-group> <parameters.json> --phase 1|2 [--yes]" >&2
  exit 2
}

[[ $# -ge 4 ]] || usage
resource_group=$1
parameters_file=$2
shift 2

phase=""
assume_yes=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --phase)
      phase=${2:-}
      shift 2
      ;;
    --yes)
      assume_yes=true
      shift
      ;;
    *) usage ;;
  esac
done
[[ "$phase" == "1" || "$phase" == "2" ]] || usage
[[ -f "$parameters_file" ]] || {
  echo "parameters file not found: $parameters_file" >&2
  exit 2
}

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
template="$script_dir/../../infra/main.bicep"

if grep -q '<REPLACE:' "$parameters_file"; then
  echo "error: $parameters_file still contains <REPLACE: ...> placeholders" >&2
  exit 1
fi

overrides=()
if [[ "$phase" == "2" ]]; then
  overrides+=(deployApp=true)
  runtime_image=${RUNTIME_IMAGE:-$(az containerapp list --resource-group "$resource_group" \
    --query "[?tags.app=='ado-metrics'] | [0].properties.template.containers[0].image" --output tsv)}
  migrator_image=${MIGRATOR_IMAGE:-$(az containerapp job list --resource-group "$resource_group" \
    --query "[?tags.app=='ado-metrics'] | [0].properties.template.containers[0].image" --output tsv)}
  if [[ -z "$runtime_image" || -z "$migrator_image" ]]; then
    echo "error: set RUNTIME_IMAGE and MIGRATOR_IMAGE (<acr>.azurecr.io/ado-metrics/<name>@sha256:...) for the first Phase 2 deployment" >&2
    exit 1
  fi
  overrides+=("runtimeImage=$runtime_image" "migratorImage=$migrator_image")
else
  overrides+=(deployApp=false)
fi

if [[ -n "${POSTGRES_ADMIN_PASSWORD:-}" ]]; then
  overrides+=("postgresAdminPassword=$POSTGRES_ADMIN_PASSWORD")
fi

deployment_name="ado-metrics-phase${phase}-$(date -u +%Y%m%d%H%M%S)"
args=(
  --resource-group "$resource_group"
  --name "$deployment_name"
  --template-file "$template"
  --parameters "@$parameters_file"
  --parameters "${overrides[@]}"
)

if [[ "$assume_yes" == true ]]; then
  az deployment group create "${args[@]}" --output none
else
  # Shows the what-if diff and asks for confirmation before applying.
  az deployment group create "${args[@]}" --confirm-with-what-if --output none
fi

az deployment group show --resource-group "$resource_group" --name "$deployment_name" \
  --query properties.outputs --output json
