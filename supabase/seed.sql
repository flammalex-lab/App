-- Product seed — broad product guide across beef, pork, eggs, dairy, produce
-- (no chicken; suspended March 2026)

insert into products
  (sku, brand, category, name, description, primal, sub_primal, cut_type, unit, pack_size, case_pack, avg_weight_lbs,
   wholesale_price, retail_price, available_b2b, available_dtc, sort_order)
values
  -- GRASSLANDS BEEF (B2B primals & sub-primals)
  ('BF-STR-001','grasslands','beef','Strip Loin',         'Whole NY strip loin, trim to spec',  'Loin',          'Strip Loin',   'sub_primal','lb','2x14lb avg','2/case',14.0, 14.50, null, true, false, 10),
  ('BF-TOP-001','grasslands','beef','Top Sirloin',        'Center-cut top sirloin',             'Loin',          'Top Sirloin',  'sub_primal','lb','2x12lb avg','2/case',12.0, 11.00, null, true, false, 20),
  ('BF-TRI-001','grasslands','beef','Tri Tip',            'Trimmed tri tip',                    'Bottom Sirloin','Tri Tip',      'sub_primal','lb','2.5lb avg','8/case',2.5,   9.75,22.00, true, true,  30),
  ('BF-CHK-001','grasslands','beef','Chuck Roll',         'Whole chuck roll, netted',           'Chuck',         'Chuck Roll',   'primal',    'lb','20lb avg','1/case',20.0,   7.25, null, true, false, 40),
  ('BF-BRS-001','grasslands','beef','Whole Brisket',      'Packer brisket',                     'Brisket',       'Whole Brisket','primal',    'lb','14lb avg','1/case',14.0,   8.50, null, true, false, 50),
  ('BF-RIB-001','grasslands','beef','Ribeye Lip-On',      'Lip-on bone-in ribeye',              'Rib',           'Ribeye',       'sub_primal','lb','2x18lb avg','2/case',18.0, 18.50, null, true, false, 60),
  ('BF-TEN-001','grasslands','beef','Tenderloin',         'PSMO tenderloin',                    'Loin',          'Tenderloin',   'sub_primal','lb','6lb avg','4/case',6.0,   26.00, null, true, false, 70),
  -- GRASSLANDS BEEF (retail / value-added)
  ('BF-SHO-001','grasslands','beef','Beef Short Ribs',    'Cross-cut flanken-style',            'Rib', null, 'retail_cut', 'lb','1 lb pack', null,1.0, 10.00, 18.00, true, true, 110),
  ('BF-CHE-001','grasslands','beef','Beef Cheeks',        'Trimmed cheeks for braising',        null,  null, 'retail_cut', 'lb','1 lb pack', null,1.0,  9.50, 16.00, true, true, 120),
  ('BF-SHA-001','grasslands','beef','Beef Shank',         'Cross-cut, osso buco style',         'Shank',null,'retail_cut','lb','1.5 lb avg',null,1.5,  7.50, 12.00, true, true, 130),
  ('BF-BRO-001','grasslands','beef','Bone Broth Bundle',  'Marrow + knuckle bones',             null,  null, 'value_added','each','5 lb bundle',null,5.0, null,35.00, false, true, 140),
  ('BF-GRD-001','grasslands','beef','Ground Beef 85/15',  'Chuck-forward grind',                null,  null, 'retail_cut', 'lb','1 lb pack', null,1.0,  7.00, 12.00, true, true, 150),
  ('BF-STK-001','grasslands','beef','Strip Steak Portion','10oz center-cut',                    'Loin','Strip Loin','retail_cut','each','10 oz','12/case',null,12.00,24.00, true, true, 160),
  -- PORK
  ('PK-CHP-001','fingerlakes_farms','pork','Bone-In Pork Chop','Center-cut, 1-inch thick',      'Loin','Center Loin','retail_cut','lb','2x0.75lb','12/case',0.75, 7.50, 14.00, true, true, 210),
  ('PK-RIB-001','fingerlakes_farms','pork','St. Louis Ribs',   'Trimmed St. Louis spare ribs',  'Belly', null,      'sub_primal','lb','3lb avg','4/case',3.0,  8.25, 16.00, true, true, 220),
  ('PK-BEL-001','fingerlakes_farms','pork','Pork Belly',       'Skin-on fresh belly',           'Belly', null,      'sub_primal','lb','10lb avg','1/case',10.0, 7.75, null, true, false, 230),
  ('PK-BUT-001','fingerlakes_farms','pork','Boston Butt',      'Boneless Boston butt',          'Shoulder','Butt',  'sub_primal','lb','8lb avg','2/case',8.0,  6.50, null, true, false, 240),
  ('PK-SAU-001','fingerlakes_farms','pork','Italian Sausage',  'Sweet, 1 lb links',             null,  null,       'value_added','lb','1 lb pack',null,1.0, 7.50, 13.00, true, true, 250),
  -- EGGS
  ('EG-DOZ-001','meadow_creek','eggs','Large Brown Eggs — Dozen','Pasture-raised',              null, null,'whole','dozen','12 ct','15/case',null,  null, 7.00, false, true,  310),
  ('EG-CSE-001','meadow_creek','eggs','Large Brown Eggs — Case', '15 dz case',                  null, null,'whole','case', '15 dz','1/case', null, 72.00, null, true, false, 320),
  ('EG-JMB-001','meadow_creek','eggs','Jumbo Brown Eggs — Dozen','Pasture-raised jumbo',        null, null,'whole','dozen','12 ct','15/case',null, null, 8.50, false, true,  330),
  -- DAIRY (partner / sourced)
  ('DY-MLK-001','fingerlakes_farms','dairy','Whole Milk — Gallon','Glass, from partner dairy',  null, null,'whole','gallon','1 ga','4/case',null, 5.50, 9.00, true, true, 410),
  ('DY-BTR-001','fingerlakes_farms','dairy','Cultured Butter — 1 lb','Sea salt cultured',       null, null,'whole','lb','1 lb brick',null,1.0, 7.00,12.00, true, true, 420),
  ('DY-YGT-001','fingerlakes_farms','dairy','Plain Yogurt — Quart','Whole milk',                null, null,'whole','quart','32 oz','6/case',null,5.25, 9.00, true, true, 430),
  -- PRODUCE (seasonal — sample list)
  ('PR-TOM-001','fingerlakes_farms','produce','Heirloom Tomatoes','Mixed varieties, seasonal', null, null,'whole','lb','10 lb case','1/case',null, 3.50, 6.00, true, true, 510),
  ('PR-LET-001','fingerlakes_farms','produce','Little Gem Lettuce','Trays of 24',              null, null,'whole','case','24 ct','1/case', null,28.00, null, true, false, 520),
  ('PR-MSH-001','fingerlakes_farms','produce','Mixed Mushrooms','Chef mix, 3 lb',              null, null,'whole','lb','3 lb pack','1/case',3.0, 11.50,15.00, true, true, 530),
  ('PR-BER-001','fingerlakes_farms','produce','Mixed Berries','Seasonal pint',                 null, null,'whole','each','1 pt','12/case',null,4.50, 7.50, true, true, 540)
on conflict (sku) do nothing;
