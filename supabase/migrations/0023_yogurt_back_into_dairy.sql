-- Yogurt is dairy, not cheese.
--
-- Production diagnostic showed DY-YGB-001 and DY-YGB-032 (Ithaca Milk
-- Yogurt — Blueberry, 6oz + 32oz) sitting at category='cheese',
-- product_group='cheese'. Every other Ithaca Milk Yogurt SKU
-- (Plain / Vanilla / Black Cherry / Lemon / Maple / Peach / Strawberry)
-- is correctly category='dairy'.
--
-- Trace: at some point in production those two rows had category set to
-- 'cheese' via an ad-hoc edit. Migration 0020 then backfilled
-- product_group='cheese' for any row with category='cheese' (intentional
-- — preserves the buyer-facing cheese distinction during the cheese ->
-- dairy fold). Migration 0022 then re-categorized everything with
-- product_group='cheese' back to category='cheese' when cheese got
-- recovered as its own category. Net result: yogurts stuck on the cheese
-- side.
--
-- Fix: anything whose name contains "Yogurt" (case-insensitive) is dairy.
-- Yogurt is never cheese — there's no overlap class to worry about. Run
-- broadly so any future ad-hoc edit that miscategorizes a yogurt also
-- gets corrected when the next migration cycle ships.
--
-- Idempotent: gates on the row not already being correct.

update products
   set category = 'dairy'::category_t
 where name ilike '%yogurt%'
   and category::text <> 'dairy';

update products
   set product_group = 'dairy'
 where name ilike '%yogurt%'
   and product_group is distinct from 'dairy';
