-- Part 3: Remaining produce, beef cuts, poultry/rabbit, all yogurt flavors, extended dairy
-- From FLF Weekly Flyer 4.13.26

-- ============ PRODUCE — additions ============
insert into products (sku, brand, category, name, description, unit, pack_size, wholesale_price, available_b2b, available_dtc, sort_order) values
('PR-CHB-001','fingerlakes_farms','produce','Chiogga Beets','Organic, 25 lb','case','25 lb',39.50,true,false,607),
('PR-BFB-001','fingerlakes_farms','produce','Badger Flame Beets','Organic, 10 lb','case','10 lb',34.50,true,false,608),
('PR-WMR-001','fingerlakes_farms','produce','White Muu Radish','Organic, 25 lb','case','25 lb',34.50,true,false,609),
('PR-PMR-001','fingerlakes_farms','produce','Purple Muu Radish','Organic, 25 lb','case','25 lb',34.50,true,false,614),
('PR-FJA-001','fingerlakes_farms','produce','Fuji Apples','72 ct, 40 lb','case','40 lb',44.50,true,false,624),
('PR-SDA-001','fingerlakes_farms','produce','Snapdragon Apples','80 ct, 40 lb','case','40 lb',59.50,true,false,625)
on conflict (sku) do nothing;

-- ============ GOTHAM GREENS — all SKUs ============
insert into products (sku, brand, category, name, description, unit, pack_size, wholesale_price, available_b2b, available_dtc, sort_order) values
('PR-GHM-002','fingerlakes_farms','produce','Gotham Greens Baby Butterhead Bowl','12 oz','case','12 pk',36.00,true,false,640),
('PR-GHM-003','fingerlakes_farms','produce','Gotham Greens Butterhead Lettuce','4.5 oz','case','12 pk',43.00,true,false,641),
('PR-GHM-004','fingerlakes_farms','produce','Gotham Greens Crispy Green Leaf Lettuce','4.5 oz','case','12 pk',43.00,true,false,642),
('PR-GHM-005','fingerlakes_farms','produce','Gotham Greens Green Leaf Sandwich Cut','4.5 oz','case','12 pk',43.00,true,false,643),
('PR-GHM-006','fingerlakes_farms','produce','Gotham Greens Green House Crunch','4.5 oz','case','12 pk',43.00,true,false,644),
('PR-GHM-007','fingerlakes_farms','produce','Gotham Greens The Big Green Salad','10 oz','case','12 pk',50.00,true,false,645),
-- Gotham Salad Kits
('PR-GHK-001','fingerlakes_farms','produce','Gotham Greens Caesar Salad Kit','6.5 oz','case','6 pk',29.00,true,true,650),
('PR-GHK-002','fingerlakes_farms','produce','Gotham Greens Green Goddess Salad Kit','6.5 oz','case','6 pk',29.00,true,true,651),
('PR-GHK-003','fingerlakes_farms','produce','Gotham Greens Southwest Ranch Salad Kit','6.5 oz','case','6 pk',29.00,true,true,652),
-- Gotham Dressings/Dips
('PR-GHD-001','fingerlakes_farms','produce','Gotham Pesto','6.5 oz','case','6 pk',36.00,true,false,660),
('PR-GHD-002','fingerlakes_farms','produce','Gotham VEGAN Pesto','6.5 oz','case','6 pk',36.00,true,false,661),
('PR-GHD-003','fingerlakes_farms','produce','Gotham Green Goddess Dip','7 oz','case','6 pk',29.00,true,false,662),
('PR-GHD-004','fingerlakes_farms','produce','Gotham Buffalo Dip','7 oz','case','6 pk',29.00,true,false,663),
('PR-GHD-005','fingerlakes_farms','produce','Gotham Queso Dip','7 oz','case','6 pk',29.00,true,false,664),
('PR-GHD-006','fingerlakes_farms','produce','Gotham Spinach Artichoke Dip','7 oz','case','6 pk',29.00,true,false,665),
('PR-GHD-007','fingerlakes_farms','produce','Gotham Tzatziki Dip','7 oz','case','6 pk',29.00,true,false,666),
('PR-GHD-008','fingerlakes_farms','produce','Gotham Avocado Lime Ranch Dressing','10 oz','case','6 pk',36.00,true,false,670),
('PR-GHD-009','fingerlakes_farms','produce','Gotham Green Goddess Dressing','10 oz','case','6 pk',36.00,true,false,671),
('PR-GHD-010','fingerlakes_farms','produce','Gotham Italian Herb Vinaigrette','10 oz','case','6 pk',36.00,true,false,672),
('PR-GHD-011','fingerlakes_farms','produce','Gotham VEGAN Ranch Dressing','10 oz','case','6 pk',36.00,true,false,673),
('PR-GHD-012','fingerlakes_farms','produce','Gotham VEGAN Green Goddess Dressing','10 oz','case','6 pk',36.00,true,false,674),
('PR-GHD-013','fingerlakes_farms','produce','Gotham VEGAN Lemon Basil Vinaigrette','10 oz','case','6 pk',36.00,true,false,675),
('PR-GHD-014','fingerlakes_farms','produce','Gotham VEGAN Caesar Dressing','10 oz','case','6 pk',36.00,true,false,676),
-- Satur size variants
('PR-SAT-003','fingerlakes_farms','produce','Satur Farms Clamshells — 10 oz','Arugula or Baby Spinach','case','9/10 oz',35.00,true,false,677),
('PR-SAT-004','fingerlakes_farms','produce','Satur Farms Spinach & Mesclun Blend','','case','8/5 oz',19.00,true,false,678)
on conflict (sku) do nothing;

