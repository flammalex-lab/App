-- =========================================================================
-- Structured payload for chat system messages + product variants + delivery fee
-- =========================================================================

-- 1. messages.payload: structured data for system-posted messages so the
--    chat UI renders rich cards without parsing free-text bodies.
--    Shape (for order summaries):
--      { kind: 'order_placed', order_id, order_number, items, subtotal,
--        total, delivery_date, pickup_date }
alter table messages add column if not exists payload jsonb;

-- 2. products.pack_options: a product can be sold multiple ways (Case,
--    Each, Half-case) with different SKUs and prices. Stored as an ordered
--    jsonb array; the product row's own unit/pack_size/wholesale_price
--    remain the DEFAULT option. A non-default entry looks like:
--      { key, label, unit, pack_size, sku, wholesale_price, retail_price,
--        avg_weight_lbs }
alter table products add column if not exists pack_options jsonb;

-- 3. products.price_by_weight: catch-weight items (sides of beef, primals)
--    have a final line price confirmed at fulfillment. Drives a cart
--    banner: "Final price confirmed by distributor".
alter table products add column if not exists price_by_weight boolean not null default false;

-- 4. Record which pack-variant was ordered on each order line. Null =
--    the product's default unit.
alter table order_items
  add column if not exists pack_variant_key text,
  add column if not exists pack_variant_sku text;

-- 5. Per-zone delivery fee. order_minimum already exists.
alter table delivery_zones add column if not exists delivery_fee numeric not null default 0;
