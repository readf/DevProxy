#!/usr/bin/env bash
set -euo pipefail

out_file="${1:-./devproxy-ca.pem}"
mkdir -p "$(dirname "$out_file")"

docker compose cp devproxy:/state/ca.pem "$out_file"
echo "Exported CA certificate to $out_file"
