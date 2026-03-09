# Airflow + dbt Starter — Cleanup Script (Windows)
$ErrorActionPreference = "Continue"

Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Output "[INFO] Stopping all containers..."
docker compose down -v 2>&1 | ForEach-Object { Write-Output $_ }

Write-Output "[INFO] Removing orphan containers..."
docker compose rm -f 2>&1 | ForEach-Object { Write-Output $_ }

Write-Output "[SUCCESS] All containers and volumes removed."
