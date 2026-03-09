#!/bin/bash
# Airflow + dbt Starter — Health Check
set -e

cd "$(dirname "$0")/.."

# Load env vars (for port references)
# shellcheck disable=SC1091
source .env 2>/dev/null || true

WEBSERVER_PORT=${AIRFLOW_WEBSERVER_PORT:-8080}

echo "[INFO] Running health checks..."
echo ""

# Check containers
echo "[INFO] Container status:"
docker compose ps 2>&1
echo ""

# Check PostgreSQL
echo "[INFO] Checking PostgreSQL..."
if docker compose exec -T postgres pg_isready -U airflow > /dev/null 2>&1; then
    echo "[SUCCESS] PostgreSQL is ready"
else
    echo "[ERROR] PostgreSQL is not responding"
fi

# Check Airflow Webserver
echo "[INFO] Checking Airflow Webserver..."
if curl -sf "http://localhost:${WEBSERVER_PORT}/health" > /dev/null 2>&1; then
    echo "[SUCCESS] Airflow Webserver is healthy"
    echo "[INFO] Access at http://localhost:${WEBSERVER_PORT}"
else
    echo "[WARN] Airflow Webserver is not responding (may still be starting)"
fi

# Check Airflow Scheduler
echo "[INFO] Checking Airflow Scheduler..."
if docker compose exec -T airflow-scheduler airflow jobs check --job-type SchedulerJob > /dev/null 2>&1; then
    echo "[SUCCESS] Airflow Scheduler is running"
else
    echo "[WARN] Airflow Scheduler check failed (may still be starting)"
fi

echo ""
echo "[INFO] Health check complete."
