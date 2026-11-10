#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUN_BIN="$("$ROOT_DIR/scripts/resolve-pinned-bun.sh")"
LOCAL_DEV_SESSION_NAME="${COMRADIA_LOCAL_DEV_SESSION_NAME:-comradia-local}"

"$ROOT_DIR/scripts/local-db.sh" up

server_cmd="cd '$ROOT_DIR/apps/server' && exec '$BUN_BIN' run dev"
metro_cmd="cd '$ROOT_DIR/apps/mobile' && exec yarn start"
website_cmd="cd '$ROOT_DIR/apps/website' && exec '$BUN_BIN' --port 3510 index.html"

if command -v mprocs >/dev/null 2>&1; then
  exec mprocs --names "Server,Metro,Website" "$server_cmd" "$metro_cmd" "$website_cmd"
elif command -v tmux >/dev/null 2>&1; then
  if tmux has-session -t "$LOCAL_DEV_SESSION_NAME" 2>/dev/null; then
    exec tmux attach -t "$LOCAL_DEV_SESSION_NAME"
  fi
  tmux new-session -d -s "$LOCAL_DEV_SESSION_NAME" -n "local" "$server_cmd"
  tmux split-window -h -t "$LOCAL_DEV_SESSION_NAME:local.0" "$metro_cmd"
  tmux split-window -v -t "$LOCAL_DEV_SESSION_NAME:local.1" "$website_cmd"
  exec tmux attach -t "$LOCAL_DEV_SESSION_NAME"
else
  echo "Starting Comradia server on :3410 and website on :3510..."
  bash -c "$server_cmd" &
  bash -c "$website_cmd" &
  wait
fi
