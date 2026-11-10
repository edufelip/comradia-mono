#!/usr/bin/env bash
# Vercel "Ignored Build Step" for monorepo apps.
# Vercel runs this from the project's Root Directory. The command for the
# website is: bash ../../scripts/vercel-ignore.sh apps/website
# Exit 0 skips the build, exit 1 builds. Any doubt builds.
set -u

app="${1:?app path required, e.g. apps/website}"
cd "$(git rev-parse --show-toplevel)" || exit 1

previous="${VERCEL_GIT_PREVIOUS_SHA:-}"
has_commit() {
  [ -n "$1" ] && git cat-file -e "$1^{commit}" 2>/dev/null
}

if ! has_commit "$previous" && [ -n "$previous" ]; then
  git fetch --quiet --depth=200 origin "${VERCEL_GIT_COMMIT_REF:-HEAD}" 2>/dev/null || true
fi

if ! has_commit "$previous"; then
  echo "No usable previous deployment SHA; building $app."
  exit 1
fi

if git diff --quiet "$previous" HEAD -- "$app" scripts/vercel-ignore.sh; then
  echo "No changes in $app since $previous; skipping build."
  exit 0
fi

echo "Changes in $app since $previous; building."
exit 1
