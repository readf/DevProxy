#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"

"${repo_root}/scripts/mdns-stop.sh" || true
cd "${repo_root}"
docker compose down
