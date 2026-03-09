.PHONY: setup up down restart logs ps health adminer dbt-run dbt-test dbt-seed dbt-docs clean smoke-test

# Setup wizard
setup:
	python setup.py

# Docker Compose
up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose restart

logs:
	docker compose logs -f

ps:
	docker compose ps

# Health check
health:
	bash scripts/health-check.sh

# Adminer (SQL UI)
adminer:
	@echo "Adminer: http://localhost:$$(grep ADMINER_PORT .env 2>/dev/null | cut -d= -f2 || echo 8081)"

# dbt commands (run inside the airflow-scheduler container)
dbt-run:
	docker compose exec airflow-scheduler bash -c "cd /opt/airflow/dbt && dbt run --profiles-dir /opt/airflow/dbt"

dbt-test:
	docker compose exec airflow-scheduler bash -c "cd /opt/airflow/dbt && dbt test --profiles-dir /opt/airflow/dbt"

dbt-seed:
	docker compose exec airflow-scheduler bash -c "cd /opt/airflow/dbt && dbt seed --profiles-dir /opt/airflow/dbt"

dbt-docs:
	docker compose exec airflow-scheduler bash -c "cd /opt/airflow/dbt && dbt docs generate --profiles-dir /opt/airflow/dbt"

# Smoke test (build, deploy, dbt, verify, cleanup)
smoke-test:
	bash scripts/smoke-test.sh

# Full cleanup (containers + volumes)
clean:
	docker compose down -v
	@echo "All containers and volumes removed."
