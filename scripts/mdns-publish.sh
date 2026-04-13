#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
mappings_file="${repo_root}/config/mappings.json"
pid_file="${repo_root}/state/mdns-pids"
port="${MDNS_PORT:-443}"
dashboard_host="${DASHBOARD_HOST:-proxy}"

if ! command -v dns-sd >/dev/null 2>&1; then
  echo "dns-sd is not available on this host." >&2
  exit 1
fi

if [[ ! -f "${mappings_file}" ]]; then
  mkdir -p "${repo_root}/config"
  printf '{}\n' > "${mappings_file}"
fi

lan_ip="${LAN_IP:-}"
if [[ -z "${lan_ip}" ]]; then
  default_if="$(route -n get default 2>/dev/null | awk '/interface:/{print $2; exit}')"
  if [[ -n "${default_if}" ]]; then
    lan_ip="$(ipconfig getifaddr "${default_if}" 2>/dev/null || true)"
  fi
fi

if [[ -z "${lan_ip}" ]]; then
  for ifname in en0 en1; do
    lan_ip="$(ipconfig getifaddr "${ifname}" 2>/dev/null || true)"
    if [[ -n "${lan_ip}" ]]; then
      break
    fi
  done
fi

if [[ -z "${lan_ip}" ]]; then
  echo "Could not determine LAN IP. Set LAN_IP=<address> and retry." >&2
  exit 1
fi

mkdir -p "${repo_root}/state"
"${repo_root}/scripts/mdns-stop.sh" >/dev/null 2>&1 || true

hosts=()
while IFS= read -r host; do
  if [[ -n "${host}" ]]; then
    hosts+=("${host}")
  fi
done < <(node -e '
const fs=require("fs");
const p=process.argv[1];
const m=JSON.parse(fs.readFileSync(p,"utf8"));
for (const k of Object.keys(m)) {
  if (!/^[a-z0-9-]+$/i.test(k)) {
    console.error(`Invalid host key: ${k}`);
    process.exit(1);
  }
  console.log(k.toLowerCase());
}
' "${mappings_file}")

if [[ ${#hosts[@]} -eq 0 ]] || [[ ! " ${hosts[*]} " =~ " ${dashboard_host} " ]]; then
  hosts+=("${dashboard_host}")
fi

: > "${pid_file}"

if [[ ${#hosts[@]} -eq 0 ]]; then
  echo "No mappings found; nothing to publish over mDNS."
  exit 0
fi

for host in "${hosts[@]}"; do
  fqdn="${host}.local"
  dns-sd -P "${host}" "_http._tcp" "local" "${port}" "${fqdn}" "${lan_ip}" >/dev/null 2>&1 &
  pid=$!
  echo "${pid}" >> "${pid_file}"
  echo "Published ${fqdn} -> ${lan_ip}:${port}"
done

echo "mDNS publishers running (${#hosts[@]} entries)."
