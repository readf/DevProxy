#!/usr/bin/env bash
set -euo pipefail

: "${PORTLESS_STATE_DIR:=/state}"
: "${MAPPINGS_FILE:=/config/mappings.json}"
: "${PROXY_PORT:=443}"
: "${PUBLIC_PORT:=443}"
: "${DASHBOARD_PORT:=9090}"
: "${DASHBOARD_HOST:=proxy}"
: "${CA_PATH:=/state/ca.pem}"

export PORTLESS_LAN="${PORTLESS_LAN:-1}"
export PORTLESS_TLD="${PORTLESS_TLD:-local}"
export PUBLIC_PORT
export DASHBOARD_PORT
export DASHBOARD_HOST
export CA_PATH

mkdir -p "${PORTLESS_STATE_DIR}"
rm -f "${PORTLESS_STATE_DIR}/routes.lock"

dbus-uuidgen --ensure
mkdir -p /run/dbus
dbus-daemon --system --fork
avahi-daemon --daemonize --no-drop-root

node /app/scripts/sync-mappings.mjs
node /app/scripts/host-forward.mjs &
forward_pid=$!
node /app/scripts/dashboard-server.mjs &
dashboard_pid=$!
node /app/scripts/http-redirect.mjs &
redirect_pid=$!
portless proxy start --lan --https --wildcard --foreground -p "${PROXY_PORT}" &
proxy_pid=$!

cleanup() {
  kill "$forward_pid" 2>/dev/null || true
  kill "$dashboard_pid" 2>/dev/null || true
  kill "$redirect_pid" 2>/dev/null || true
  kill "$proxy_pid" 2>/dev/null || true
  pkill avahi-daemon 2>/dev/null || true
  pkill dbus-daemon 2>/dev/null || true
}

trap cleanup EXIT INT TERM

wait "$proxy_pid"
