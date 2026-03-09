${dbt_project_name}:
  target: dev
  outputs:
    dev:
      type: postgres
      host: postgres
      port: 5432
      user: ${postgres_user}
      password: ${postgres_password}
      dbname: ${postgres_db}
      schema: ${dbt_schema}
      threads: 4
