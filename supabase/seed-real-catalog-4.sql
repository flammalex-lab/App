-- Part 4: Five Acre Farms, all cheeses, kitchen staples, bakery, pickles, pantry extras
-- From FLF Weekly Flyer 4.13.26

-- ============ FIVE ACRE FARMS ============
insert into products (sku, brand, category, name, description, unit, pack_size, wholesale_price, available_b2b, available_dtc, sort_order) values
('DY-FAW-001','fingerlakes_farms','dairy','Five Acre Whole Milk — Gallon','','case','4/gallon',20.75,true,false,570),
('DY-FAW-002','fingerlakes_farms','dairy','Five Acre Whole Milk — Half Gallon','','case','9/half gallon',26.75,true,false,571),
('DY-FAR-001','fingerlakes_farms','dairy','Five Acre 2% Reduced Fat — Gallon','','case','4/gallon',20.75,true,false,572),
('DY-FAR-002','fingerlakes_farms','dairy','Five Acre 2% Reduced Fat — Half Gallon','','case','9/half gallon',26.75,true,false,573),
('DY-FAF-001','fingerlakes_farms','dairy','Five Acre Fat Free — Half Gallon','','case','9/half gallon',26.75,true,false,574),
('DY-FAK-001','fingerlakes_farms','dairy','Five Acre Kefir Plain — Quart','','case','6/quart',25.75,true,false,575),
('DY-FAHH-001','fingerlakes_farms','dairy','Five Acre Half & Half — Pint','','case','16/pint',13.65,true,false,576),
('DY-FAHC-001','fingerlakes_farms','dairy','Five Acre Heavy Cream — Pint','','case','16/pint',24.95,true,false,577),
('DY-FABM-001','fingerlakes_farms','dairy','Five Acre Buttermilk — Pint','','case','16/pint',17.00,true,false,578),
('DY-FABM-002','fingerlakes_farms','dairy','Five Acre Buttermilk — Quart','','case','6/quart',26.90,true,false,579)
on conflict (sku) do nothing;

-- ============ MURANDA CHEESE — all ============
insert into products (sku, brand, category, name, description, unit, pack_size, wholesale_price, available_b2b, available_dtc, sort_order) values
('DY-MBC-001','fingerlakes_farms','dairy','Muranda Bel Ceillo','Asiago/Provolone, cut to order','lb',null,16.00,true,false,552),
('DY-MSG-001','fingerlakes_farms','dairy','Muranda Smoked Gouda','Cut to order','lb',null,16.50,true,false,553),
('DY-MRB-001','fingerlakes_farms','dairy','Muranda Red Buddy','Cut to order','lb',null,15.00,true,false,554)
on conflict (sku) do nothing;

-- ============ ITHACA CHEDDAR — all sizes ============
insert into products (sku, brand, category, name, description, unit, pack_size, wholesale_price, available_b2b, available_dtc, sort_order) values
('DY-CMD-002','fingerlakes_farms','dairy','Ithaca Raw Milk Mild Cheddar — 1 lb','10 pk','case','10/1 lb',85.00,true,false,561),
('DY-CMD-003','fingerlakes_farms','dairy','Ithaca Raw Milk Mild Cheddar — 5 lb','1 pk','each','5 lb',8.50,true,false,562),
('DY-CSD-002','fingerlakes_farms','dairy','Ithaca Raw Milk Sharp Cheddar — 1 lb','10 pk','case','10/1 lb',95.00,true,false,563),
('DY-CSD-003','fingerlakes_farms','dairy','Ithaca Raw Milk Sharp Cheddar — 5 lb','1 pk','each','5 lb',9.50,true,false,564)
on conflict (sku) do nothing;

