FROM apache/airflow:2.9.3-python3.11

USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

USER airflow

# Install Airflow postgres provider (version pinned to match Airflow 2.9.3 constraints)
RUN pip install --no-cache-dir \
    "apache-airflow-providers-postgres==5.11.2" \
    --constraint "https://raw.githubusercontent.com/apache/airflow/constraints-2.9.3/constraints-3.11.txt"

# Install dbt-postgres separately to avoid resolver conflicts with Airflow deps
RUN pip install --no-cache-dir \
    "dbt-postgres==1.8.2"

# NOTE: docker-compose.yml mounts these as volumes (overriding COPY at runtime).
# The COPY is kept intentionally so the image works standalone without compose.
COPY --chown=airflow:root src/dags /opt/airflow/dags
COPY --chown=airflow:root src/dbt /opt/airflow/dbt
