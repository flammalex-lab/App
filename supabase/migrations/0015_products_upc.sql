-- =========================
-- UPC / barcode column on products
-- =========================
-- Optional retail barcode (12-digit UPC-A, 13-digit EAN-13, etc.) so the
-- buyer-side barcode scanner can look up a product without relying on
-- our internal SKU matching whatever the printed label says.
--
-- Case-insensitive index so product lookups on scanned codes are fast
-- even if the code was entered with mixed case (e.g. hex-like EAN-8
-- codes or Code 128 strings).

alter table products
  add column if not exists upc text;

create index if not exists idx_products_upc on products (upc) where upc is not null;

comment on column products.upc is
  'Printed retail barcode (UPC-A / EAN-13 / Code 128 / etc.). Populated
   for items the buyer can scan in their kitchen. Distinct from
   products.sku, which is our internal order SKU.';
