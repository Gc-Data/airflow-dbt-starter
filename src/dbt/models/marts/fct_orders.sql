-- Mart: orders fact table enriched with customer data
with orders as (
    select * from {{ ref('stg_orders') }}
),

customers as (
    select * from {{ ref('stg_customers') }}
)

select
    o.order_id,
    o.customer_id,
    c.customer_name,
    c.email as customer_email,
    o.order_amount,
    o.order_status,
    o.order_date,
    extract(month from o.order_date) as order_month,
    extract(year from o.order_date) as order_year
from orders o
left join customers c on o.customer_id = c.customer_id
