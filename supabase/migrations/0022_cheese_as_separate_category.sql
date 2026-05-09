-- Recover 'cheese' as a separate category for installs that ran an earlier
-- version of 0020 / 0021 which folded cheese into dairy.
--
-- Cheese is its own thing — different shelf life, different buyer (see
-- cheese_buyer in 0006), separate order-guide template (see "Cheese" in
-- 0012). The earlier migrations were wrong to collapse it into dairy.
--
-- For installs that haven't run those folded versions, 0020 + 0021 already
-- kept cheese intact and this migration is a no-op (the enum already has
-- 'cheese', and 0006's product_group backfill already aligns with the
-- current category).
--
-- Idempotent: each step is gated on whether the work is needed.

-- 1. Make sure 'cheese' is in category_t. If 0020 dropped it (folded into
--    dairy), the recreate-the-enum approach is the only safe way to add
--    it back without the same-tx restriction biting us.
do $$ begin
  if not exists (
    select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
     where t.typname = 'category_t' and e.enumlabel = 'cheese'
  ) then
    drop type if exists category_t_new;

    create type category_t_new as enum (
      'meat', 'dairy', 'cheese', 'produce', 'pantry', 'beverages'
    );

    alter table accounts alter column enabled_categories drop default;

    alter table products
      alter column category type category_t_new
      using category::text::category_t_new;

    alter table accounts
      alter column enabled_categories type category_t_new[]
      using enabled_categories::text[]::category_t_new[];

    alter table accounts
      alter column enabled_categories
      set default '{meat,dairy,cheese,produce}'::category_t_new[];

    drop type category_t;
    alter type category_t_new rename to category_t;
  end if;
end $$;

-- 2. Re-categorize cheese products. 0006 already set product_group='cheese'
--    on every cheese-y dairy row by name + producer match, so that's the
--    cleanest signal for which rows belong in the cheese category — and
--    it survives even if their category was folded to 'dairy' by an older
--    0020 / 0021 run.
update products
   set category = 'cheese'::category_t
 where product_group = 'cheese'
   and category::text <> 'cheese';

-- 3. QB income-account row for cheese.
insert into qb_settings (key, value)
values ('income_account.cheese', 'Cheese Sales')
on conflict (key) do nothing;
