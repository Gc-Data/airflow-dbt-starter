# ⚡ Airflow + dbt Starter

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.7+](https://img.shields.io/badge/Python-3.7+-green.svg)](https://python.org)
[![Docker](https://img.shields.io/badge/Docker-Required-blue.svg)](https://docker.com)

### Complete data engineering stack with Apache Airflow, dbt Core and PostgreSQL — configured and running in 2 minutes.

[Versão em Português](README.md)

<!-- TODO: replace with wizard demo GIF -->
<!-- ![GC Data Templates - Airflow + dbt Starter](docs/assets/wizard-demo.gif) -->

---

## Why use this template?

- 🖥️ **Visual setup in 2 minutes** — web interface guides all configuration, no manual file editing
- 🔄 **Detects existing setup** — won't reconfigure from scratch, just starts services
- 📋 **One-click deploy** — visual stepper with real-time logs
- 🖥️ **Cross-platform** — works on Windows, Mac and Linux
- 🛢️ **SQL UI included** — built-in Adminer to query data right from the browser
- 🧪 **Real dbt project** — staging, marts, quality tests and seeds, not a toy example

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/gc-data/airflow-dbt-starter.git
cd airflow-dbt-starter

# 2. Run the wizard (only needs Python)
python setup.py

# 3. Configure via web interface and click "Deploy"
```

The wizard opens in your browser, checks prerequisites, and guides you through configuration.

<!-- TODO: add real screenshots -->
<!-- ![Setup Wizard - Welcome](docs/assets/wizard-welcome.png) -->
<!-- ![Setup Wizard - Deploy](docs/assets/wizard-deploy.png) -->

> **No Make?** All commands work directly: `bash scripts/deploy.sh`, `bash scripts/smoke-test.sh`, etc.

---

## What's Included

- **Apache Airflow 2.9** — Workflow orchestrator with web UI
- **dbt Core 1.8** — SQL-based data transformation
- **PostgreSQL 16** — Database as Airflow backend and dbt warehouse
- **Adminer** — Web SQL interface to browse and query data directly
- **3 example DAGs** — Simple ETL, dbt run, and task groups
- **Complete dbt project** — Seeds, staging models, marts, tests
- **Setup Wizard** — Web interface to configure everything without editing files

## Services

After deploy, the following services are available:

| Service | URL | Description |
|---------|-----|-------------|
| Airflow | http://localhost:8080 | Workflow orchestrator |
| Adminer | http://localhost:8081 | Web SQL interface |
| PostgreSQL | localhost:5432 | Database |

> Ports are configurable through the wizard.

---

## Example DAGs

| DAG | Description |
|-----|-------------|
| `example_simple_etl` | Basic ETL pipeline: extract → transform → load |
| `example_dbt_run` | Runs dbt: deps → seed → staging → marts → test |
| `example_task_groups` | Parallel extraction with Airflow 2.x Task Groups |

## dbt Models

### Staging (views)
- `stg_customers` — Cleaned and standardized customers
- `stg_orders` — Cleaned and standardized orders

### Marts (tables)
- `dim_customers` — Customer dimension with order metrics and tier classification
- `fct_orders` — Orders fact table enriched with customer data

---

## Useful Commands

```bash
make setup       # Open the setup wizard
make up          # Start containers
make down        # Stop containers
make logs        # Follow container logs
make health      # Check service health
make adminer     # Show Adminer URL (SQL UI)
make dbt-run     # Run dbt models
make dbt-test    # Run dbt tests
make dbt-seed    # Load seed data
make smoke-test  # End-to-end test
make clean       # Remove everything (containers + volumes)
```

> **No Make installed?** Run directly: `python setup.py`, `docker compose up -d`, `bash scripts/deploy.sh`, etc.

---

## Project Structure

```
airflow-dbt-starter/
├── setup.py                 ← Wizard (python setup.py)
├── wizard.json              ← Wizard configuration
├── Dockerfile               ← Airflow + dbt
├── Makefile                 ← Command shortcuts
├── setup-ui/                ← Wizard frontend (pre-built React)
├── src/
│   ├── dags/                ← Airflow DAGs
│   │   ├── example_simple.py
│   │   ├── example_dbt_run.py
│   │   └── example_task_groups.py
│   └── dbt/                 ← dbt project
│       ├── models/
│       │   ├── staging/     ← Cleaned views
│       │   └── marts/       ← Final tables
│       └── seeds/           ← Sample data
├── templates/               ← Config templates (.env, docker-compose, etc)
├── scripts/                 ← Deploy, cleanup, health check and smoke test scripts
└── docs/
```

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (with Docker Compose v2)
- [Python 3.7+](https://www.python.org/downloads/) (only for the wizard)

## Manual Configuration (without wizard)

If you prefer to configure manually:

1. Copy `templates/.env.tpl` to `.env` and fill in the values
2. Copy `templates/docker-compose.yml.tpl` to `docker-compose.yml`
3. Copy `templates/profiles.yml.tpl` to `src/dbt/profiles.yml`
4. Copy `templates/dbt_project.yml.tpl` to `src/dbt/dbt_project.yml`
5. Run `docker compose up -d`

---

## Troubleshooting

**Airflow is slow to start:** On first run, Airflow needs to create the database, run migrations, and create the admin user. This can take 30-60 seconds.

**Port already in use:** The wizard lets you choose different ports. If configuring manually, edit `.env`.

**dbt fails on first run:** Make sure PostgreSQL is healthy before running `make dbt-run`. Use `make health` to check.

**Containers won't start:** Verify Docker is running with `docker info`. On Windows, confirm Docker Desktop is active.

---

## Like it?

⭐ Star this repository — it helps more people find the project.

🎓 **Learn to build pipelines like this** at [GC Data Academy](https://gcdatac.com/academy) — a new data engineering challenge every week.

🚀 Check out our [premium templates](https://gcdatac.com/templates) — smart alerts for Airflow, GCP security with Terraform, and more.

---

**Made by [GC Data](https://gcdatac.com)** | [Academy](https://gcdatac.com/academy) · [Templates](https://gcdatac.com/templates) · [Consulting](https://gcdatac.com/consulting)
