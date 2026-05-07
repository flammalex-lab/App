-- Seed: delivery zones + pickup locations

insert into delivery_zones (zone, label, order_minimum, cutoff_hours_before_delivery, delivery_days) values
  ('finger_lakes',  'Finger Lakes',    150, 24, '{Tuesday,Friday}'),
  ('nyc_metro',     'NYC Metro',       300, 48, '{Tuesday,Friday}'),
  ('hudson_valley', 'Hudson Valley',   250, 24, '{Wednesday}'),
  ('long_island',   'Long Island',     300, 48, '{Thursday}'),
  ('nj_pa_ct',      'NJ / PA / CT',    400, 72, '{Wednesday}')
on conflict (zone) do update set
  label = excluded.label,
  order_minimum = excluded.order_minimum,
  cutoff_hours_before_delivery = excluded.cutoff_hours_before_delivery,
  delivery_days = excluded.delivery_days;

insert into pickup_locations (name, address, pickup_days, pickup_window, sort_order) values
  ('Fingerlakes Farms — Seneca Falls', '2345 State Route 414, Seneca Falls, NY', '{Saturday}',  '10am-2pm', 10),
  ('Union Square Greenmarket',         'E 17th St & Union Sq W, New York, NY',   '{Wednesday,Friday,Saturday}', '9am-4pm', 20),
  ('McCarren Park Greenmarket',        'Lorimer St & Driggs Ave, Brooklyn, NY',  '{Saturday}',  '8am-2pm', 30)
on conflict do nothing;
