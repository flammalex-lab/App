-- Consolidate beef / pork / lamb into a single 'meat' category.
--
-- Buyers and admins already think in product groups (Meat / Produce / Dairy /
-- Cheese / Grocery — see migration 0006), and the granular split between beef,
-- pork, and lamb at the category level was never surfaced anywhere useful: it
-- just forced extra picker options in the admin product form and three
-- separate income-account rows for QuickBooks. Folding them into one 'meat'
-- category matches how the catalog and order guides actually behave.
--
-- Cheese: kept as its own first-class category here. It was added to
-- category_t in production via an ad-hoc ALTER TYPE (no migration in this
-- repo introduced it), but cheese is conceptually distinct from dairy
-- (different shelf life, sales channel, buyer specialty — see the
-- separate Cheese template in 0012 and the cheese_buyer type in 0006).
-- The new enum lists it alongside dairy.
--
-- Implementation notes:
-- 1. We do NOT add 'meat' to the existing enum first. Postgres forbids
--    using a newly-added enum value in the same transaction it was added
--    in (the Supabase SQL editor wraps the whole migration in one
--    transaction), which would silently leave beef/pork/lamb rows in place.
-- 2. We do NOT remap accounts.enabled_categories inside the
--    `ALTER COLUMN ... USING` clause via `array(SELECT…)`. Postgres rejects
--    subqueries in transform expressions ("cannot use subquery in transform
--    expression"). Instead: loosen the column to text[] first, do the
--    remap with a regular UPDATE, then cast back to the new typed array.
--
-- Idempotent: gated on beef/pork/lamb still being present in the enum, so
-- re-running after a successful migration is a no-op.

do $$ begin
  if exists (
    select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
     where t.typname = 'category_t'
       and e.enumlabel in ('beef', 'pork', 'lamb')
  ) then
    -- Cheese: in this app's canonical schema, cheese is a product_group
    -- (kept separate from dairy — see 0006 + the "Cheese" order-guide
    -- template in 0012, which is intentionally distinct from "Dairy"),
    -- NOT a category. 'cheese' got into category_t in production via an
    -- ad-hoc ALTER TYPE outside of any migration in this repo. Before we
    -- collapse those rows into category='dairy' below, backfill
    -- product_group='cheese' so the buyer-facing distinction (cheese
    -- buyer type, Cheese template) survives — these rows otherwise come
    -- out as plain dairy with no product_group set.
    update products
       set product_group = 'cheese'
     where category::text = 'cheese'
       and product_group is distinct from 'cheese';

    -- Drop any leftover from a previous partial run before we recreate.
    drop type if exists category_t_new;

    -- Drop the default first; it references the old category_t.
    alter table accounts alter column enabled_categories drop default;

    -- Loosen accounts.enabled_categories to text[] so we can do the per-row
    -- array remap with a regular UPDATE (no subquery-in-transform issues).
    alter table accounts
      alter column enabled_categories type text[]
      using enabled_categories::text[];

    -- Remap beef/pork/lamb -> meat across every account, dedup, preserve
    -- the rest. Only touches rows that actually contain one of the old
    -- values, leaving everything else untouched.
    update accounts
       set enabled_categories = (
         select array_agg(distinct
           case when c in ('beef', 'pork', 'lamb') then 'meat' else c end
         )
         from unnest(enabled_categories) as c
       )
     where exists (
       select 1 from unnest(enabled_categories) c
        where c in ('beef', 'pork', 'lamb')
     );

    -- Build the new enum.
    create type category_t_new as enum (
      'meat', 'eggs', 'dairy', 'cheese', 'produce', 'pantry', 'beverages'
    );

    alter table accounts alter column enabled_categories drop default;

    -- Map beef/pork/lamb -> meat and cheese -> dairy in the USING clause;
    -- everything else passes through. The text round-trip is what lets the
    -- cast cross enum types — direct enum-to-enum casts aren't allowed.
    -- The cheese -> dairy fold matches how 0006 already classifies cheese
    -- products (category='dairy', product_group='cheese'); see the
    -- product_group backfill above for why that distinction is preserved.
    -- products.category is a single value; CASE in USING is fine because
    -- it's a regular expression, not a subquery.
    alter table products
      alter column category type category_t_new
      using (
        case
          when category::text in ('beef', 'pork', 'lamb') then 'meat'
          else category::text
        end
      )::category_t_new;

    -- Accounts column is already text[] with remapped values, so a direct
    -- cast to the new enum array is sufficient.
    alter table accounts
      alter column enabled_categories type category_t_new[]
      using enabled_categories::category_t_new[];

    alter table accounts
      alter column enabled_categories
      set default '{meat,eggs,dairy,produce}'::category_t_new[];

    drop type category_t;
    alter type category_t_new rename to category_t;
  end if;
end $$;

-- Consolidate QB income-account mapping rows. Admin can rename the label
-- from Settings; we just need a single key for the meat bucket.
insert into qb_settings (key, value)
values ('income_account.meat', 'Meat Sales')
on conflict (key) do nothing;

delete from qb_settings
 where key in ('income_account.beef', 'income_account.pork', 'income_account.lamb');
