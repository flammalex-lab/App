-- Seed data from FLF Protein Cut Sheet (no chicken — program suspended March 2026)

insert into products
  (brand, category, name, description, primal, sub_primal, cut_type, unit, pack_size, case_pack, avg_weight_lbs,
   wholesale_price, retail_price, available_b2b, available_dtc, sort_order)
values
  -- GRASSLANDS BEEF — primals / sub-primals (B2B)
  ('grasslands','beef','Strip Loin',      'Whole NY strip loin, trim to spec', 'Loin',       'Strip Loin',   'sub_primal', 'lb', '2x14lb avg', '2/case', 14.0, 14.50, null, true,  false, 10),
  ('grasslands','beef','Top Sirloin',     'Whole top sirloin, center cut',     'Loin',       'Top Sirloin',  'sub_primal', 'lb', '2x12lb avg', '2/case', 12.0, 11.00, null, true,  false, 20),
  ('grasslands','beef','Tri Tip',         'Trimmed tri tip, 2.5 lb avg',       'Bottom Sirloin','Tri Tip',   'sub_primal', 'lb', '2.5lb avg',  '8/case',  2.5,  9.75, 22.00, true, true, 30),
  ('grasslands','beef','Chuck Roll',      'Whole chuck roll, netted',          'Chuck',      'Chuck Roll',   'primal',     'lb', '20lb avg',   '1/case', 20.0,  7.25, null, true,  false, 40),
  ('grasslands','beef','Brisket',         'Whole packer brisket',              'Brisket',    'Whole Brisket','primal',     'lb', '14lb avg',   '1/case', 14.0,  8.50, null, true,  false, 50),
  -- GRASSLANDS BEEF — retail / value-added (DTC)
  ('grasslands','beef','Beef Short Ribs',  'Cross-cut flanken-style, 1 lb pack',       'Rib',    null, 'retail_cut', 'lb', '1 lb pack',    null, 1.0, 10.00, 18.00, true, true, 110),
  ('grasslands','beef','Beef Cheeks',      'Trimmed cheeks for braising',              null,     null, 'retail_cut', 'lb', '1 lb pack',    null, 1.0,  9.50, 16.00, true, true, 120),
  ('grasslands','beef','Beef Shank',       'Cross-cut osso buco style',                'Shank',  null, 'retail_cut', 'lb', '1.5 lb avg',   null, 1.5,  7.50, 12.00, true, true, 130),
  ('grasslands','beef','Bone Broth Bundle','Marrow + knuckle bones, 5 lb',             null,     null, 'value_added','each','5 lb bundle', null, 5.0,  null, 35.00, false, true, 140),
  ('grasslands','beef','Ground Beef',      '85/15 ground, 1 lb pack',                  null,     null, 'retail_cut', 'lb', '1 lb pack',    null, 1.0,  7.00, 12.00, true, true, 150),
  -- PORK
  ('fingerlakes_farms','pork','Bone-In Pork Chop','Center-cut, 1-inch thick',           'Loin', 'Center Loin','retail_cut','lb','2x0.75lb', '12/case', 0.75, 7.50, 14.00, true, true, 210),
  ('fingerlakes_farms','pork','St. Louis Ribs',   'Trimmed St. Louis spare ribs',      'Belly',null,        'sub_primal','lb','3lb avg',  '4/case',  3.0,  8.25, 16.00, true, true, 220),
  -- MEADOW CREEK EGGS
  ('meadow_creek','eggs','Large Brown Eggs — Dozen','Pasture-raised, large',           null, null, 'whole','dozen','12 ct','15/case', null,  null, 7.00, false, true, 310),
  ('meadow_creek','eggs','Large Brown Eggs — Case', 'Pasture-raised, 15 dozen case',   null, null, 'whole','case', '15 dz','1/case',  null, 72.00, null, true,  false, 320),
  -- FINGERLAKES FARMS PRODUCE (seasonal placeholder)
  ('fingerlakes_farms','produce','Heirloom Tomatoes','Mixed varieties, seasonal',      null, null, 'whole','lb','10 lb case','1/case', null, 3.50, 6.00, true, true, 410)
on conflict do nothing;