-- ============ BEEF — additions ============
insert into products (sku, brand, category, name, description, unit, pack_size, wholesale_price, available_b2b, available_dtc, sort_order) values
('BF-CUB-001','grasslands','beef','Cube Steaks','','lb',null,7.99,true,true,140),
('BF-RNP-001','grasslands','beef','Ranch Primals','','lb',null,4.19,true,false,141),
('BF-TRX-001','grasslands','beef','TRex Major','','lb',null,13.95,true,false,142),
('BF-ULD-001','grasslands','beef','Uncle Louie''s Beef Dogs','10/2 lb','case','10/2 lb',8.00,true,true,143),
('BF-SST-001','grasslands','beef','Skirt Steak (singular)','','lb',null,14.95,true,true,144)
on conflict (sku) do nothing;

-- ============ TURKEY / DUCK / RABBIT ============
insert into products (sku, brand, category, name, description, unit, pack_size, wholesale_price, available_b2b, available_dtc, sort_order) values
('PK-TRK-001','fingerlakes_farms','pork','Turkey — Frozen','Oink & Gobble, all natural free range','lb',null,3.99,true,true,250),
('PK-DCK-001','fingerlakes_farms','pork','Normandy Duck','Pasture raised, frozen, 6 ct','lb',null,0,true,false,251),
('PK-RAB-001','fingerlakes_farms','pork','Rabbit','Briar Patch at Whiskey Hill, local farm raised','lb',null,8.49,true,false,252)
on conflict (sku) do nothing;

-- ============ LAMB — HW variants ============
insert into products (sku, brand, category, name, description, unit, pack_size, wholesale_price, available_b2b, available_dtc, sort_order) values
('LB-HW-001','fingerlakes_farms','lamb','Local Grain/Grass Fed Lamb — HW','Hanging Weight','lb',null,9.99,true,false,310),
('LB-HW-002','fingerlakes_farms','lamb','Local 100% Grass Fed Lamb — HW','Hanging Weight','lb',null,8.49,true,false,311),
('LB-HW-003','fingerlakes_farms','lamb','Local Sheep — HW','Hanging Weight','lb',null,5.99,true,false,312)
on conflict (sku) do nothing;

