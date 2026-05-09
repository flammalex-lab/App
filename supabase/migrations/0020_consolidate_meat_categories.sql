-- Consolidate beef / pork / lamb into a single 'meat' category.
--
-- Buyers and admins already think in product groups (Meat / Produce / Dairy /
-- Cheese / Grocery — see migration 0006), and the granular split between beef,
-- pork, and lamb at the category level was never surfaced anywhere useful: it
-- just forced extra picker options in the admin product form and three
-- separate income-account rows for QuickBooks. Folding them into one 'meat'
-- category matches how the catalog and order guides actually behave.
--
-- Plan:
--   1. Add 'meat' to category_t so we can write it during the data migration.
--   2. Rewrite products.category and accounts.enabled_categories to use 'meat'.
--   3. Collapse income_account.beef / pork / lamb into income_account.meat.
--   4. Recreate the enum without beef/pork/lamb so the type matches the data.
--
-- Idempotent: re-running is a no-op once the data is already on 'meat'.

-- 1. Add 'meat' to the existing enum.
do $$ begin
  alter type category_t add value if not exists 'meat';
exception when duplicate_object then null;
end $$;

-- 2a. Migrate products.
update products
   set category = 'meat'::category_t
 where category::text in ('beef', 'pork', 'lamb');

-- 2b. Migrate accounts.enabled_categories arrays (replace beef/pork/lamb with
--     meat, dedup, and preserve the rest).
update accounts
   set enabled_categories = (
     select array_agg(distinct cat)
       from (
         select case
                  when c::text in ('beef', 'pork', 'lamb') then 'meat'
                  else c::text
                end::category_t as cat
           from unnest(enabled_categories) as c
       ) sub
   )
 where exists (
   select 1 from unnest(enabled_categories) c
    where c::text in ('beef', 'pork', 'lamb')
 );

-- 3. Consolidate QB income-account mapping rows. Admin can rename the label
--    from Settings; we just need a single key for the meat bucket.
insert into qb_settings (key, value)
values ('income_account.meat', 'Meat Sales')
on conflict (key) do nothing;

delete from qb_settings
 where key in ('income_account.beef', 'income_account.pork', 'income_account.lamb');

-- 4. Recreate the enum without beef/pork/lamb. All product/account rows have
--    already been migrated above, so the text-cast is total.
do $$ begin
  if exists (
    select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
     where t.typname = 'category_t'
       and e.enumlabel in ('beef', 'pork', 'lamb')
  ) then
    create type category_t_new as enum ('meat', 'eggs', 'dairy', 'produce', 'pantry', 'beverages');

    alter table accounts alter column enabled_categories drop default;

    alter table products
      alter column category type category_t_new
      using category::text::category_t_new;

    alter table accounts
      alter column enabled_categories type category_t_new[]
      using enabled_categories::text[]::category_t_new[];

    alter table accounts
      alter column enabled_categories
      set default '{meat,eggs,dairy,produce}'::category_t_new[];

    drop type category_t;
    alter type category_t_new rename to category_t;
  end if;
end $$;
