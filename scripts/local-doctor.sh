#!/usr/bin/env bash
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.local.yml"
DOCKER_BIN=""

SERVER_HEALTH_URL="${SERVER_HEALTH_URL:-http://localhost:3410/health}"
LOCAL_DOCTOR_SKIP_DOCKER="${LOCAL_DOCTOR_SKIP_DOCKER:-false}"
LOCAL_DOCTOR_SKIP_SERVICE_HEALTH="${LOCAL_DOCTOR_SKIP_SERVICE_HEALTH:-false}"
EXPECTED_BUN_VERSION="$(tr -d '[:space:]' < "$ROOT_DIR/apps/server/.bun-version")"

failed=0

mark_failed() {
  failed=1
}

indent() {
  sed 's/^/  /'
}

compose() {
  "$DOCKER_BIN" compose -f "$COMPOSE_FILE" "$@"
}

run_bun_check() {
  local output
  local bun_bin

  if ! bun_bin="$("$ROOT_DIR/scripts/resolve-pinned-bun.sh" 2>&1)"; then
    echo "Bun: failed"
    printf '%s\n' "$bun_bin" | indent
    mark_failed
    return
  fi

  if output="$(COMRADIA_BUN_BIN="$bun_bin" "$ROOT_DIR/scripts/check-bun-version.sh" 2>&1)"; then
    echo "Bun: ok ($output)"
    return
  fi

  echo "Bun: failed"
  printf '%s\n' "$output" | indent
  mark_failed
}

run_docker_check() {
  if [[ "$LOCAL_DOCTOR_SKIP_DOCKER" == "true" ]]; then
    echo "Docker storage: skipped"
    return
  fi

  if ! DOCKER_BIN="$("$ROOT_DIR/scripts/resolve-docker.sh" 2>&1)"; then
    echo "Docker storage: failed"
    printf '%s\n' "$DOCKER_BIN" | indent
    mark_failed
    return
  fi

  local output
  if ! output="$(compose ps postgres redis 2>&1)"; then
    echo "Docker storage: failed"
    printf '%s\n' "$output" | indent
    mark_failed
    return
  fi

  if ! output="$(compose exec -T postgres pg_isready -U comradia_local -d comradia_local 2>&1)"; then
    echo "Docker storage: failed"
    echo "  postgres pg_isready failed:"
    printf '%s\n' "$output" | indent
    mark_failed
    return
  fi

  if ! output="$(compose exec -T redis redis-cli ping 2>&1)"; then
    echo "Docker storage: failed"
    echo "  Redis PING failed:"
    printf '%s\n' "$output" | indent
    mark_failed
    return
  fi

  echo "Docker storage: ok"
}

check_server_health_url() {
  local output
  if ! output="$(curl -fsS "$SERVER_HEALTH_URL" 2>&1)"; then
    echo "  server: failed"
    printf '%s\n' "$output" | indent
    mark_failed
    return
  fi
  echo "  server: ok"
}

run_service_health_check() {
  if [[ "$LOCAL_DOCTOR_SKIP_SERVICE_HEALTH" == "true" ]]; then
    echo "Service health: skipped"
    return
  fi

  echo "Service health:"
  check_server_health_url
}

cat <<INTRO
Comradia local doctor

Expected health endpoints:
  server: $SERVER_HEALTH_URL

INTRO

run_bun_check
run_docker_check
run_service_health_check

if [[ "$failed" -ne 0 ]]; then
  exit 1
fi
