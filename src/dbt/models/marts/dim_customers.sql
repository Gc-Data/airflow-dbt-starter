-- Mart: customer dimension with order metrics
with customers as (
    select * from {{ ref('stg_customers') }}
),

orders as (
    select * from {{ ref('stg_orders') }}
),

customer_orders as (
    select
        customer_id,
        count(*) as total_orders,
        count(*) filter (where order_status = 'completed') as completed_orders,
        sum(order_amount) filter (where order_status = 'completed') as total_revenue,
        min(order_date) as first_order_date,
        max(order_date) as last_order_date
    from orders
    group by customer_id
)

select
    c.customer_id,
    c.customer_name,
    c.email,
    c.registered_at,
    coalesce(co.total_orders, 0) as total_orders,
    coalesce(co.completed_orders, 0) as completed_orders,
    coalesce(co.total_revenue, 0) as total_revenue,
    co.first_order_date,
    co.last_order_date,
    case
        when co.total_revenue >= 300 then 'gold'
        when co.total_revenue >= 100 then 'silver'
        else 'bronze'
    end as customer_tier
from customers c
left join customer_orders co on c.customer_id = co.customer_id
