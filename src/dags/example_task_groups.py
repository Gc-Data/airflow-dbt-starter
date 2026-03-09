"""
Example DAG — Task Groups
Demonstrates Airflow 2.x TaskGroups for organizing complex pipelines.
Pattern: extract multiple sources in parallel, then transform, then load.
"""

from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.bash import BashOperator
from airflow.utils.task_group import TaskGroup

default_args = {
    "owner": "gc-data",
    "depends_on_past": False,
    "email_on_failure": False,
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
}

with DAG(
    dag_id="example_task_groups",
    default_args=default_args,
    description="Parallel extraction with task groups",
    schedule="@daily",
    start_date=datetime(2024, 1, 1),
    catchup=False,
    tags=["example", "task-groups"],
) as dag:

    start = BashOperator(
        task_id="start",
        bash_command='echo "[INFO] Pipeline starting..."',
    )

    with TaskGroup("extract_sources") as extract_group:
        for source in ["crm", "erp", "analytics"]:
            BashOperator(
                task_id=f"extract_{source}",
                bash_command=f'echo "[INFO] Extracting from {source}..." && sleep 2 && echo "[SUCCESS] {source} done"',
            )

    with TaskGroup("transform") as transform_group:
        clean = BashOperator(
            task_id="clean_data",
            bash_command='echo "[INFO] Cleaning data..." && sleep 1',
        )
        enrich = BashOperator(
            task_id="enrich_data",
            bash_command='echo "[INFO] Enriching data..." && sleep 1',
        )
        clean >> enrich

    load = BashOperator(
        task_id="load_warehouse",
        bash_command='echo "[INFO] Loading into warehouse..." && sleep 1 && echo "[SUCCESS] Pipeline complete"',
    )

    start >> extract_group >> transform_group >> load
