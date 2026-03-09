-- Staging: customers cleaned and standardized
with source as (
    select * from {{ ref('raw_customers') }}
)

select
    id as customer_id,
    trim(name) as customer_name,
    lower(trim(email)) as email,
    created_at::date as registered_at
from source
