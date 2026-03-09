# Airflow + dbt Starter — Health Check (Windows)
$ErrorActionPreference = "Continue"

Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Output "[INFO] Running health checks..."
Write-Output ""

Write-Output "[INFO] Container status:"
docker compose ps 2>&1 | ForEach-Object { Write-Output $_ }
Write-Output ""

Write-Output "[INFO] Checking Airflow Webserver..."
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8080/health" -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Output "[SUCCESS] Airflow Webserver is healthy"
        Write-Output "[INFO] Access at http://localhost:8080"
    }
} catch {
    Write-Output "[WARN] Airflow Webserver is not responding (may still be starting)"
}

Write-Output ""
Write-Output "[INFO] Health check complete."
