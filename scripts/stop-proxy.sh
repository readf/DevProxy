#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"

check_docker_ready() {
	print_docker_error() {
		local detail="$1"
		cat >&2 <<EOF

============================================================
!! ACTION REQUIRED: Docker is needed to run DevProxy.
!! ${detail}
!!
!! Next steps:
!! 1) Install Docker Desktop if not installed.
!! 2) Start Docker Desktop and wait until it is fully running.
!! 3) Verify with: docker info
!! 4) Retry this command.
============================================================

EOF
	}

	if ! command -v docker >/dev/null 2>&1; then
		print_docker_error "Docker CLI was not found in PATH."
		return 1
	fi

	if ! docker info >/dev/null 2>&1; then
		print_docker_error "Docker is installed but the daemon/socket is not reachable."
		return 1
	fi
}

if [[ -f "${repo_root}/state/mdns-watch.pid" ]]; then
	watch_pid="$(cat "${repo_root}/state/mdns-watch.pid" 2>/dev/null || true)"
	if [[ -n "${watch_pid}" ]] && kill -0 "${watch_pid}" 2>/dev/null; then
		kill "${watch_pid}" 2>/dev/null || true
	fi
	rm -f "${repo_root}/state/mdns-watch.pid"
fi

"${repo_root}/scripts/mdns-stop.sh" || true
cd "${repo_root}"
check_docker_ready
docker compose down
