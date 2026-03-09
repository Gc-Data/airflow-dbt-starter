# Airflow + dbt Starter — Deploy Script (Windows)
$ErrorActionPreference = "Continue"

Set-Location (Split-Path $PSScriptRoot -Parent)

function Run-Docker {
    param([string]$Arguments)
    $pinfo = New-Object System.Diagnostics.ProcessStartInfo
    $pinfo.FileName = "docker"
    $pinfo.Arguments = $Arguments
    $pinfo.RedirectStandardOutput = $true
    $pinfo.RedirectStandardError = $true
    $pinfo.UseShellExecute = $false
    $pinfo.CreateNoWindow = $true

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $pinfo
    $process.Start() | Out-Null

    while (-not $process.StandardOutput.EndOfStream) {
        $line = $process.StandardOutput.ReadLine()
        if ($line) { Write-Output $line }
    }
    $errOut = $process.StandardError.ReadToEnd()
    if ($errOut) {
        $errOut.Split("`n") | ForEach-Object {
            $trimmed = $_.Trim()
            if ($trimmed) { Write-Output $trimmed }
        }
    }
    $process.WaitForExit()
    return $process.ExitCode
}

Write-Output "[INFO] Starting deploy..."

if (-not (Test-Path ".env")) {
    Write-Output "[ERROR] .env not found. Run 'python setup.py' first."
    exit 1
}

if (-not (Test-Path "docker-compose.yml")) {
    Write-Output "[ERROR] docker-compose.yml not found. Run 'python setup.py' first."
    exit 1
}

## Load .env to get port config
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^\s*([A-Z_]+)\s*=\s*(.+)$') {
            [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2].Trim())
        }
    }
}
$webPort = if ($env:AIRFLOW_WEBSERVER_PORT) { $env:AIRFLOW_WEBSERVER_PORT } else { "8080" }

# Detect compose project name (= directory name, same as Docker default)
$project = (Get-Item .).Name

function Wait-AirflowInit {
    Write-Output "[INFO] Waiting for airflow-init to complete..."
    for ($i = 1; $i -le 30; $i++) {
        $status = docker inspect --format '{{.State.Status}}' "${project}-airflow-init-1" 2>$null
        if ($LASTEXITCODE -ne 0) { $status = "missing" }
        if ($status -eq "exited") {
            $code = docker inspect --format '{{.State.ExitCode}}' "${project}-airflow-init-1" 2>$null
            if ($code -eq "0") {
                Write-Output "[INFO] airflow-init completed successfully."
                return $true
            } else {
                Write-Output "[ERROR] airflow-init exited with code $code."
                Run-Docker "compose logs airflow-init" | Select-Object -Last 20
                return $false
            }
        }
        Start-Sleep -Seconds 3
    }
    Write-Output "[ERROR] airflow-init did not complete within 90s (status: $status)."
    Run-Docker "compose logs airflow-init" | Select-Object -Last 20
    return $false
}

function Wait-WebserverHealth {
    Write-Output "[INFO] Waiting for Airflow Webserver to be healthy..."
    for ($i = 1; $i -le 30; $i++) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:${webPort}/health" -UseBasicParsing -TimeoutSec 3
            if ($response.StatusCode -eq 200) {
                Write-Output "[SUCCESS] Airflow Webserver is healthy!"
                return $true
            }
        } catch {}
        Start-Sleep -Seconds 2
    }
    Write-Output "[WARN] Airflow Webserver not yet responding. It may still be initializing."
    Write-Output "[INFO] Check logs with: docker compose logs -f airflow-webserver"
    return $false
}

Write-Output "[INFO] Building Airflow image (with dbt)..."
Run-Docker "compose build"

Write-Output "[INFO] Starting containers..."
Run-Docker "compose up -d"

if (-not (Wait-AirflowInit)) { exit 1 }

Write-Output "[INFO] Checking container status..."
Run-Docker "compose ps"

Wait-WebserverHealth | Out-Null

# Run dbt
Write-Output "[INFO] Running dbt (seed + run + test)..."
Run-Docker "compose exec -T airflow-scheduler bash -c `"cd /opt/airflow/dbt && dbt seed --profiles-dir . && dbt run --profiles-dir . && dbt test --profiles-dir .`""

if ($LASTEXITCODE -eq 0) {
    Write-Output "[SUCCESS] dbt completed successfully!"
} else {
    Write-Output "[WARN] dbt finished with errors. Check the logs above."
}

Write-Output ""
Write-Output "[SUCCESS] Test completed!"
Write-Output "[INFO] Access Airflow at http://localhost:${webPort}"
Write-Output "[INFO] Use 'Cleanup' to remove the containers when done."
