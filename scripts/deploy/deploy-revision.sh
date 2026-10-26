#!/usr/bin/env bash
# Roll out a new Container App revision and wait until it is provisioned, healthy and serving.
#
#   deploy-revision.sh <resource-group> <app-name> <image@sha256:...> <revision-suffix> [timeout-seconds]
#
# The app runs in single-revision mode: traffic moves to the new revision only once it passes its
# readiness probe, so a failing revision leaves the previous one serving. On success writes
# `url=https://<fqdn>` and `revision=<name>` to $GITHUB_OUTPUT when running in GitHub Actions.

set -euo pipefail

if [[ $# -lt 4 ]]; then
  echo "usage: $0 <resource-group> <app-name> <image> <revision-suffix> [timeout-seconds]" >&2
  exit 2
fi

resource_group=$1
app_name=$2
image=$3
suffix=$(tr '[:upper:]' '[:lower:]' <<<"$4")
timeout_seconds=${5:-600}
revision="${app_name}--${suffix}"

previous_image=$(az containerapp show --name "$app_name" --resource-group "$resource_group" \
  --query "properties.template.containers[0].image" --output tsv)
echo "Current image:  $previous_image"
echo "New image:      $image"
echo "New revision:   $revision"

az containerapp update \
  --name "$app_name" \
  --resource-group "$resource_group" \
  --image "$image" \
  --revision-suffix "$suffix" \
  --only-show-errors --output none

deadline=$((SECONDS + timeout_seconds))
while ((SECONDS < deadline)); do
  read -r provisioning health running < <(az containerapp revision show \
    --name "$app_name" \
    --resource-group "$resource_group" \
    --revision "$revision" \
    --query "[properties.provisioningState, properties.healthState, properties.runningState]" \
    --output tsv | tr '\t' ' ')
  echo "  provisioning=$provisioning health=$health running=$running"

  if [[ "$provisioning" == "Failed" || "$running" == "Failed" ]]; then
    break
  fi
  if [[ "$provisioning" == "Provisioned" && "$health" == "Healthy" && "$running" == Running* ]]; then
    latest_ready=$(az containerapp show --name "$app_name" --resource-group "$resource_group" \
      --query properties.latestReadyRevisionName --output tsv)
    if [[ "$latest_ready" == "$revision" ]]; then
      fqdn=$(az containerapp show --name "$app_name" --resource-group "$resource_group" \
        --query properties.configuration.ingress.fqdn --output tsv)
      echo "Revision $revision is serving at https://$fqdn"
      if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
        echo "url=https://$fqdn" >>"$GITHUB_OUTPUT"
        echo "revision=$revision" >>"$GITHUB_OUTPUT"
      fi
      exit 0
    fi
  fi
  sleep 10
done

echo "::error::Revision $revision did not become healthy. The previous revision keeps serving traffic."
cat <<EOF
Diagnose:
  az containerapp revision show -n $app_name -g $resource_group --revision $revision
  az containerapp logs show -n $app_name -g $resource_group --revision $revision --type system
Roll back explicitly if needed:
  az containerapp update -n $app_name -g $resource_group --image $previous_image
EOF
exit 1
