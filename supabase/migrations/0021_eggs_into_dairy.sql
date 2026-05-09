-- Fold 'eggs' into the 'dairy' category, and clean up product names so
-- milk and egg variants always say "milk" / "eggs" in the name itself.
--
-- Same reasoning as 0020: buyers already see eggs grouped with dairy under
-- the "Dairy & Cheese" group on the catalog (see migrations 0006 + 0012),
-- so the separate enum value just forced extra checkbox / picker UI without
-- ever changing what a buyer or admin sees.
--
-- Naming: a fluid milk or egg product whose name is "Whole — Gallon" or
-- "Large Brown — Carton" reads ambiguously in the order guide — buyers
-- expect "Whole Milk — Gallon" and "Large Brown Eggs — Carton". Inserts the
-- missing word right before the em-dash that separates pack info.
--
-- Idempotent: re-running is a no-op once names already contain "milk" /
-- "eggs" and no rows still have category='eggs'.

-- 1. Update product names. Done BEFORE the category migration so the
--    category filter still works.

-- 1a. Eggs: insert "Eggs" before the em-dash if the name doesn't already
--     contain "egg".
update products
   set name = regexp_replace(name, '\s+—\s+', ' Eggs — ')
 where category::text = 'eggs'
   and name !~* 'egg';

-- 1b. Restructure "Ithaca Milk Whole — Gallon" → "Ithaca Whole Milk — Gallon"
--     so the type adjective is adjacent to "Milk".
update products
   set name = regexp_replace(name, '^Ithaca Milk (Whole|Skim|Low Fat|Reduced Fat|2%|1%)\s', 'Ithaca \1 Milk ')
 where name ~ '^Ithaca Milk (Whole|Skim|Low Fat|Reduced Fat|2%|1%)\s';

-- 1c. Fluid-milk products that have a fat-content adjective but no "milk"
--     in the name — insert "Milk" before the em-dash. Excludes butter /
--     cream / yogurt / cheese variants that share the same adjectives but
--     aren't milk.
update products
   set name = regexp_replace(name, '\s(Whole|Skim|Reduced Fat|Low Fat|2%|1%)\s+—', ' \1 Milk —')
 where category::text in ('dairy', 'eggs')
   and name ~ '\s(Whole|Skim|Reduced Fat|Low Fat|2%|1%)\s+—'
   and name !~* '\ymilk\y'
   and name !~* '(yogurt|cheese|cream|butter|kefir|ricotta|mozzarella|cheddar|brie|gouda|feta|chocolate)';

-- 2. Move products with category='eggs' to category='dairy'.
update products
   set category = 'dairy'::category_t
 where category::text = 'eggs';

-- 3. Update accounts.enabled_categories: replace eggs with dairy (dedup).
update accounts
   set enabled_categories = (
     select array_agg(distinct cat)
       from (
         select case when c::text = 'eggs' then 'dairy' else c::text end::category_t as cat
           from unnest(enabled_categories) as c
       ) sub
   )
 where exists (
   select 1 from unnest(enabled_categories) c where c::text = 'eggs'
 );

-- 4. Drop the QB income-account row for eggs. Egg sales now book to the
--    dairy account; admin can rename in Settings if they want a separate
--    Egg Sales line on the P&L.
delete from qb_settings where key = 'income_account.eggs';

-- 5. Recreate the enum without 'eggs' so the type matches the data.
do $$ begin
  if exists (
    select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
     where t.typname = 'category_t' and e.enumlabel = 'eggs'
  ) then
    create type category_t_new as enum ('meat', 'dairy', 'produce', 'pantry', 'beverages');

    alter table accounts alter column enabled_categories drop default;

    alter table products
      alter column category type category_t_new
      using category::text::category_t_new;

    alter table accounts
      alter column enabled_categories type category_t_new[]
      using enabled_categories::text[]::category_t_new[];

    alter table accounts
      alter column enabled_categories
      set default '{meat,dairy,produce}'::category_t_new[];

    drop type category_t;
    alter type category_t_new rename to category_t;
  end if;
end $$;
