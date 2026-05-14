-- Performance indexes for frequently-queried FK / lookup / containment paths
-- discovered during the full-code audit. All are CREATE INDEX IF NOT EXISTS
-- so this migration is safe to re-run.
--
-- M17: orders.placed_by_id is an FK to profiles(id) with no index. Admin
--      "orders submitted by rep X" view currently seq-scans the orders
--      table. Partial index (placed_by_id is not null) keeps it tight
--      since the column is null for buyer-self-submitted orders.
create index if not exists idx_orders_placed_by_id
  on orders(placed_by_id)
  where placed_by_id is not null;

-- M18: products.upc already has a raw-value index from 0015, but barcode
--      scanner lookups go through lower(upc) for case-insensitive match
--      and miss the existing index. Functional index on lower(upc) fixes
--      that without removing the raw-value index (still used for exact
--      admin lookups).
create index if not exists idx_products_upc_lower
  on products(lower(upc))
  where upc is not null;

-- M19: accounts.enabled_categories is a text[]/category_t[] column queried
--      with the @> containment operator ("does this account see category
--      X?"). A GIN index makes those predicates index-scan instead of
--      array-unnest per row.
create index if not exists idx_accounts_enabled_categories_gin
  on accounts using gin(enabled_categories);

-- L12: stripe_events.received_at lets future janitor jobs prune old
--      idempotency rows (delete from stripe_events where received_at <
--      now() - interval '90 days') with a range scan instead of a full
--      table scan. Cheap to add now.
create index if not exists idx_stripe_events_received_at
  on stripe_events(received_at);
