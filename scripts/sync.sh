#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"

cd "${repo_root}"
docker compose exec devproxy node /app/scripts/sync-mappings.mjs
bash "${repo_root}/scripts/mdns-publish.sh"
