#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SESSION_NAME="${COMRADIA_DEV_SESSION_NAME:-comradia-dev}"

if ! command -v tmux >/dev/null 2>&1; then
  echo "tmux is required for the focused two-pane workflow." >&2
  exit 1
fi

if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  echo "Reusing existing tmux session: $SESSION_NAME"
  exec tmux attach-session -t "$SESSION_NAME"
fi

frontend_command="cd '$ROOT_DIR/apps/mobile' && exec yarn web:dev"
server_command="cd '$ROOT_DIR' && exec '$ROOT_DIR/scripts/server-bun.sh' run dev"

tmux new-session -d -s "$SESSION_NAME" -n "focused-dev" "$frontend_command"
tmux split-window -h -t "$SESSION_NAME:focused-dev" "$server_command"
tmux select-pane -t "$SESSION_NAME:focused-dev.0"

echo "Started focused frontend + primary backend session: $SESSION_NAME"
echo "  frontend: apps/mobile (Expo web)"
echo "  server:   apps/server (Bun)"
echo "  stop:     tmux kill-session -t $SESSION_NAME"
exec tmux attach-session -t "$SESSION_NAME"
