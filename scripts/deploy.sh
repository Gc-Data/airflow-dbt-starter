#!/bin/bash
# Airflow + dbt Starter — Deploy Script
set -e

cd "$(dirname "$0")/.."

# Load env vars (for port references in health checks and log messages)
# shellcheck disable=SC1091
source .env 2>/dev/null || true

echo "[INFO] Starting deploy..."

if [ ! -f .env ]; then
    echo "[ERROR] .env not found. Run 'python setup.py' first."
    exit 1
fi

if [ ! -f docker-compose.yml ]; then
    echo "[ERROR] docker-compose.yml not found. Run 'python setup.py' first."
    exit 1
fi

echo "[INFO] Building Airflow image (with dbt)..."
docker compose build 2>&1

echo "[INFO] Starting containers..."
docker compose up -d 2>&1 || true

echo "[INFO] Waiting for airflow-init to complete..."
for i in $(seq 1 30); do
    status=$(docker inspect --format='{{.State.Status}}' starter-airflow-init 2>/dev/null || echo "missing")
    if [ "$status" = "exited" ]; then
        exit_code=$(docker inspect --format='{{.State.ExitCode}}' starter-airflow-init 2>/dev/null || echo "1")
        if [ "$exit_code" = "0" ]; then
            echo "[INFO] airflow-init completed successfully."
            break
        else
            echo "[ERROR] airflow-init exited with code $exit_code."
            docker compose logs airflow-init 2>&1 | tail -20
            exit 1
        fi
    fi
    sleep 3
done

if [ "$status" != "exited" ]; then
    echo "[ERROR] airflow-init did not complete within 90s (status: $status)."
    docker compose logs airflow-init 2>&1 | tail -20
    exit 1
fi

echo "[INFO] Checking container status..."
docker compose ps 2>&1

echo "[INFO] Waiting for Airflow Webserver to be healthy..."
for i in $(seq 1 30); do
    if curl -sf http://localhost:${AIRFLOW_WEBSERVER_PORT:-8080}/health > /dev/null 2>&1; then
        echo "[SUCCESS] Airflow Webserver is healthy!"
        break
    fi
    sleep 2
done

# Run dbt
echo "[INFO] Running dbt (seed + run + test)..."
docker compose exec -T airflow-scheduler bash -c \
  "cd /opt/airflow/dbt && dbt seed --profiles-dir . && dbt run --profiles-dir . && dbt test --profiles-dir ." 2>&1

if [ $? -eq 0 ]; then
    echo "[SUCCESS] dbt completed successfully!"
else
    echo "[WARN] dbt finished with errors. Check the logs above."
fi

echo ""
echo "[SUCCESS] Test completed!"
echo "[INFO] Access Airflow at http://localhost:${AIRFLOW_WEBSERVER_PORT:-8080}"
echo "[INFO] Use 'Cleanup' to remove the containers when done."
