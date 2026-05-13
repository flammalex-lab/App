-- Manual sub-category override for the buyer-facing catalog grouping.
-- Until now the catalog/guide strips were keyword-derived
-- (src/lib/products/sub-category.ts). That heuristic gets most names
-- right but mis-buckets edge cases (e.g. "Strawberry-Apple Juice" in
-- beverages can't tell juice vs. fruit). Adding the column lets the
-- name-review CSV editor write an explicit bucket per product; the
-- grouper falls back to the regex when this column is null.

alter table products add column if not exists sub_category text;
create index if not exists idx_products_sub_category on products(sub_category)
  where sub_category is not null;
