#!/usr/bin/env bash
set -euo pipefail

if command -v docker >/dev/null 2>&1; then
  command -v docker
  exit 0
fi

for candidate in \
  /usr/local/bin/docker \
  /opt/homebrew/bin/docker \
  /Applications/Docker.app/Contents/Resources/bin/docker; do
  if [[ -x "$candidate" ]]; then
    printf '%s\n' "$candidate"
    exit 0
  fi
done

echo "docker is not available on PATH or in a standard macOS Docker Desktop location." >&2
exit 1
