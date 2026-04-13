#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -f "${repo_root}/state/mdns-watch.pid" ]]; then
	watch_pid="$(cat "${repo_root}/state/mdns-watch.pid" 2>/dev/null || true)"
	if [[ -n "${watch_pid}" ]] && kill -0 "${watch_pid}" 2>/dev/null; then
		kill "${watch_pid}" 2>/dev/null || true
	fi
	rm -f "${repo_root}/state/mdns-watch.pid"
fi

"${repo_root}/scripts/mdns-stop.sh" || true
cd "${repo_root}"
docker compose down