-- ============ ITHACA MILK YOGURT — remaining flavors ============
insert into products (sku, brand, category, name, description, unit, pack_size, wholesale_price, available_b2b, available_dtc, sort_order) values
('DY-YGL-001','fingerlakes_farms','dairy','Ithaca Milk Yogurt — Lemon 6oz','Cream Top Jersey','case','12/6 oz',15.00,true,false,504),
('DY-YGC-001','fingerlakes_farms','dairy','Ithaca Milk Yogurt — Black Cherry 6oz','Cream Top Jersey','case','12/6 oz',15.00,true,false,505),
('DY-YGM-001','fingerlakes_farms','dairy','Ithaca Milk Yogurt — Maple 6oz','Cream Top Jersey','case','12/6 oz',15.00,true,false,506),
('DY-YGS-001','fingerlakes_farms','dairy','Ithaca Milk Yogurt — Strawberry 6oz','Cream Top Jersey','case','12/6 oz',15.00,true,false,507),
('DY-YGPC-001','fingerlakes_farms','dairy','Ithaca Milk Yogurt — Peach 6oz','Cream Top Jersey','case','12/6 oz',15.00,true,false,508),
-- 32 oz variants
('DY-YGV-032','fingerlakes_farms','dairy','Ithaca Milk Yogurt — Vanilla 32oz','Cream Top Jersey','case','6/32 oz',24.60,true,false,513),
('DY-YGB-032','fingerlakes_farms','dairy','Ithaca Milk Yogurt — Blueberry 32oz','Cream Top Jersey','case','6/32 oz',24.60,true,false,514),
('DY-YGL-032','fingerlakes_farms','dairy','Ithaca Milk Yogurt — Lemon 32oz','Cream Top Jersey','case','6/32 oz',24.60,true,false,515),
('DY-YGC-032','fingerlakes_farms','dairy','Ithaca Milk Yogurt — Black Cherry 32oz','Cream Top Jersey','case','6/32 oz',24.60,true,false,516),
('DY-YGM-032','fingerlakes_farms','dairy','Ithaca Milk Yogurt — Maple 32oz','Cream Top Jersey','case','6/32 oz',24.10,true,false,517),
('DY-YGS-032','fingerlakes_farms','dairy','Ithaca Milk Yogurt — Strawberry 32oz','Cream Top Jersey','case','6/32 oz',24.60,true,false,518),
('DY-YGPC-032','fingerlakes_farms','dairy','Ithaca Milk Yogurt — Peach 32oz','Cream Top Jersey','case','6/32 oz',24.60,true,false,519)
on conflict (sku) do nothing;

-- ============ SENECA HOLSTEIN MILK — all sizes ============
insert into products (sku, brand, category, name, description, unit, pack_size, wholesale_price, available_b2b, available_dtc, sort_order) values
('DY-SHW-002','fingerlakes_farms','dairy','Seneca Holstein Whole — Half Gallon','','each','half gallon',3.75,true,true,525),
('DY-SHW-003','fingerlakes_farms','dairy','Seneca Holstein Whole — Quart','Special order','each','quart',2.50,true,true,526),
('DY-SHR-002','fingerlakes_farms','dairy','Seneca Holstein Reduced Fat — Half Gallon','','each','half gallon',3.65,true,true,527),
('DY-SHR-003','fingerlakes_farms','dairy','Seneca Holstein Reduced Fat — Quart','','each','quart',2.40,true,true,528),
('DY-SHS-001','fingerlakes_farms','dairy','Seneca Holstein Skim — Gallon','','each','gallon',6.00,true,false,529),
('DY-SHS-002','fingerlakes_farms','dairy','Seneca Holstein Skim — Half Gallon','','each','half gallon',3.60,true,true,534),
('DY-SHS-003','fingerlakes_farms','dairy','Seneca Holstein Skim — Quart','','each','quart',2.10,true,true,535),
-- Pittsford extras
('DY-PCM-001','fingerlakes_farms','dairy','Pittsford Chocolate Milk — Pint','','each','16 oz',2.15,true,true,536),
('DY-PHH-002','fingerlakes_farms','dairy','Pittsford Half & Half — Pint','','each','16 oz',2.55,true,true,537)
on conflict (sku) do nothing;
