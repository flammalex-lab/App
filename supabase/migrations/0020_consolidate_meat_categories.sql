-- Consolidate beef / pork / lamb into a single 'meat' category.
--
-- Buyers and admins already think in product groups (Meat / Produce / Dairy /
-- Cheese / Grocery — see migration 0006), and the granular split between beef,
-- pork, and lamb at the category level was never surfaced anywhere useful: it
-- just forced extra picker options in the admin product form and three
-- separate income-account rows for QuickBooks. Folding them into one 'meat'
-- category matches how the catalog and order guides actually behave.
--
-- Implementation note: we do NOT add 'meat' to the existing enum first.
-- Postgres forbids using a newly-added enum value in the same transaction
-- it was added in (the Supabase SQL editor wraps the whole migration in one
-- transaction), which would silently leave beef/pork/lamb rows in place and
-- then fail at the recreate step. Instead we build a fresh `category_t_new`
-- with 'meat' already in it and remap rows inside the USING clause of the
-- column type change.
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
    -- Drop any leftover from a previous partial run before we recreate.
    drop type if exists category_t_new;

    create type category_t_new as enum (
      'meat', 'eggs', 'dairy', 'produce', 'pantry', 'beverages'
    );

    alter table accounts alter column enabled_categories drop default;

    -- Map beef/pork/lamb -> meat and cheese -> dairy in the USING clause;
    -- everything else passes through. The text round-trip is what lets the
    -- cast cross enum types — direct enum-to-enum casts aren't allowed.
    -- 'cheese' isn't in any migration in this repo but exists in production
    -- (added ad-hoc to category_t at some point); folding into dairy matches
    -- how product_group already groups it (see 0006).
    alter table products
      alter column category type category_t_new
      using (
        case
          when category::text in ('beef', 'pork', 'lamb') then 'meat'
          when category::text = 'cheese' then 'dairy'
          else category::text
        end
      )::category_t_new;

    -- Same mapping for accounts.enabled_categories. `array(select distinct …)`
    -- per-row dedups any account that had multiple of beef/pork/lamb enabled
    -- (which would otherwise collapse to duplicate 'meat' entries), or that
    -- had both cheese and dairy.
    alter table accounts
      alter column enabled_categories type category_t_new[]
      using (
        array(
          select distinct (
            case
              when c::text in ('beef', 'pork', 'lamb') then 'meat'
              when c::text = 'cheese' then 'dairy'
              else c::text
            end
          )::category_t_new
          from unnest(enabled_categories) as c
        )
      );

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
