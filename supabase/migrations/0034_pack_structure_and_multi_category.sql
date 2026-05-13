-- Add pack-size structure and multi-group visibility.
--
-- (1) pack_amount + pack_unit
--     Split the existing free-text pack_size into a structured (amount, unit)
--     pair so admin tools (and future filters like "all 32 oz milks") can
--     query on amount or unit independently. pack_size stays as the
--     buyer-facing display string and is kept in sync by import-csv.
--
-- (2) additional_groups
--     Lets a product appear in extra buyer-facing browse views beyond its
--     primary `product_group`. E.g. Hawthorne Valley krauts live in `produce`
--     primary but should also surface in the `dairy` browse; pickles stay
--     grocery-only. Catalog query is
--     `product_group = ? OR additional_groups @> ARRAY[?]`.

alter table products
  add column if not exists pack_amount numeric,
  add column if not exists pack_unit text,
  add column if not exists additional_groups text[] not null default '{}';

create index if not exists idx_products_additional_groups
  on products using gin (additional_groups);
