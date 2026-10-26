#!/usr/bin/env bash
# Import an image from GHCR into a (private) Azure Container Registry, server-side.
#
#   import-image.sh <acr-name> <source-ref@sha256:...> <target-repository> <target-tag>
#
# `az acr import` is a control-plane operation: ACR pulls from the source itself (trusted-services
# bypass), so the caller needs no network path to the registry's private endpoint. The manifest is
# copied byte-for-byte, so the digest is unchanged. Prints <loginServer>/<repository>@<digest>.
#
# Env: GHCR_USERNAME, GHCR_TOKEN (a token with read:packages, e.g. the workflow GITHUB_TOKEN).

set -euo pipefail

if [[ $# -ne 4 ]]; then
  echo "usage: $0 <acr-name> <source-ref@sha256:...> <target-repository> <target-tag>" >&2
  exit 2
fi

acr_name=$1
source_ref=$2
target_repository=$3
target_tag=$4

if [[ "$source_ref" != *@sha256:* ]]; then
  echo "error: source image must be pinned by digest (got '$source_ref')" >&2
  exit 2
fi
: "${GHCR_USERNAME:?GHCR_USERNAME is required}"
: "${GHCR_TOKEN:?GHCR_TOKEN is required}"

digest=${source_ref##*@}
login_server=$(az acr show --name "$acr_name" --query loginServer --output tsv)

echo "Importing $source_ref -> $login_server/$target_repository:$target_tag" >&2
az acr import \
  --name "$acr_name" \
  --source "$source_ref" \
  --image "$target_repository:$target_tag" \
  --username "$GHCR_USERNAME" \
  --password "$GHCR_TOKEN" \
  --force \
  --only-show-errors >&2

echo "$login_server/$target_repository@$digest"
