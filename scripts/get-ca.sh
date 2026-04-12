#!/usr/bin/env bash
set -euo pipefail

out_file="${1:-./devproxy-ca.pem}"
mkdir -p "$(dirname "$out_file")"

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

docker compose cp devproxy:/state/ca.pem "$out_file"
echo "Exported CA certificate to: $out_file"
