#!/usr/bin/env bash
set -euo pipefail

root="${HOME:?HOME is required}/.comradia-unit-tmp"
mkdir -p "$root"
chmod 700 "$root"
run_dir="$(mktemp -d "$root/run.XXXXXX")"
trap 'rm -rf "$run_dir"' EXIT
export TMPDIR="$run_dir"

tsx --test "$@"
