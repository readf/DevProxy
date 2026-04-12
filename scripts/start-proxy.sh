#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"

if [[ ! -f "${repo_root}/config/mappings.json" ]]; then
  echo "Mappings file not found: ${repo_root}/config/mappings.json" >&2
  exit 1
fi

cd "${repo_root}"

echo "Starting Dockerized dev proxy..."
docker compose up -d --build
echo
bash "${repo_root}/scripts/mdns-publish.sh"
echo
docker compose logs --tail=80 devproxy
