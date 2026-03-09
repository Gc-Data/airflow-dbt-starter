name: ${dbt_project_name}
version: '1.0.0'
config-version: 2

profile: ${dbt_project_name}

model-paths: ["models"]
seed-paths: ["seeds"]
test-paths: ["tests"]
macro-paths: ["macros"]

clean-targets:
  - target
  - dbt_packages

models:
  ${dbt_project_name}:
    staging:
      +materialized: view
      +schema: staging
    marts:
      +materialized: table
      +schema: marts
