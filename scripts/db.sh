#!/usr/bin/env bash
# Atlas wrapper (overview O7.2). Locally, migrations run against DATABASE_URL_UNPOOLED
# (a direct Postgres connection); staging and production are migrated only by CI.
#
#   scripts/db.sh migrate | status | validate | new <name> | hash
set -euo pipefail

cd "$(dirname "$0")/.."
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

# Neon ignores search_path, so Atlas keeps its revisions table in public (ariga/atlas#2509).
REVISIONS=(--revisions-schema public)
url() {
  local u="${DATABASE_URL_UNPOOLED:-${DATABASE_URL:-}}"
  if [[ -z "$u" ]]; then
    echo "DATABASE_URL_UNPOOLED is not set (see .env.tpl)" >&2
    exit 1
  fi
  echo "$u"
}

cmd="${1:-}"
shift || true
case "$cmd" in
  migrate) atlas migrate apply --env local --url "$(url)" "${REVISIONS[@]}" "$@" ;;
  status) atlas migrate status --env local --url "$(url)" "${REVISIONS[@]}" "$@" ;;
  validate) atlas migrate validate --env local "$@" ;;
  new) atlas migrate new --env local "$@" ;;
  hash) atlas migrate hash --env local "$@" ;;
  *)
    echo "Usage: scripts/db.sh migrate|status|validate|new <name>|hash" >&2
    exit 1
    ;;
esac
