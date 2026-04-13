#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
mappings_file="${repo_root}/config/mappings.json"

mkdir -p "${repo_root}/state"

last_sig=""

while true; do
  if [[ -f "${mappings_file}" ]]; then
    sig="$(shasum "${mappings_file}" | awk '{print $1}')"
    if [[ "${sig}" != "${last_sig}" ]]; then
      "${repo_root}/scripts/mdns-publish.sh" >/dev/null 2>&1 || true
      last_sig="${sig}"
    fi
  fi
  sleep 2
done
