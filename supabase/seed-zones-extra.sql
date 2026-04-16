-- Additional delivery zones for Upstate metros (matches ilovenyfarms.com service areas).
-- Run after 0003_seed_config.sql. Safe to re-run.

-- First, add the new enum values to delivery_zone_t
-- (Postgres will error if they already exist; wrap in DO block for safety.)
do $$ begin
  alter type delivery_zone_t add value if not exists 'buffalo';
  alter type delivery_zone_t add value if not exists 'rochester';
  alter type delivery_zone_t add value if not exists 'syracuse';
  alter type delivery_zone_t add value if not exists 'ithaca';
exception when duplicate_object then null;
end $$;

insert into delivery_zones (zone, label, order_minimum, cutoff_hours_before_delivery, delivery_days) values
  ('buffalo',    'Buffalo',     200, 48, '{Tuesday}'),
  ('rochester',  'Rochester',   200, 48, '{Tuesday,Friday}'),
  ('syracuse',   'Syracuse',    200, 36, '{Wednesday}'),
  ('ithaca',     'Ithaca',      150, 24, '{Tuesday,Friday}')
on conflict (zone) do update set
  label = excluded.label,
  order_minimum = excluded.order_minimum,
  cutoff_hours_before_delivery = excluded.cutoff_hours_before_delivery,
  delivery_days = excluded.delivery_days;

-- Update the Seneca Falls pickup to match the real schedule from the website
update pickup_locations
  set pickup_days = '{Tuesday}',
      pickup_window = '2pm-6pm (Jul–Oct)',
      notes = 'Seneca Falls Farmers Market — seasonal'
  where name like '%Seneca Falls%';
