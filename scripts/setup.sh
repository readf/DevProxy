#!/usr/bin/env bash
set -euo pipefail

echo "DevProxy Setup"
echo "============="
echo
echo "This script will:"
echo "  1. Create config/mappings.json if not present"
echo "  2. Ensure Docker Desktop is running"
echo "  3. Build and start DevProxy"
echo
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  exit 1
fi

repo_root="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "${repo_root}/config"

if [[ ! -f "${repo_root}/config/mappings.json" ]]; then
  printf '{}\n' > "${repo_root}/config/mappings.json"
  echo "✓ Created blank mappings.json"
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "✗ Docker not found. Please install Docker Desktop."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "✗ Docker is not running. Please start Docker Desktop."
  exit 1
fi

echo "✓ Docker is running"
echo

cd "${repo_root}"
bash scripts/start-proxy.sh

echo
echo "Setup complete! Visit https://proxy.local in your browser."
echo "Trust prompt? See https://proxy.local for instructions."
