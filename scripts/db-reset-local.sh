#!/usr/bin/env bash
# Rebuild a plain local Postgres database (no Supabase stack needed) from the
# migrations + demo seed, for running the SQL test suite.
#
#   TEST_DATABASE_URL=postgres://postgres@localhost:5432/apprest_test ./scripts/db-reset-local.sh
#
# Requires PostgreSQL 15+ with PostGIS, pg_trgm and unaccent available.
set -euo pipefail

URL="${TEST_DATABASE_URL:-postgres://postgres@localhost:5432/apprest_test}"
DB="${URL##*/}"; DB="${DB%%\?*}"
ADMIN_URL="${URL%/*}/postgres"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PGOPTIONS="-c client_min_messages=warning"

psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -q -c "drop database if exists \"$DB\" with (force)" -c "create database \"$DB\""

run() { psql "$URL" -v ON_ERROR_STOP=1 -q -f "$1" >/dev/null; echo "  applied $(basename "$1")"; }

run "$ROOT/supabase/tests/supabase_shim.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  case "$f" in *_storage.sql) echo "  skipped $(basename "$f") (Supabase storage only)"; continue;; esac
  run "$f"
done
run "$ROOT/supabase/seed.sql"
echo "Database $DB ready."
