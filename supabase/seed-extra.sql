-- Additional seed products: broadens the catalog to match the real FLF product guide.
-- Run after seed.sql (or after setup.sql). Safe to re-run — ON CONFLICT (sku) DO NOTHING.

insert into products
  (sku, brand, category, name, description, primal, sub_primal, cut_type, unit, pack_size, case_pack, avg_weight_lbs,
   wholesale_price, retail_price, available_b2b, available_dtc, sort_order)
values
  -- DAIRY (Ithaca Milk + partner)
  ('DY-JMK-001','fingerlakes_farms','dairy','Jersey Cream-Top Milk — Half Gallon','Ithaca Milk single-source Jersey', null, null,'whole','each','64 oz','6/case', null, 4.75, 8.50, true, true, 440),
  ('DY-KFR-001','fingerlakes_farms','dairy','Plain Kefir — Quart','Probiotic whole-milk kefir',                      null, null,'whole','quart','32 oz','6/case', null, 5.50, 9.50, true, true, 450),
  ('DY-CHD-001','fingerlakes_farms','dairy','Aged Cheddar — 8 oz','NYS artisan cave-aged 12 mo',                     null, null,'whole','each','8 oz', null, null, 5.50, 10.00, true, true, 460),
  ('DY-RIC-001','fingerlakes_farms','dairy','Fresh Ricotta — Pint','Small-batch whole milk',                          null, null,'whole','each','16 oz', null, null, 4.50, 8.00, true, true, 470),
  ('DY-HCR-001','fingerlakes_farms','dairy','Heavy Cream — Quart','Non-ultra-pasteurized',                            null, null,'whole','quart','32 oz','4/case', null, 4.25, 7.50, true, true, 480),

  -- PRODUCE (expanded seasonal list)
  ('PR-KAL-001','fingerlakes_farms','produce','Lacinato Kale','Bunches, organic',                                      null, null,'whole','bunch','1 bunch','24/case', null, 2.25, 4.00, true, true, 550),
  ('PR-ONI-001','fingerlakes_farms','produce','Sweet Onions — 5 lb','NYS Vidalia-style',                              null, null,'whole','bag','5 lb bag', null, null, 3.75, null, true, false, 560),
  ('PR-GRL-001','fingerlakes_farms','produce','Garlic — 1 lb','Hardneck, FLX-grown',                                  null, null,'whole','lb','1 lb mesh', null, null, 8.00, 12.00, true, true, 570),
  ('PR-HRB-001','fingerlakes_farms','produce','Fresh Herb Bundle','Rosemary, thyme, sage',                             null, null,'whole','bunch','3-herb bundle', null, null, 3.50, 6.00, true, true, 580),
  ('PR-APL-001','fingerlakes_farms','produce','Honeycrisp Apples — Tote','10 lb tote bag',                            null, null,'whole','each','10 lb tote', null, null, 14.00, 22.00, true, true, 590),

  -- BEEF (additional cuts from the real cut sheet)
  ('BF-FLK-001','grasslands','beef','Flank Steak','Trimmed, 2 lb avg',                             'Plate', 'Flank','retail_cut','lb','2 lb avg', null, 2.0, 11.50, 20.00, true, true, 170),
  ('BF-HNG-001','grasslands','beef','Hanger Steak','Butcher''s steak, 1.5 lb avg',                 null, null,'retail_cut','lb','1.5 lb avg', null, 1.5, 13.00, 22.00, true, true, 180),
  ('BF-OXT-001','grasslands','beef','Oxtail','Cross-cut, 2 lb pack',                               'Tail', null,'retail_cut','lb','2 lb pack', null, 2.0, 8.00, 14.00, true, true, 190),

  -- PORK (expanded)
  ('PK-HAM-001','fingerlakes_farms','pork','Smoked Ham Steak','Center cut, 1 lb',                  null, null,'retail_cut','lb','1 lb', null, 1.0, 6.50, 12.00, true, true, 260),
  ('PK-BAC-001','fingerlakes_farms','pork','Thick-Cut Bacon — 1 lb','Dry-cured, hickory smoked',   null, null,'value_added','lb','1 lb pack', null, 1.0, 9.50, 16.00, true, true, 270),

  -- LAMB
  ('LB-GRD-001','fingerlakes_farms','beef','Ground Lamb','85/15 grind, 1 lb pack',                 null, null,'retail_cut','lb','1 lb pack', null, 1.0, 10.50, 18.00, true, true, 610),
  ('LB-RCK-001','fingerlakes_farms','beef','Lamb Rack — Frenched','8-bone, 2 lb avg',              'Rib', null,'sub_primal','lb','2 lb avg', null, 2.0, 22.00, 38.00, true, true, 620),
  ('LB-SHK-001','fingerlakes_farms','beef','Lamb Shank','Braising, 1 lb avg',                      'Shank', null,'retail_cut','lb','1 lb avg', null, 1.0, 9.00, 15.00, true, true, 630),

  -- PANTRY
  ('PT-MAP-001','fingerlakes_farms','produce','NYS Maple Syrup — Pint','Grade A Dark, robust',     null, null,'whole','each','16 oz', null, null, 11.00, 18.00, true, true, 710),
  ('PT-HON-001','fingerlakes_farms','produce','Raw Honey — 1 lb','FLX wildflower',                 null, null,'whole','lb','1 lb jar', null, null, 9.00, 15.00, true, true, 720),
  ('PT-FLR-001','fingerlakes_farms','produce','All-Purpose Flour — 5 lb','Stone-ground NYS wheat', null, null,'whole','bag','5 lb bag', null, null, 6.00, 10.00, true, true, 730)
on conflict (sku) do nothing;
