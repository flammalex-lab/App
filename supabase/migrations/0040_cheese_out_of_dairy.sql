-- Cheese out of dairy.
--
-- Buyer feedback: "No Cheese should not be in the dairy category — not
-- specialty cheese, not cheese, not soft, not alpine."
--
-- Background: 'cheese' has been a top-level category since 0022 and the
-- buyer-facing constants (src/lib/constants.ts CATEGORY_LABELS, GROUPS,
-- buyer-type allowlist) already treat it as its own group. The
-- sub-category mapper (src/lib/products/sub-category.ts) also already
-- buckets cheese-flavors under category='cheese' with patterns for
-- Fresh & soft / Alpine / Aged & hard / Cheddar / Blue.
--
-- The bug is purely a data state problem: rows that an admin tagged with
-- a cheese-flavor `sub_category` (added in 0033) — or whose
-- product_group is 'cheese' (set in 0006) — are still sitting at
-- category='dairy'. Those rows render under the Dairy tab even though
-- the catalog already knows they're cheese. Move them.
--
-- Idempotent — gates on the row not already being correct. No DDL, no
-- enum changes (cheese is already in category_t).

do $$
declare
  moved_sub int := 0;
  moved_grp int := 0;
begin
  -- 1. sub_category-driven move. Admin-set on the name-review CSV editor
  --    after 0033. Match the cheese-bucket labels emitted by
  --    src/lib/products/sub-category.ts (Fresh & soft / Alpine /
  --    Aged & hard / Cheddar / Blue / Specialty fallback) plus the raw
  --    buyer-feedback strings (cheese / specialty cheese / soft cheese /
  --    alpine cheese) in case the CSV uses those literals. ILIKE so
  --    case/spacing variants ("alpine", "Alpine", "ALPINE") all land.
  with bumped as (
    update products
       set category = 'cheese'::category_t
     where category::text = 'dairy'
       and sub_category is not null
       and (
            sub_category ilike 'cheese'
         or sub_category ilike 'specialty%cheese%'
         or sub_category ilike 'specialty'
         or sub_category ilike 'soft%cheese%'
         or sub_category ilike 'fresh & soft'
         or sub_category ilike 'alpine'
         or sub_category ilike 'alpine%cheese%'
         or sub_category ilike 'aged & hard'
         or sub_category ilike 'cheddar'
         or sub_category ilike 'blue'
       )
    returning 1
  )
  select count(*) into moved_sub from bumped;

  -- 2. product_group='cheese' fallback. 0006 set this on every cheese-y
  --    row by name+producer match; 0022 then promoted matching dairy
  --    rows to category='cheese'. If anything's drifted back to dairy
  --    since (ad-hoc edits, re-imports), catch it here. Same signal
  --    0022 used, scoped to dairy so we don't churn other categories.
  with bumped as (
    update products
       set category = 'cheese'::category_t
     where category::text = 'dairy'
       and product_group = 'cheese'
    returning 1
  )
  select count(*) into moved_grp from bumped;

  raise notice 'cheese-out-of-dairy: moved % rows by sub_category, % rows by product_group',
    moved_sub, moved_grp;
end $$;

-- 3. Mirror product_group so the buyer-type filter (cheese_buyer sees
--    product_group='cheese' rows; dairy_buyer hides them) stays
--    consistent with the new category. Safe — anything we just moved
--    into cheese category should also be in the cheese buyer group.
update products
   set product_group = 'cheese'
 where category::text = 'cheese'
   and product_group is distinct from 'cheese';
