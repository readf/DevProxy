#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
mappings_file="${repo_root}/config/mappings.json"
log_file="${repo_root}/state/mdns-watch.log"

mkdir -p "${repo_root}/state"
: > "${log_file}"

last_sig=""

while true; do
  if [[ -f "${mappings_file}" ]]; then
    sig="$(shasum "${mappings_file}" | awk '{print $1}')"
    if [[ "${sig}" != "${last_sig}" ]]; then
      if ! "${repo_root}/scripts/sync.sh" >>"${log_file}" 2>&1; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') sync failed, republishing mDNS only" >>"${log_file}"
        "${repo_root}/scripts/mdns-publish.sh" >>"${log_file}" 2>&1 || true
      fi
      last_sig="${sig}"
    fi
  fi
  sleep 2
done
