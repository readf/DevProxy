#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
mappings_file="${repo_root}/config/mappings.json"

mkdir -p "${repo_root}/config"
if [[ ! -f "${mappings_file}" ]]; then
  printf '{}\n' > "${mappings_file}"
  echo "Created blank mappings file at ${mappings_file}."
fi

cd "${repo_root}"

echo "Starting Dockerized dev proxy..."
docker compose up -d --build
echo
bash "${repo_root}/scripts/mdns-publish.sh"

if [[ -f "${repo_root}/state/mdns-watch.pid" ]]; then
  old_pid="$(cat "${repo_root}/state/mdns-watch.pid" 2>/dev/null || true)"
  if [[ -n "${old_pid}" ]] && kill -0 "${old_pid}" 2>/dev/null; then
    kill "${old_pid}" 2>/dev/null || true
  fi
fi

bash "${repo_root}/scripts/mdns-watch.sh" >/dev/null 2>&1 &
watch_pid=$!
echo "${watch_pid}" > "${repo_root}/state/mdns-watch.pid"
echo "Started mDNS watcher (${watch_pid})."
echo
docker compose logs --tail=80 devproxy
