#!/bin/bash
# Nuria AI auto-start — runs on sandbox reboot via @reboot cron.
#
# Starts the app servers this repo owns:
#   :3001  monolith Express API (the apex site's /api/*)
#   :3106  blueprint-app   |  :3102 audit-app  |  :3104 pipeline-app
#          (standalone apps behind blueprint./audit./pipeline. subdomains)
#
# The public origin on :3000 (the team site's serve.ts, which holds the
# Host-prefix router) is managed by the platform/site workspace, not here — after
# a restart run `/home/team/shared/site/publish.sh` (or ./start-all.sh there) to
# restore the router.
#
# Ports and the app list live in deploy/start-apps.sh so there is one source of
# truth. Every step is idempotent.
LOG="/tmp/nuria-startup.log"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[startup] $(date): beginning (repo: $REPO_ROOT)" >> "$LOG"
sleep 5

# Standalone apps first (audit -> pipeline -> blueprint; each health-checked,
# already-running apps are left alone).
"$REPO_ROOT/deploy/start-apps.sh" >> "$LOG" 2>&1 ||
  echo "[startup] $(date): WARNING not every app server came up" >> "$LOG"

# Monolith API on 3001 (apex site /api).
if curl -sf --max-time 3 http://127.0.0.1:3001/api/health >/dev/null 2>&1; then
  echo "[startup] $(date): monolith api already healthy on :3001" >> "$LOG"
else
  cd "$REPO_ROOT" || exit 1
  PORT=3001 DB_PATH=./data/theblueprint.db nohup npx tsx server/src/index.ts >> "$LOG" 2>&1 &
  PID=$!
  sleep 4
  if kill -0 $PID 2>/dev/null; then
    echo "[startup] $(date): monolith api started on :3001, PID=$PID" >> "$LOG"
  else
    echo "[startup] $(date): monolith api FAILED, check $LOG" >> "$LOG"
  fi
fi
