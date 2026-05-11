-- Backfill missing producer values to "Fingerlakes Farms".
--
-- Many produce SKUs (potatoes, onions) and a few outliers (duck eggs)
-- have no producer set, so the buyer-facing card shows a bare title
-- with no producer byline — while neighboring rows show "From <farm>".
-- For the gap, FLF itself is the implicit producer (own/co-packed),
-- so falling back to "Fingerlakes Farms" matches the truth on the
-- ground and keeps the catalog visually consistent.
--
-- Treats both NULL and whitespace-only strings as missing. Idempotent.

update products
   set producer = 'Fingerlakes Farms'
 where producer is null
    or btrim(producer) = '';
