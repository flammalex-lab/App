-- 0035: indexes and an aggregated RPC for buyer-history reads.
--
-- The buyer portal hits order_items hard:
--   * /guide loads the buyer's full history (join through orders.profile_id)
--     to compute last-ordered, producer rank, and new-from-producers
--   * /catalog landing's "based on your order history" strip scans
--     up to 200 of the buyer's order_items
--   * /catalog category views compute per-product / per-producer rank
--     from order_items filtered by product_id and joined through orders
--
-- order_items only had its FKs declared (order_id, product_id) — and
-- Postgres does NOT auto-index FKs. Every one of these reads was doing a
-- sequential scan on the full order_items table. With buyers placing
-- many orders over the season this gets slow fast.

-- =============================================================
-- Indexes
-- =============================================================
create index if not exists idx_order_items_order_id
  on order_items (order_id);

create index if not exists idx_order_items_product_id
  on order_items (product_id);

-- =============================================================
-- Aggregated buyer-product rank
--
-- Replaces the JS-side aggregation that fetched every order_items row
-- for a buyer and summed quantities in the app. The function:
--   * sums quantity per product
--   * returns the product's current producer (joined via products)
--   * returns the max(order created_at) so the guide's last-ordered
--     lookup stays cheap
--
-- One row per (product_id, producer) pair, instead of N rows per
-- order_items history — usually 10–100x fewer rows over the wire.
-- =============================================================
create or replace function buyer_product_history(p_profile_id uuid)
returns table (
  product_id uuid,
  qty numeric,
  producer text,
  last_ordered_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    oi.product_id,
    sum(oi.quantity)::numeric as qty,
    p.producer,
    max(o.created_at) as last_ordered_at
  from order_items oi
  join orders o on o.id = oi.order_id
  join products p on p.id = oi.product_id
  where o.profile_id = p_profile_id
  group by oi.product_id, p.producer
$$;

-- Buyers query their own history (RLS on orders.profile_id = auth.uid()
-- already filters this); admins use the service-role client and bypass
-- RLS. Grant execute to authenticated so the cookie-based client can call.
grant execute on function buyer_product_history(uuid) to authenticated;
