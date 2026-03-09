"""
Example DAG — Simple ETL Pipeline
A basic DAG demonstrating extract, transform, load pattern with Airflow.
"""

from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.bash import BashOperator
from airflow.operators.python import PythonOperator

default_args = {
    "owner": "gc-data",
    "depends_on_past": False,
    "email_on_failure": False,
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
}

with DAG(
    dag_id="example_simple_etl",
    default_args=default_args,
    description="Simple ETL pipeline example",
    schedule="@daily",
    start_date=datetime(2024, 1, 1),
    catchup=False,
    tags=["example", "etl"],
) as dag:

    extract = BashOperator(
        task_id="extract",
        bash_command='echo "[INFO] Extracting data from source..." && sleep 2 && echo "[SUCCESS] Extraction complete"',
    )

    def _transform(**context):
        print("[INFO] Transforming data...")
        # Simulate transformation logic
        records = [
            {"id": 1, "name": "Alice", "score": 95},
            {"id": 2, "name": "Bob", "score": 87},
            {"id": 3, "name": "Carol", "score": 92},
        ]
        print(f"[INFO] Processed {len(records)} records")
        return records

    transform = PythonOperator(
        task_id="transform",
        python_callable=_transform,
    )

    load = BashOperator(
        task_id="load",
        bash_command='echo "[INFO] Loading data into warehouse..." && sleep 1 && echo "[SUCCESS] Load complete"',
    )

    extract >> transform >> load
