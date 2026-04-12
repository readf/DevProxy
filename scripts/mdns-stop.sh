#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
pid_file="${repo_root}/state/mdns-pids"

if [[ ! -f "${pid_file}" ]]; then
  exit 0
fi

killed=0
while IFS= read -r pid; do
  if [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null; then
    kill "${pid}" 2>/dev/null || true
    killed=$((killed + 1))
  fi
done < "${pid_file}"

rm -f "${pid_file}"

echo "Stopped ${killed} mDNS publisher process(es)."
