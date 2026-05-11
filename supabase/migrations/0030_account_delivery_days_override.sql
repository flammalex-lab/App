-- Per-account delivery-day override.
--
-- Today the cart's valid-day picker reads `delivery_zones.delivery_days`
-- (an array like {tuesday, friday} for the whole zone). That works for
-- the common case but doesn't let ops give one customer a different
-- schedule from the rest of their zone — e.g. a Finger Lakes restaurant
-- that only takes Tuesday deliveries while everyone else in the zone is
-- Tuesday + Friday.
--
-- New column: nullable text[] on accounts. NULL = inherit zone schedule
-- (existing behavior, no migration of data needed). Non-empty array =
-- override the zone; cart picker only offers those days.
--
-- Legacy column `accounts.delivery_day` (singular text) is left
-- untouched — it's never been used by the cart logic, only as a free-form
-- notes field on the admin form. The new array is what drives behavior.
--
-- Idempotent: gated on column existence.

do $$ begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'accounts'
       and column_name = 'delivery_days'
  ) then
    alter table accounts add column delivery_days text[];
  end if;
end $$;

comment on column accounts.delivery_days is
  'Per-account override of the zone delivery-day schedule. NULL = inherit '
  'delivery_zones.delivery_days for this account''s delivery_zone. '
  'Non-empty array overrides — cart picker offers only these days.';
