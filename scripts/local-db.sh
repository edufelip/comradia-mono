#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.local.yml"
DOCKER_BIN="$("$ROOT_DIR/scripts/resolve-docker.sh")"

LOCAL_POSTGRES_USER="${LOCAL_POSTGRES_USER:-comradia_local}"
SERVER_LOCAL_DB="${SERVER_LOCAL_DB:-comradia_server_local}"

usage() {
  cat <<'USAGE'
Usage: scripts/local-db.sh <up|down|reset> [--destroy-volumes]
USAGE
}

compose() {
  "$DOCKER_BIN" compose -f "$COMPOSE_FILE" "$@"
}

wait_for_postgres() {
  local attempt
  for attempt in {1..30}; do
    if compose exec -T postgres pg_isready -U "$LOCAL_POSTGRES_USER" -d comradia_local >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "Timed out waiting for local Postgres." >&2
  return 1
}

ensure_local_database() {
  local db="$1"
  wait_for_postgres
  compose exec -T postgres psql -U "$LOCAL_POSTGRES_USER" -d comradia_local -v ON_ERROR_STOP=1 <<SQL
SELECT 'CREATE DATABASE "$db" OWNER "$LOCAL_POSTGRES_USER"'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$db')\gexec
SQL
}

up() {
  compose up -d postgres redis
  ensure_local_database "$SERVER_LOCAL_DB"
}

down() {
  compose down
}

reset() {
  if [[ "${1:-}" != "--destroy-volumes" ]]; then
    echo "reset requires --destroy-volumes because it deletes local Docker volumes." >&2
    exit 1
  fi
  compose down -v
}

command="${1:-}"
shift || true

case "$command" in
  up) up "$@" ;;
  down) down "$@" ;;
  reset) reset "$@" ;;
  -h|--help|help|"") usage ;;
  *) echo "Unknown command: $command" >&2; usage; exit 1 ;;
esac