-- ============ LIVELY RUN DAIRY — cow + goat cheese ============
insert into products (sku, brand, category, name, description, unit, pack_size, wholesale_price, available_b2b, available_dtc, sort_order) values
('DY-LRB-001','fingerlakes_farms','dairy','Lively Run Blue Yonder','Cow cheese, 12/4 oz','case','12/4 oz',53.00,true,false,580),
('DY-LRB-002','fingerlakes_farms','dairy','Lively Run Blue Yonder Wheel','Cut to order','lb',null,18.00,true,false,581),
('DY-LRS-001','fingerlakes_farms','dairy','Lively Run Sheldrake','Brie style wheel, 6/8 oz','case','6/8 oz',55.95,true,false,582),
('DY-LRH-001','fingerlakes_farms','dairy','Lively Run Shire','Cow, 12/4 oz','case','12/4 oz',54.50,true,false,583),
('DY-LRC-001','fingerlakes_farms','dairy','Lively Run Sweet Chevre Assortment','Goat cheese, 12/4 oz','case','12/4 oz',50.00,true,false,584),
('DY-LRC-002','fingerlakes_farms','dairy','Lively Run Chevre Plain','Goat cheese, 20/4 oz','case','20/4 oz',80.00,true,false,585),
('DY-LRC-003','fingerlakes_farms','dairy','Lively Run Chevre Plain — 5 lb Cryo','Goat cheese','each','5 lb',66.50,true,false,586),
('DY-LRC-004','fingerlakes_farms','dairy','Lively Run Chevre Assorted','Goat cheese, 20/4 oz','case','20/4 oz',80.00,true,false,587),
('DY-LRG-001','fingerlakes_farms','dairy','Lively Run Finger Lakes Gold','Goat cheese, 12/4 oz','case','12/4 oz',62.25,true,false,588),
('DY-LRG-002','fingerlakes_farms','dairy','Lively Run Finger Lakes Gold Wheel','Cut to order','lb',null,21.00,true,false,589),
('DY-LRB-003','fingerlakes_farms','dairy','Lively Run Cayuga Blue','Goat cheese, 12/4 oz cryo','case','12/4 oz',67.85,true,false,590),
('DY-LRB-004','fingerlakes_farms','dairy','Lively Run Cayuga Blue Wheel','Cut to order','lb',null,21.25,true,false,591),
('DY-LRF-001','fingerlakes_farms','dairy','Lively Run Feta','Goat cheese, 24/4 oz cryo','case','24/4 oz',94.15,true,false,592),
('DY-LRS-002','fingerlakes_farms','dairy','Gitane on Wick','Specialty, 12/4 oz','case','12/4 oz',67.00,true,false,593),
('DY-LRS-003','fingerlakes_farms','dairy','Chamomilla','Tomme-style w/ chamomile tea, 12/4 oz','case','12/4 oz',67.00,true,false,594),
('DY-LRS-004','fingerlakes_farms','dairy','Tom','Young cheese w/ fruity notes, 12/4 oz','case','12/4 oz',67.00,true,false,595),
-- East Hill
('DY-EHS-002','fingerlakes_farms','dairy','Silver Lake Gruyere Half Wheel','14-month aged, 6-8 lbs','lb',null,15.35,true,false,596),
('DY-EHU-001','fingerlakes_farms','dairy','Underpass Reserve Raclette — 8oz','2-year aged, 12 pk','case','12/8 oz',100.00,true,false,597),
('DY-EHU-002','fingerlakes_farms','dairy','Underpass Reserve Raclette Half Wheel','2-year aged, 3-4 lbs','lb',null,15.35,true,false,598),
-- Jones extras
('DY-JCC-001','fingerlakes_farms','dairy','Jones Vegetable Crème Cheese','12/8 oz','case','12/8 oz',43.50,true,false,599)
on conflict (sku) do nothing;

-- ============ KITCHEN STAPLES — extras ============
insert into products (sku, brand, category, name, description, unit, pack_size, wholesale_price, available_b2b, available_dtc, sort_order) values
('PT-SLT-003','fingerlakes_farms','pantry','Syracuse Salt Flake — 3.5 oz','12 pk','case','12/3.5 oz',75.00,true,false,712),
('PT-SLT-004','fingerlakes_farms','pantry','Syracuse Salt Grinders — 1.5 oz','12 pk','case','12/1.5 oz',80.00,true,false,713),
('PT-MAP-004','fingerlakes_farms','pantry','NYS Maple Syrup — 5 Gal Bulk Barrel','Schoolyard Sugarbush, Grade B Dark','each','5 gallon',295.00,true,false,714),
('PT-MAP-005','fingerlakes_farms','pantry','NYS Maple Syrup — 8 oz','Light, Med, or Dark','each','8 oz',8.50,true,true,715),
('PT-MAP-006','fingerlakes_farms','pantry','NYS Maple Syrup — 32 oz','Light, Med, or Dark','each','32 oz',20.00,true,true,716),
('PT-HON-004','fingerlakes_farms','pantry','Under The Sun NY Wildflower Honey','12/16.5 oz','case','12/16.5 oz',94.50,true,false,717),
('PT-HON-005','fingerlakes_farms','pantry','Under The Sun NY Goldenrod Honey','12/16.5 oz','case','12/16.5 oz',94.50,true,false,718),
('PT-HON-006','fingerlakes_farms','pantry','Under The Sun NY Bamboo Honey','12/12 oz','case','12/12 oz',94.50,true,false,719),
('PT-HON-007','fingerlakes_farms','pantry','Under The Sun Great Lakes Wildflower','12/16.5 oz','case','12/16.5 oz',94.50,true,false,723),
('PT-HON-008','fingerlakes_farms','pantry','Clear Creek Raw Honey — 6 lb','','each','6 lb',50.00,true,false,724)
on conflict (sku) do nothing;

