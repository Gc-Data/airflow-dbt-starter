#!/bin/bash
# Airflow + dbt Starter — Smoke Test
# Builds, deploys, runs dbt, verifies tables, then tears everything down.
set -euo pipefail

cd "$(dirname "$0")/.."

PASS=0
FAIL=0
SUMMARY=""

log()  { echo "[INFO] $*"; }
pass() { PASS=$((PASS + 1)); SUMMARY="${SUMMARY}\n  [PASS] $*"; echo "  [PASS] $*"; }
fail() { FAIL=$((FAIL + 1)); SUMMARY="${SUMMARY}\n  [FAIL] $*"; echo "  [FAIL] $*"; }

cleanup() {
    log "Cleaning up..."
    docker compose down -v 2>/dev/null || true
}
trap cleanup EXIT

# ── 1. Check generated files ────────────────────────────────────────
log "Checking generated config files..."
for f in .env docker-compose.yml; do
    if [ -f "$f" ]; then
        pass "$f exists"
    else
        fail "$f not found — run 'python setup.py' first"
        echo ""
        echo "[FAILED] Cannot continue without generated config files."
        exit 1
    fi
done

# Load env vars for port references
# shellcheck disable=SC1091
source .env 2>/dev/null || true

# ── 2. Build ────────────────────────────────────────────────────────
log "Building Docker images..."
if docker compose build 2>&1; then
    pass "docker compose build"
else
    fail "docker compose build"
    echo ""
    echo "[FAILED] Build failed."
    exit 1
fi

# ── 3. Start containers ─────────────────────────────────────────────
log "Starting containers..."
docker compose up -d 2>&1 || true

# ── 4. Wait for airflow-init ─────────────────────────────────────────
log "Waiting for airflow-init to complete (up to 90s)..."
init_ok=false
for _ in $(seq 1 30); do
    status=$(docker inspect --format='{{.State.Status}}' starter-airflow-init 2>/dev/null || echo "missing")
    if [ "$status" = "exited" ]; then
        exit_code=$(docker inspect --format='{{.State.ExitCode}}' starter-airflow-init 2>/dev/null || echo "1")
        if [ "$exit_code" = "0" ]; then
            init_ok=true
            break
        else
            fail "airflow-init exited with code $exit_code"
            docker compose logs airflow-init 2>&1 | tail -20
            echo ""
            echo "[FAILED] airflow-init failed."
            exit 1
        fi
    fi
    sleep 3
done

if $init_ok; then
    pass "airflow-init completed"
else
    fail "airflow-init did not complete within 90s"
    echo ""
    echo "[FAILED] airflow-init timed out."
    exit 1
fi

# ── 5. Wait for webserver health ─────────────────────────────────────
log "Waiting for Airflow Webserver to be healthy (up to 60s)..."
ws_ok=false
for _ in $(seq 1 30); do
    if curl -sf "http://localhost:${AIRFLOW_WEBSERVER_PORT:-8080}/health" > /dev/null 2>&1; then
        ws_ok=true
        break
    fi
    sleep 2
done

if $ws_ok; then
    pass "Airflow Webserver healthy"
else
    fail "Airflow Webserver not healthy within 60s"
fi

# ── 6. Run dbt seed + run + test ─────────────────────────────────────
log "Running dbt seed + run + test inside airflow-scheduler..."
if docker compose exec -T airflow-scheduler bash -c \
    "cd /opt/airflow/dbt && dbt seed --profiles-dir . && dbt run --profiles-dir . && dbt test --profiles-dir ." 2>&1; then
    pass "dbt seed + run + test"
else
    fail "dbt seed + run + test"
fi

# ── 7. Verify tables in PostgreSQL ───────────────────────────────────
log "Verifying tables in PostgreSQL..."
tables_output=$(docker compose exec -T postgres psql \
    -U "${POSTGRES_USER:-airflow}" \
    -d "${POSTGRES_DB:-airflow}" \
    -c "\dt staging.*" -c "\dt marts.*" 2>&1) || true

if echo "$tables_output" | grep -q "staging\.\|marts\."; then
    pass "Tables found in staging/marts schemas"
else
    fail "No tables found in staging/marts schemas"
fi
echo "$tables_output"

# ── Summary ──────────────────────────────────────────────────────────
echo ""
echo "========================================"
echo " Smoke Test Results: $PASS passed, $FAIL failed"
echo "========================================"
echo -e "$SUMMARY"
echo ""

if [ "$FAIL" -eq 0 ]; then
    echo "[SUCCESS] All smoke tests passed!"
    exit 0
else
    echo "[FAILED] $FAIL test(s) failed."
    exit 1
fi
