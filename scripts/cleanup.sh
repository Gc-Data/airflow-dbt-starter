#!/bin/bash
# Airflow + dbt Starter — Cleanup Script
set -e

cd "$(dirname "$0")/.."

echo "[INFO] Stopping all containers..."
docker compose down -v 2>&1 || true

echo "[INFO] Removing orphan containers..."
docker compose rm -f 2>&1 || true

echo "[SUCCESS] All containers and volumes removed."
