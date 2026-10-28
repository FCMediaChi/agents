#!/usr/bin/env bash
# Start (or confirm) the standalone Nuria app servers that the public origin
# proxies to by subdomain. Idempotent and restart-safe: re-running it never
# double-starts an app, and it repairs a stale/foreign listener on the port.
#
#   blueprint.*  -> blueprint-app  :3106   (frontend + /api on the same port)
#   audit.*      -> audit-app      :3102
#   pipeline.*   -> pipeline-app   :3104
#   qa.*         -> not started (owner moratorium; add a row when it resumes)
#
# Port 3000 is the origin itself (the team site, serve.ts) and is NOT managed
# here; port 3001 is the old monolith API that the apex still uses.
#
# Each app is a separate Express process with its own database file, cookie name
# and secrets, started with cwd = its own directory so the relative DB paths
# (e.g. ./server/data/blueprint.sqlite) land in the right place. App-level env
# vars (JWT secrets, Stripe keys, Resend key, ...) are inherited from the calling
# environment — this script invents none of them.
#
# Usage:
#   deploy/start-apps.sh            # start anything that is not already healthy
#   deploy/start-apps.sh --restart  # force a restart of all three
#   APP_LOG=/tmp/x.log deploy/start-apps.sh
#
# Exit code 0 means every app answered /api/health with its own name; 1 means at
# least one did not (details on stderr and in the log).

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_LOG="${APP_LOG:-/tmp/nuria-apps.log}"
RESTART=0
[ "${1:-}" = "--restart" ] && RESTART=1

mkdir -p "$(dirname "$APP_LOG")"

# app dir : port : expected app name in /api/health
APPS=(
  "audit-app:${AUDIT_APP_PORT:-3102}:nuria-audit-app"
  "pipeline-app:${PIPELINE_APP_PORT:-3104}:nuria-pipeline-app"
  "blueprint-app:${BLUEPRINT_APP_PORT:-3106}:nuria-blueprint-app"
)

log() { echo "[start-apps] $*"; }

health() {
  curl -sf --max-time 3 "http://127.0.0.1:$1/api/health" 2>/dev/null
}

# True when the port answers /api/health with the expected app name.
is_healthy() {
  local port="$1" name="$2"
  health "$port" | grep -q "\"app\":\"$name\""
}

port_is_bound() {
  [ -n "$(lsof -t -iTCP:"$1" -sTCP:LISTEN 2>/dev/null)" ]
}

# Kill whatever listens on a port (across user boundaries, like serve.ts does).
free_port() {
  local port="$1" pids
  pids="$(sudo lsof -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || lsof -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  [ -z "$pids" ] && return 0
  # shellcheck disable=SC2086
  sudo kill $pids 2>/dev/null || kill $pids 2>/dev/null || true
  for _ in $(seq 1 25); do
    port_is_bound "$port" || return 0
    sleep 0.2
  done
  pids="$(sudo lsof -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  # shellcheck disable=SC2086
  [ -n "$pids" ] && { sudo kill -9 $pids 2>/dev/null || true; sleep 0.5; }
  return 0
}

FAILED=0

for row in "${APPS[@]}"; do
  app="${row%%:*}"; rest="${row#*:}"
  port="${rest%%:*}"; name="${rest#*:}"
  app_dir="$REPO_ROOT/$app"

  if [ ! -d "$app_dir" ]; then
    log "MISSING $app ($app_dir not found) — check NURIA_REPO/$REPO_ROOT"
    FAILED=1
    continue
  fi

  if [ "$RESTART" -eq 0 ] && is_healthy "$port" "$name"; then
    log "$app already healthy on :$port"
    continue
  fi

  if port_is_bound "$port"; then
    log "$app :$port held by a stale/foreign process — freeing it"
    free_port "$port"
  fi

  if [ ! -d "$app_dir/node_modules" ]; then
    log "WARNING $app has no node_modules — run 'npm install' in $app_dir (starting anyway)"
  fi
  if [ ! -f "$app_dir/dist/index.html" ]; then
    log "WARNING $app has no built frontend ($app_dir/dist/index.html) — run 'npm run build' in $app_dir"
  fi

  log "starting $app on :$port"
  (
    cd "$app_dir" || exit 1
    PORT="$port" NODE_ENV=production \
      setsid nohup ./node_modules/.bin/tsx server/src/index.ts >>"$APP_LOG" 2>&1 </dev/null &
  )

  ok=0
  for _ in $(seq 1 60); do
    if is_healthy "$port" "$name"; then ok=1; break; fi
    sleep 0.5
  done

  if [ "$ok" -eq 1 ]; then
    log "$app healthy on :$port"
  else
    log "FAILED $app did not answer /api/health on :$port — see $APP_LOG"
    FAILED=1
  fi
done

if [ "$FAILED" -ne 0 ]; then
  exit 1
fi
log "all app servers up (log: $APP_LOG)"
