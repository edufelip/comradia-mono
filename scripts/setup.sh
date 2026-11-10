#!/usr/bin/env bash
# Install each app with its own package manager. The apps are not a workspace.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUN_BIN="$("$ROOT_DIR/scripts/resolve-pinned-bun.sh")"

echo "==> apps/mobile (yarn)"
(cd "$ROOT_DIR/apps/mobile" && yarn install --frozen-lockfile)

echo "==> apps/server (bun $("$BUN_BIN" --version))"
(cd "$ROOT_DIR/apps/server" && "$BUN_BIN" install)
