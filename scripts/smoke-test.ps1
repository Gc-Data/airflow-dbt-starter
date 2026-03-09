# Airflow + dbt Starter — Smoke Test (Windows)
# Builds, deploys, runs dbt, verifies tables, then tears everything down.
$ErrorActionPreference = "Stop"

Push-Location (Split-Path -Parent $PSScriptRoot)

$pass = 0
$fail = 0
$summary = @()

function Log($msg) { Write-Host "[INFO] $msg" }
function Pass($msg) { $script:pass++; $script:summary += "  [PASS] $msg"; Write-Host "  [PASS] $msg" }
function Fail($msg) { $script:fail++; $script:summary += "  [FAIL] $msg"; Write-Host "  [FAIL] $msg" }

function Cleanup {
    Log "Cleaning up..."
    docker compose down -v 2>$null
}

try {
    # -- 1. Check generated files --
    Log "Checking generated config files..."
    foreach ($f in @(".env", "docker-compose.yml")) {
        if (Test-Path $f) {
            Pass "$f exists"
        } else {
            Fail "$f not found - run 'python setup.py' first"
            Write-Host ""
            Write-Host "[FAILED] Cannot continue without generated config files."
            exit 1
        }
    }

    # Load env vars
    if (Test-Path .env) {
        Get-Content .env | ForEach-Object {
            if ($_ -match "^([^#][^=]+)=(.*)$") {
                [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
            }
        }
    }

    $pgUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "airflow" }
    $pgDb = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "airflow" }
    $wsPort = if ($env:AIRFLOW_WEBSERVER_PORT) { $env:AIRFLOW_WEBSERVER_PORT } else { "8080" }

    # -- 2. Build --
    Log "Building Docker images..."
    docker compose build 2>&1
    if ($LASTEXITCODE -eq 0) { Pass "docker compose build" } else { Fail "docker compose build"; exit 1 }

    # -- 3. Start containers --
    Log "Starting containers..."
    docker compose up -d 2>&1

    # -- 4. Wait for airflow-init --
    Log "Waiting for airflow-init to complete (up to 90s)..."
    $initOk = $false
    for ($i = 0; $i -lt 30; $i++) {
        $status = docker inspect --format='{{.State.Status}}' starter-airflow-init 2>$null
        if ($status -eq "exited") {
            $exitCode = docker inspect --format='{{.State.ExitCode}}' starter-airflow-init 2>$null
            if ($exitCode -eq "0") {
                $initOk = $true
                break
            } else {
                Fail "airflow-init exited with code $exitCode"
                docker compose logs airflow-init 2>&1 | Select-Object -Last 20
                Write-Host "[FAILED] airflow-init failed."
                exit 1
            }
        }
        Start-Sleep -Seconds 3
    }

    if ($initOk) { Pass "airflow-init completed" }
    else { Fail "airflow-init did not complete within 90s"; Write-Host "[FAILED] airflow-init timed out."; exit 1 }

    # -- 5. Wait for webserver health --
    Log "Waiting for Airflow Webserver to be healthy (up to 60s)..."
    $wsOk = $false
    for ($i = 0; $i -lt 30; $i++) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:${wsPort}/health" -UseBasicParsing -ErrorAction Stop
            if ($response.StatusCode -eq 200) { $wsOk = $true; break }
        } catch {}
        Start-Sleep -Seconds 2
    }

    if ($wsOk) { Pass "Airflow Webserver healthy" }
    else { Fail "Airflow Webserver not healthy within 60s" }

    # -- 6. Run dbt seed + run + test --
    Log "Running dbt seed + run + test inside airflow-scheduler..."
    docker compose exec -T airflow-scheduler bash -c "cd /opt/airflow/dbt && dbt seed --profiles-dir . && dbt run --profiles-dir . && dbt test --profiles-dir ." 2>&1
    if ($LASTEXITCODE -eq 0) { Pass "dbt seed + run + test" } else { Fail "dbt seed + run + test" }

    # -- 7. Verify tables in PostgreSQL --
    Log "Verifying tables in PostgreSQL..."
    $tablesOutput = docker compose exec -T postgres psql -U $pgUser -d $pgDb -c "\dt staging.*" -c "\dt marts.*" 2>&1
    $tablesStr = $tablesOutput -join "`n"
    Write-Host $tablesStr

    if ($tablesStr -match "staging\.|marts\.") { Pass "Tables found in staging/marts schemas" }
    else { Fail "No tables found in staging/marts schemas" }

} finally {
    Cleanup
    Pop-Location
}

# -- Summary --
Write-Host ""
Write-Host "========================================"
Write-Host " Smoke Test Results: $pass passed, $fail failed"
Write-Host "========================================"
$summary | ForEach-Object { Write-Host $_ }
Write-Host ""

if ($fail -eq 0) {
    Write-Host "[SUCCESS] All smoke tests passed!"
    exit 0
} else {
    Write-Host "[FAILED] $fail test(s) failed."
    exit 1
}
