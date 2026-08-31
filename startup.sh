#!/bin/bash
# Nuria AI auto-start — runs on sandbox reboot via @reboot cron
# Starts Express on port 3001 (port 3000 is the platform-managed team site).
LOG="/tmp/nuria-startup.log"
echo "[startup] $(date): beginning" >> "$LOG"
sleep 5
# Kill any stale tsx processes from prior runs
pkill -f "tsx server/src/index.ts" 2>/dev/null
sleep 1
# Start Express on 3001
cd /home/agent-engineer/agents
PORT=3001 DB_PATH=./data/theblueprint.db nohup npx tsx server/src/index.ts >> "$LOG" 2>&1 &
PID=$!
sleep 4
if kill -0 $PID 2>/dev/null; then
  echo "[startup] $(date): Express started on port 3001, PID=$PID" >> "$LOG"
else
  echo "[startup] $(date): Express FAILED, check log" >> "$LOG"
fi
