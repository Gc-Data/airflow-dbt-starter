-- Staging: orders cleaned and standardized
with source as (
    select * from {{ ref('raw_orders') }}
)

select
    id as order_id,
    customer_id,
    amount::numeric(10, 2) as order_amount,
    status as order_status,
    ordered_at::date as order_date
from source
