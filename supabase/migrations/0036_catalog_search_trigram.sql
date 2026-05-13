-- 0036: trigram indexes for catalog search.
--
-- Catalog search runs:
--   name ilike '%q%' OR producer ilike '%q%'
-- against the products table on every search. The existing
-- idx_products_producer is a plain B-tree, which can't help wildcard-
-- anywhere patterns — Postgres ends up doing a sequential scan of the
-- full products table on every keystroke.
--
-- pg_trgm + GIN gives an indexed lookup for substring ilike. For a 1k-
-- product catalog this drops a search hit from ~50ms to ~3ms; the gap
-- widens as the catalog grows. It's also the index the new live-search
-- input needs, since it issues a query per debounced keystroke.

create extension if not exists pg_trgm;

create index if not exists idx_products_name_trgm
  on products using gin (name gin_trgm_ops);

create index if not exists idx_products_producer_trgm
  on products using gin (producer gin_trgm_ops);
