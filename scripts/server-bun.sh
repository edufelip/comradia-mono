#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUN_BIN="$("$ROOT_DIR/scripts/resolve-pinned-bun.sh")"

export PATH="$(dirname "$BUN_BIN"):$PATH"
cd "$ROOT_DIR/apps/server"
exec "$BUN_BIN" "$@"