-- ============ BAKERY + PICKLES — more variants ============
insert into products (sku, brand, category, name, description, unit, pack_size, wholesale_price, available_b2b, available_dtc, sort_order) values
('PT-PKT-002','fingerlakes_farms','pantry','Father Sam''s Pocket Bread — Medium White','12/4 ct','case','12/4 ct',32.50,true,false,732),
('PT-PKT-003','fingerlakes_farms','pantry','Father Sam''s Pocket Bread — Medium Wheat','12/4 ct','case','12/4 ct',32.50,true,false,733),
-- Barrel + Brine individual pickle varieties
('PT-PKL-002','fingerlakes_farms','pantry','NY Deli Pickles','Barrel+Brine, 6/16 oz','case','6/16 oz',39.85,true,true,734),
('PT-PKL-003','fingerlakes_farms','pantry','Bread & Butter Pickles','Barrel+Brine, 6/16 oz','case','6/16 oz',39.85,true,true,735),
('PT-PKL-004','fingerlakes_farms','pantry','Fire & Ice Pickles','Barrel+Brine, 6/16 oz','case','6/16 oz',39.85,true,true,736),
('PT-PKL-005','fingerlakes_farms','pantry','Honey Chipotle Pickles','Barrel+Brine, 6/16 oz','case','6/16 oz',39.85,true,true,737),
('PT-PKL-006','fingerlakes_farms','pantry','Chesapeake Dill Pickles','Barrel+Brine, 6/16 oz','case','6/16 oz',39.85,true,true,738),
('PT-PKL-007','fingerlakes_farms','pantry','Heckin'' Hot Dill Pickles','Barrel+Brine, 6/16 oz','case','6/16 oz',39.85,true,true,739),
('PT-PKL-008','fingerlakes_farms','pantry','Sweet Pickled Red Onion','Barrel+Brine, 6/16 oz','case','6/16 oz',39.85,true,true,742),
('PT-KRT-002','fingerlakes_farms','pantry','Garlic Dill Kraut','Barrel+Brine, 6/16 oz','case','6/16 oz',39.85,true,false,743),
('PT-KMC-002','fingerlakes_farms','pantry','Vegan Kimchi','Barrel+Brine, 6/16 oz','case','6/16 oz',39.85,true,false,744),
-- Food Service pickles (5 gallon pails)
('PT-PKL-FS1','fingerlakes_farms','pantry','NY Whole Deli Dills — 5 Gal Pail','Barrel+Brine','each','5 gal',74.50,true,false,745),
('PT-PKL-FS2','fingerlakes_farms','pantry','Bread & Butter — 5 Gal Pail','Barrel+Brine','each','5 gal',74.50,true,false,746),
('PT-PKL-FS3','fingerlakes_farms','pantry','Classic Kraut — 5 Gal Pail','Barrel+Brine','each','5 gal',112.00,true,false,747),
('PT-PKL-FS4','fingerlakes_farms','pantry','Kimchi — 5 Gal Pail','Barrel+Brine','each','5 gal',112.00,true,false,748),
('PT-BMX-001','fingerlakes_farms','pantry','Bloody Mary Mix','Barrel+Brine, 12/32 oz','case','12/32 oz',84.00,true,false,749)
on conflict (sku) do nothing;

-- ============ TIMELESS LENTILS ============
insert into products (sku, brand, category, name, description, unit, pack_size, wholesale_price, available_b2b, available_dtc, sort_order) values
('PT-LEN-001','fingerlakes_farms','pantry','Timeless Black Beluga Lentils — 16oz','8 pk','case','8/16 oz',41.25,true,true,765),
('PT-LEN-002','fingerlakes_farms','pantry','Timeless Black Beluga Lentils — 10 lb','','each','10 lb',39.50,true,false,766),
('PT-LEN-003','fingerlakes_farms','pantry','Timeless Harvest Gold Lentils — 16oz','8 pk','case','8/16 oz',41.50,true,true,767),
('PT-LEN-004','fingerlakes_farms','pantry','Timeless Petite Crimson Lentils — 16oz','8 pk','case','8/16 oz',39.50,true,true,768),
('PT-LEN-005','fingerlakes_farms','pantry','Timeless French Green Lentils — 16oz','8 pk','case','8/16 oz',42.50,true,true,769),
('PT-LEN-006','fingerlakes_farms','pantry','Timeless Green Lentils — 16oz','8 pk','case','8/16 oz',37.95,true,true,790),
('PT-LEN-007','fingerlakes_farms','pantry','Timeless Farro — 16oz','8 pk','case','8/16 oz',42.50,true,true,791),
('PT-LEN-008','fingerlakes_farms','pantry','Timeless Black Butte Chickpeas — 16oz','8 pk','case','8/16 oz',44.50,true,true,792),
('PT-LEN-009','fingerlakes_farms','pantry','Timeless Spanish Brown Lentils — 16oz','8 pk','case','8/16 oz',37.95,true,true,793)
on conflict (sku) do nothing;
