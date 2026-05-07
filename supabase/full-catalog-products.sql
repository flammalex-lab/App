-- Real FLF catalog from Weekly Flyer 4.13.26. Replaces placeholder seed data.
-- Run 0004_add_categories.sql first (adds pantry, beverages, lamb enums).
-- Safe to re-run: ON CONFLICT (sku) DO NOTHING.

-- Clear old placeholder data (keeps any orders referencing old products intact via FK restrict)
-- If you want a clean slate: DELETE FROM order_guide_items; DELETE FROM standing_order_items; DELETE FROM products;

-- ============ GRASSLAND FARMS BEEF ============
insert into products (sku, brand, category, name, description, unit, pack_size, wholesale_price, available_b2b, available_dtc, sort_order) values
('BF-HW-001','grasslands','beef','Whole/Half Hanging Weight','Pasture fed, no hormones or antibiotics','lb',null,4.75,true,false,100),
('BF-GRD-080','grasslands','beef','Ground All Natural','per lb','lb',null,7.49,true,true,101),
('BF-GRD-090','grasslands','beef','Ground 90/10','Preorder','lb',null,8.49,true,false,102),
('BF-PAT-001','grasslands','beef','Burger Patties Retail Pack','4 ct, 1-10 lbs','case',null,79.50,true,false,103),
('BF-STL-001','grasslands','beef','Strip Loin Whole Bnls','NAMP','lb',null,20.75,true,false,110),
('BF-TSR-001','grasslands','beef','Top Sirloin Whole Bnls','','lb',null,10.95,true,false,111),
('BF-103-001','grasslands','beef','NAMP 103 Rib','','lb',null,18.95,true,false,112),
('BF-107-001','grasslands','beef','NAMP 107 Rib','','lb',null,21.95,true,false,113),
('BF-109-001','grasslands','beef','NAMP 109 Export','','lb',null,24.95,true,false,114),
('BF-RBE-001','grasslands','beef','Ribeye Whole Bnls Lip-On','','lb',null,24.95,true,false,115),
('BF-TND-001','grasslands','beef','Tenderloin Whole','','lb',null,28.99,true,false,116),
('BF-STP-001','grasslands','beef','Sirloin Tip Whole Bnls','','lb',null,7.99,true,false,117),
('BF-TPR-001','grasslands','beef','Top Round Whole','','lb',null,8.49,true,false,118),
('BF-BTR-001','grasslands','beef','Bottom Round Whole','','lb',null,7.49,true,false,119),
('BF-CHR-001','grasslands','beef','Boneless Chuck Roll','','lb',null,8.99,true,false,120),
('BF-BRK-001','grasslands','beef','Brisket Whole','','lb',null,8.99,true,false,121),
('BF-STW-001','grasslands','beef','Stew Cube/Kabobs','','lb',null,7.99,true,true,122),
('BF-FLK-002','grasslands','beef','Flank','Limited','lb',null,15.95,true,true,123),
('BF-SKR-001','grasslands','beef','Skirt Steaks','','lb',null,14.95,true,true,124),
('BF-HNG-002','grasslands','beef','Hanger Steak','Limited','lb',null,14.95,true,true,125),
('BF-FLT-001','grasslands','beef','Flat Iron Whole','','lb',null,9.49,true,false,126),
('BF-TRI-002','grasslands','beef','Sirloin Tri Tips','','lb',null,11.95,true,true,127),
('BF-FLP-001','grasslands','beef','Sirloin Flap','','lb',null,11.95,true,false,128),
('BF-EYE-001','grasslands','beef','Eye of Round Whole','','lb',null,7.99,true,false,129),
('BF-BSR-001','grasslands','beef','Bone-In Short Ribs','','lb',null,7.99,true,true,130),
('BF-BSR-002','grasslands','beef','Whole Boneless Short Ribs','','lb',null,10.99,true,true,131),
('BF-LVR-001','grasslands','beef','Liver','','lb',null,4.00,true,true,132),
('BF-TNG-001','grasslands','beef','Tongue','','lb',null,6.75,true,false,133),
('BF-HRT-001','grasslands','beef','Heart','','lb',null,5.00,true,false,134),
('BF-OSS-001','grasslands','beef','Osso Buco','','lb',null,5.99,true,true,135),
('BF-BON-001','grasslands','beef','Bones','','lb',null,2.50,true,true,136),
('BF-OXT-002','grasslands','beef','Oxtail','','lb',null,8.99,true,true,137),
('BF-DOG-001','grasslands','beef','Grassland Farms Beef Dogs','1 lb','lb','1 lb',8.49,true,true,138)
on conflict (sku) do nothing;

-- ============ ROSENKRANS DRY AGED ============
insert into products (sku, brand, category, name, description, unit, pack_size, wholesale_price, available_b2b, available_dtc, sort_order) values
('RK-107-001','fingerlakes_farms','beef','Rosenkrans NAMP 107 Rib','Dry aged','lb',null,21.95,true,false,150),
('RK-SHL-001','fingerlakes_farms','beef','Rosenkrans Whole Shortloins','Dry aged','lb',null,21.95,true,false,151),
('RK-BST-001','fingerlakes_farms','beef','Rosenkrans Bone-In Striploins','Dry aged','lb',null,20.95,true,false,152)
on conflict (sku) do nothing;

-- ============ OINK & GOBBLE PORK ============
insert into products (sku, brand, category, name, description, unit, pack_size, wholesale_price, available_b2b, available_dtc, sort_order) values
('PK-HW-001','fingerlakes_farms','pork','Whole/Half Hanging Weight','Pasture-raised','lb',null,3.90,true,false,200),
('PK-CHP-002','fingerlakes_farms','pork','Center Cut Bone-In Chops 1.5"','','lb',null,9.49,true,true,201),
('PK-SIR-001','fingerlakes_farms','pork','Bnls Sirloin Steaks','','lb',null,7.75,true,true,202),
('PK-SHD-001','fingerlakes_farms','pork','Shoulder Boneless','','lb',null,6.49,true,false,203),
('PK-TND-001','fingerlakes_farms','pork','Whole Boneless Tenders','','lb',null,11.75,true,false,204),
('PK-BLY-001','fingerlakes_farms','pork','Whole Belly Fresh','','lb',null,8.50,true,false,205),
('PK-HAM-002','fingerlakes_farms','pork','Whole Bone-In Fresh Ham','','lb',null,4.75,true,false,206),
('PK-GRD-001','fingerlakes_farms','pork','Ground Pork','','lb',null,5.95,true,true,207),
('PK-LON-001','fingerlakes_farms','pork','Whole Bone-In Loin','','lb',null,8.75,true,false,208),
('PK-LON-002','fingerlakes_farms','pork','Whole Loin Boneless','','lb',null,9.75,true,false,209),
('PK-BAC-002','fingerlakes_farms','pork','Natural Smoke Bacon','','lb',null,10.95,true,true,210),
('PK-HAM-003','fingerlakes_farms','pork','Natural Smoked Deley Hams','','lb',null,7.99,true,false,211),
('PK-SAU-002','fingerlakes_farms','pork','Sausage Links — Breakfast','','lb',null,6.99,true,true,212),
('PK-SAU-003','fingerlakes_farms','pork','Sausage Links — Mild Italian','','lb',null,6.99,true,true,213),
('PK-SAU-004','fingerlakes_farms','pork','Sausage Links — HOT Italian','','lb',null,6.99,true,true,214),
('PK-KLB-001','fingerlakes_farms','pork','Sausage Fresh Kielbasa','','lb',null,6.99,true,true,215),
('PK-STL-001','fingerlakes_farms','pork','St. Louis Ribs','','lb',null,6.50,true,true,216),
('PK-BBR-001','fingerlakes_farms','pork','Baby Back Ribs','Limited','lb',null,9.75,true,true,217),
('PK-HDG-001','fingerlakes_farms','pork','All Natural Hot Dogs','','lb',null,7.49,true,true,218)
on conflict (sku) do nothing;

-- ============ LAMB ============
insert into products (sku, brand, category, name, description, unit, pack_size, wholesale_price, available_b2b, available_dtc, sort_order) values
('LB-GRD-002','fingerlakes_farms','lamb','Ground Lamb','100% Grass Fed','lb',null,11.45,true,true,300),
('LB-LEG-001','fingerlakes_farms','lamb','Lamb Leg BRT','','lb',null,12.50,true,false,301),
('LB-SHD-001','fingerlakes_farms','lamb','Lamb Shoulder NET','','lb',null,12.95,true,false,302),
('LB-LRC-001','fingerlakes_farms','lamb','Lamb Loin or Rib Chop','','lb',null,13.75,true,true,303),
('LB-SHC-001','fingerlakes_farms','lamb','Lamb Shoulder Chop','','lb',null,12.75,true,true,304),
('LB-LON-001','fingerlakes_farms','lamb','Lamb Whole Bone-In Loin','','lb',null,10.95,true,false,305),
('LB-STW-001','fingerlakes_farms','lamb','Lamb Stew Kabobs','','lb',null,12.75,true,true,306),
('LB-RCK-002','fingerlakes_farms','lamb','Lamb Rack','','lb',null,14.50,true,true,307),
('LB-SHK-002','fingerlakes_farms','lamb','Lamb Shank','','lb',null,12.75,true,true,308),
('LB-LVR-001','fingerlakes_farms','lamb','Lamb Liver','','lb',null,4.75,true,false,309)
on conflict (sku) do nothing;
-- Part 2: Eggs, Dairy, Produce, Pantry, Beverages from FLF Weekly Flyer 4.13.26

-- ============ EGGS ============
insert into products (sku, brand, category, name, description, unit, pack_size, wholesale_price, available_b2b, available_dtc, sort_order) values
('EG-LBC-001','meadow_creek','eggs','Large Brown — Carton','Free range, 30 dz','case','30 dz carton',126.00,true,false,400),
('EG-LBL-001','meadow_creek','eggs','Large Brown — Loose','Free range, 30 dz','case','30 dz loose',120.00,true,false,401),
('EG-XLC-001','meadow_creek','eggs','X-Large Brown — Carton','Free range, 30 dz','case','30 dz carton',129.00,true,false,402),
('EG-XLL-001','meadow_creek','eggs','X-Large Brown — Loose','Free range, 30 dz','case','30 dz loose',126.00,true,false,403),
('EG-JMB-002','meadow_creek','eggs','Jumbo Brown — Carton','Free range, 24 dz','case','24 dz carton',108.00,true,false,404),
('EG-ORG-001','meadow_creek','eggs','Large Organic — Carton','Certified organic, 15 dz','case','15 dz carton',69.00,true,false,405),
('EG-DUK-001','fingerlakes_farms','eggs','Organic Duck Eggs — 6 pack','','each','6 pack',5.49,true,true,406),
('EG-FAF-001','fingerlakes_farms','eggs','Five Acre Large Brown — Carton','Positively Local, 15 dz','case','15 dz carton',75.00,true,false,407)
on conflict (sku) do nothing;

-- ============ DAIRY — Ithaca Milk ============
insert into products (sku, brand, category, name, description, unit, pack_size, wholesale_price, available_b2b, available_dtc, sort_order) values
('DY-YGP-001','fingerlakes_farms','dairy','Ithaca Milk Yogurt — Plain 6oz','Cream Top Jersey, 42-day shelf','case','12/6 oz',15.00,true,false,500),
('DY-YGV-001','fingerlakes_farms','dairy','Ithaca Milk Yogurt — Vanilla 6oz','','case','12/6 oz',15.00,true,false,501),
('DY-YGB-001','fingerlakes_farms','dairy','Ithaca Milk Yogurt — Blueberry 6oz','','case','12/6 oz',15.00,true,false,502),
('DY-YGP-032','fingerlakes_farms','dairy','Ithaca Milk Yogurt — Plain 32oz','Cream Top Jersey','case','6/32 oz',24.60,true,false,503),
('DY-MWG-001','fingerlakes_farms','dairy','Ithaca Milk Whole — Gallon','Cream on Top Jersey Cow, 18-day shelf','each','gallon',7.25,true,true,510),
('DY-MWH-001','fingerlakes_farms','dairy','Ithaca Milk Whole — Half Gallon','','each','half gallon',3.75,true,true,511),
('DY-MWQ-001','fingerlakes_farms','dairy','Ithaca Milk Whole — Quart','','each','quart',2.35,true,true,512),
('DY-SHW-001','fingerlakes_farms','dairy','Seneca Holstein Whole — Gallon','Homogenized, 18-day shelf','each','gallon',6.40,true,false,520),
('DY-SHR-001','fingerlakes_farms','dairy','Seneca Holstein Reduced Fat — Gallon','','each','gallon',6.40,true,false,521),
('DY-HCR-002','fingerlakes_farms','dairy','Pittsford Heavy Cream — Gallon','','each','128 oz',27.50,true,false,530),
('DY-HCR-003','fingerlakes_farms','dairy','Pittsford Heavy Cream — Pint','','each','16 oz',4.10,true,true,531),
('DY-BTM-001','fingerlakes_farms','dairy','Pittsford Buttermilk — Quart','','each','32 oz',3.80,true,false,532),
('DY-HH-001','fingerlakes_farms','dairy','Pittsford Half & Half — Half Gallon','','each','64 oz',7.80,true,false,533)
on conflict (sku) do nothing;

-- ============ DAIRY — Butter ============
insert into products (sku, brand, category, name, description, unit, pack_size, wholesale_price, available_b2b, available_dtc, sort_order) values
('DY-BTR-002','fingerlakes_farms','dairy','Sweet Acres Butter — 1 lb','8/1 lb case','case','8/1 lb',67.50,true,false,540),
('DY-BTR-003','fingerlakes_farms','dairy','Sweet Acres Butter — 8 oz','12/8 oz case','case','12/8 oz',56.25,true,false,541)
on conflict (sku) do nothing;

-- ============ DAIRY — Cheese ============
insert into products (sku, brand, category, name, description, unit, pack_size, wholesale_price, available_b2b, available_dtc, sort_order) values
('DY-CMD-001','fingerlakes_farms','dairy','Ithaca Raw Milk Mild Cheddar — 8oz','12 pk','case','12/8 oz',54.00,true,false,550),
('DY-CSD-001','fingerlakes_farms','dairy','Ithaca Raw Milk Sharp Cheddar — 8oz','12 pk','case','12/8 oz',60.00,true,false,551),
('DY-MBL-001','fingerlakes_farms','dairy','Muranda Blue Cheese','Cut to order','lb',null,23.50,true,false,555),
('DY-MPR-001','fingerlakes_farms','dairy','Muranda Farm House Parm','Cut to order','lb',null,19.50,true,false,556),
('DY-MGD-001','fingerlakes_farms','dairy','Muranda Gotcha Gouda','Cut to order','lb',null,15.50,true,false,557),
('DY-MCC-001','fingerlakes_farms','dairy','Muranda Old Man Cheddar','Cut to order','lb',null,15.00,true,false,558),
('DY-SLC-001','fingerlakes_farms','dairy','Silver Lake Gruyere — 8oz','East Hill Creamery, 14-month aged','case','12/8 oz',120.00,true,false,560),
('DY-CRM-001','fingerlakes_farms','dairy','Jones NY Crème Cheese — Tub','','each','32 oz',10.75,true,false,565),
('DY-FTA-001','fingerlakes_farms','dairy','Jones Feta — 5 lb Pail','','each','5 lb',64.50,true,false,566)
on conflict (sku) do nothing;

-- ============ PRODUCE — Organic Vegetables ============
insert into products (sku, brand, category, name, description, unit, pack_size, wholesale_price, available_b2b, available_dtc, sort_order) values
('PR-SPN-001','fingerlakes_farms','produce','Savoy Spinach','Organic, 3 lb','case','3 lb',24.00,true,false,600),
('PR-RBT-001','fingerlakes_farms','produce','Red Beets','Organic, 25 lb','case','25 lb',39.50,true,false,601),
('PR-GBT-001','fingerlakes_farms','produce','Gold Beets','Organic, 25 lb','case','25 lb',39.50,true,false,602),
('PR-OCR-001','fingerlakes_farms','produce','Orange Carrots','Organic, 25 lb','case','25 lb',44.50,true,false,603),
('PR-RCR-001','fingerlakes_farms','produce','Rainbow Carrots','Organic, 25 lb','case','25 lb',54.50,true,false,604),
('PR-KHR-001','fingerlakes_farms','produce','Kohlrabi','Organic, 25 lb','case','25 lb',36.00,true,false,605),
('PR-RVM-001','fingerlakes_farms','produce','Root Veg Medley','Organic, 25 lb','case','25 lb',39.50,true,false,606)
on conflict (sku) do nothing;

-- ============ PRODUCE — Local IPM + Fruit ============
insert into products (sku, brand, category, name, description, unit, pack_size, wholesale_price, available_b2b, available_dtc, sort_order) values
('PR-YGP-001','fingerlakes_farms','produce','Yukon Gold Potatoes','Local IPM, 50 lb','case','50 lb',44.50,true,false,610),
('PR-FGP-001','fingerlakes_farms','produce','Mixed Fingerling Potatoes','Local, 20 lb','case','20 lb',44.50,true,false,611),
('PR-JRO-001','fingerlakes_farms','produce','NYS Jumbo Red Onions','10 lb','case','10 lb',14.50,true,false,612),
('PR-JSO-001','fingerlakes_farms','produce','NYS Jumbo Spanish Onions','10 lb','case','10 lb',12.50,true,false,613),
('PR-HCA-001','fingerlakes_farms','produce','Honeycrisp Apples','72 ct, 40 lb','case','72 ct / 40 lb',79.50,true,false,620),
('PR-EMA-001','fingerlakes_farms','produce','Empire Apples','80 ct, 40 lb','case','80 ct / 40 lb',39.50,true,false,621),
('PR-GAA-001','fingerlakes_farms','produce','Gala Apples','80/88 ct, 40 lb (WDNSDY)','case','40 lb',49.50,true,false,622),
('PR-GRA-001','fingerlakes_farms','produce','Granny Smith Apples','72/80 ct, 40 lb','case','40 lb',59.50,true,false,623)
on conflict (sku) do nothing;

-- ============ PRODUCE — Salad & Greens ============
insert into products (sku, brand, category, name, description, unit, pack_size, wholesale_price, available_b2b, available_dtc, sort_order) values
('PR-OLV-001','fingerlakes_farms','produce','Olivia''s Organics Clamshells','PRE ORDER 1 wk, Baby Spinach/Arugula/Kale/Mix','case','8/5 oz',24.95,true,false,630),
('PR-SAT-001','fingerlakes_farms','produce','Satur Farms Clamshells — 1 lb','Wild Arugula or Baby Spinach','case','6/1 lb',35.00,true,false,631),
('PR-SAT-002','fingerlakes_farms','produce','Satur Farms Clamshells — 5 oz','Arugula/Spinach/Mesclun/Kale','case','12/5 oz',28.50,true,false,632),
('PR-GHB-001','fingerlakes_farms','produce','Gotham Greens Basil','1.25 oz','case','12 pk',43.00,true,false,633),
('PR-GHR-001','fingerlakes_farms','produce','Gotham Greens Romaine','5.5 oz','case','12 pk',43.00,true,false,634),
('PR-GHM-001','fingerlakes_farms','produce','Gotham Greens Spring Mix','9 oz','case','6 pk',36.00,true,false,635),
('PR-CEL-001','fingerlakes_farms','produce','Organic Celery Hearts','Olivia''s, 12/10 oz','case','12/10 oz',43.25,true,false,636)
on conflict (sku) do nothing;

-- ============ PANTRY — Maple, Honey, Salt ============
insert into products (sku, brand, category, name, description, unit, pack_size, wholesale_price, available_b2b, available_dtc, sort_order) values
('PT-MAP-002','fingerlakes_farms','pantry','NYS Maple Syrup — Gallon','Schoolyard Sugarbush, Grade B Dark','each','gallon',64.50,true,false,700),
('PT-MAP-003','fingerlakes_farms','pantry','NYS Maple Syrup — 16 oz','Light, Med, or Dark','each','16 oz',11.75,true,true,701),
('PT-HON-002','fingerlakes_farms','pantry','Clear Creek Raw Honey — 12 oz','Local','each','12 oz',6.25,true,true,702),
('PT-HON-003','fingerlakes_farms','pantry','Clear Creek Raw Honey — 6 lb','','each','6 lb',50.00,true,false,703),
('PT-SLT-001','fingerlakes_farms','pantry','Syracuse Salt Flake — 1.5 oz','12 pk','case','12/1.5 oz',45.50,true,false,710),
('PT-SLT-002','fingerlakes_farms','pantry','Syracuse Salt Flake — 20 oz','6 pk','case','6/20 oz',60.00,true,false,711)
on conflict (sku) do nothing;

-- ============ PANTRY — Pickles, Bakery, Beans, Flour ============
insert into products (sku, brand, category, name, description, unit, pack_size, wholesale_price, available_b2b, available_dtc, sort_order) values
('PT-PKL-001','fingerlakes_farms','pantry','Barrel+Brine Pickles','Assorted varieties, 6/16 oz','case','6/16 oz',39.85,true,false,720),
('PT-KRT-001','fingerlakes_farms','pantry','Barrel+Brine Classic Kraut','6/16 oz','case','6/16 oz',39.85,true,false,721),
('PT-KMC-001','fingerlakes_farms','pantry','Barrel+Brine Kimchi','6/16 oz','case','6/16 oz',39.85,true,false,722),
('PT-TRT-001','fingerlakes_farms','pantry','Father Sam''s Tortillas — White','18/8 ct','case','18/8 ct',38.00,true,false,730),
('PT-PKT-001','fingerlakes_farms','pantry','Father Sam''s Pocket Bread — Mini','12/9 ct','case','12/9 ct',32.00,true,false,731),
('PT-BKB-001','fingerlakes_farms','pantry','Headwater NYS Kidney Beans','12/15.5 oz','case','12/15.5 oz',17.50,true,false,740),
('PT-BBB-001','fingerlakes_farms','pantry','Headwater NYS Black Beans','12/15.5 oz','case','12/15.5 oz',17.50,true,false,741),
('PT-APF-001','fingerlakes_farms','pantry','Farmer Ground All Purpose Flour','25 lb','bag','25 lb',30.95,true,false,750),
('PT-WBF-001','fingerlakes_farms','pantry','Farmer Ground Whole Wheat Bread Flour','25 lb','bag','25 lb',33.00,true,false,751),
('PT-CRM-001','fingerlakes_farms','pantry','Farmer Ground Corn Meal','25 lb','bag','25 lb',30.95,true,false,752),
('PT-PIT-001','fingerlakes_farms','pantry','Issa''s Pita Chips — 10 oz','Restaurant style, 8 pk','case','8/10 oz',32.25,true,true,755),
('PT-MST-001','fingerlakes_farms','pantry','Pilsudski Mustards','Assorted, 6/12 oz','case','6/12 oz',18.00,true,false,760),
('PT-HRS-001','fingerlakes_farms','pantry','Bettys Pure Horseradish','12/5 oz','case','12/5 oz',24.00,true,false,761)
on conflict (sku) do nothing;

-- ============ PANTRY — Charcuterie ============
insert into products (sku, brand, category, name, description, unit, pack_size, wholesale_price, available_b2b, available_dtc, sort_order) values
('PT-VSG-001','fingerlakes_farms','pantry','Vermont Salumi Sausages','Assorted, 8/14 oz','case','8/14 oz',47.75,true,false,770),
('PT-VSL-001','fingerlakes_farms','pantry','Vermont Salumi Sliced Salami','Assorted, 8/2.5 oz','case','8/2.5 oz',37.35,true,false,771),
('PT-NFS-001','fingerlakes_farms','pantry','Niagara Sliced Charcuterie','Assorted, 20/2 oz','case','20/2 oz',73.00,true,false,772),
('PT-SAG-001','fingerlakes_farms','pantry','Saratoga Garlic Aioli','Assorted, 12/16 oz squeeze','case','12/16 oz',64.00,true,false,773)
on conflict (sku) do nothing;

-- ============ PANTRY — Frozen & Prepared ============
insert into products (sku, brand, category, name, description, unit, pack_size, wholesale_price, available_b2b, available_dtc, sort_order) values
('PT-FSP-001','fingerlakes_farms','pantry','Finger Foods Farm Frozen Soup','Broccoli Cheddar or Butternut Squash, 8/12 oz','case','8/12 oz',41.50,true,false,780),
('PT-RAV-001','fingerlakes_farms','pantry','Bozza''s Ravioli','Assorted, 12/12 oz pouches','case','12/12 oz',83.50,true,false,781),
('PT-PST-001','fingerlakes_farms','pantry','Bozza''s Pesto Sauce','Assorted, 12/6 oz packs','case','12/6 oz',69.75,true,false,782),
('PT-PRG-001','fingerlakes_farms','pantry','Pierogie Guy Pierogies','Assorted, 10/1.25 lb','case','10/1.25 lb',94.75,true,false,783),
('PT-JAM-001','fingerlakes_farms','pantry','Red Jacket Jam','Strawberry/Grape/Raspberry, 12/8 oz','case','12/8 oz',54.00,true,true,784)
on conflict (sku) do nothing;

-- ============ BEVERAGES ============
insert into products (sku, brand, category, name, description, unit, pack_size, wholesale_price, available_b2b, available_dtc, sort_order) values
('BV-CKW-001','fingerlakes_farms','beverages','Catskill Clear Water','Assorted flavors, 24/16.9 oz','case','24/16.9 oz',27.50,true,false,800),
('BV-SDS-001','fingerlakes_farms','beverages','Spindrift Sparkling Water','24/12 oz cans','case','24/12 oz',31.00,true,false,801),
('BV-SPS-001','fingerlakes_farms','beverages','Spindrift Soda','Assorted, 24/12 oz cans','case','24/12 oz',29.00,true,false,802),
('BV-KMB-001','fingerlakes_farms','beverages','Barrel+Brine Kombucha','Assorted, 24/12 oz cans','case','24/12 oz',63.00,true,false,803),
('BV-FWL-001','fingerlakes_farms','beverages','Farmwell Superfood Drink','12/12 oz cans','case','12/12 oz',29.25,true,true,804),
('BV-FFZ-001','fingerlakes_farms','beverages','Fresh Fizz Sodas','Organic, 12/12 oz cans','case','12/12 oz',25.00,true,true,805),
('BV-RJB-001','fingerlakes_farms','beverages','Red Jacket Apple Blends — 12 oz','6 pk','case','6/12 oz',13.00,true,true,810),
('BV-RJB-002','fingerlakes_farms','beverages','Red Jacket Apple Blends — 32 oz','8 pk','case','8/32 oz',29.40,true,false,811),
('BV-OAT-001','fingerlakes_farms','beverages','Oatly Barista Series','12/32 oz','case','12/32 oz',41.25,true,false,820),
('BV-CLF-001','fingerlakes_farms','beverages','Califia Almond Unsweetened','6/32 oz','case','6/32 oz',23.50,true,false,821),
('BV-MNF-001','fingerlakes_farms','beverages','Minor Figures Organic Barista Oat','6/32 oz cartons','case','6/32 oz',23.95,true,false,822),
('BV-CCB-001','fingerlakes_farms','beverages','College Club Beverages','Assorted sodas, 24/12 oz','case','24/12 oz',29.00,true,false,830),
('BV-NJO-001','fingerlakes_farms','beverages','Natalie''s Orange Juice — 8 oz','25 pk','case','25/8 oz',42.40,true,false,831),
('BV-NJO-002','fingerlakes_farms','beverages','Natalie''s Orange Juice — 32 oz','6 pk','case','6/32 oz',31.50,true,false,832),
('BV-BFW-001','fingerlakes_farms','beverages','Bear''s Fruit Sparkling Water','12/12 oz cans','case','12/12 oz',29.50,true,false,833),
('BV-JOE-001','fingerlakes_farms','beverages','Joe''s NY Lemonade — 12 oz','6 pk','case','6/12 oz',12.50,true,true,834)
on conflict (sku) do nothing;
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
-- Part 5: Seneca beans, all Farmer Ground flours, specialty, full beverage catalog
-- From FLF Weekly Flyer 4.13.26

-- ============ SENECA GRAIN & BEAN — 25# bags ============
insert into products (sku, brand, category, name, description, unit, pack_size, wholesale_price, available_b2b, available_dtc, sort_order) values
('PT-BNS-001','fingerlakes_farms','pantry','Organic Adzuki Beans — 25 lb','Seneca Grain & Bean','bag','25 lb',54.50,true,false,800),
('PT-BNS-002','fingerlakes_farms','pantry','Organic Black Beans — 25 lb','Seneca Grain & Bean','bag','25 lb',49.75,true,false,801),
('PT-BNS-003','fingerlakes_farms','pantry','Organic Cranberry Beans — 25 lb','Seneca Grain & Bean','bag','25 lb',64.50,true,false,802),
('PT-BNS-004','fingerlakes_farms','pantry','Organic Chickpeas — 25 lb','Seneca Grain & Bean','bag','25 lb',42.75,true,false,803),
('PT-BNS-005','fingerlakes_farms','pantry','Organic Dark Kidney Beans — 25 lb','Seneca Grain & Bean','bag','25 lb',65.00,true,false,804),
('PT-BNS-006','fingerlakes_farms','pantry','Organic Navy Beans — 25 lb','Seneca Grain & Bean','bag','25 lb',52.50,true,false,805),
('PT-BNS-007','fingerlakes_farms','pantry','Organic Pinto Beans — 25 lb','Seneca Grain & Bean','bag','25 lb',49.50,true,false,806),
('PT-BNS-008','fingerlakes_farms','pantry','Conventional Popcorn — 25 lb','Seneca Grain & Bean','bag','25 lb',29.50,true,false,807)
on conflict (sku) do nothing;

-- ============ FARMER GROUND FLOUR — all varieties ============
insert into products (sku, brand, category, name, description, unit, pack_size, wholesale_price, available_b2b, available_dtc, sort_order) values
('PT-APF-002','fingerlakes_farms','pantry','Farmer Ground All Purpose Flour — 12/2 lb','','case','12/2 lb',40.75,true,true,810),
('PT-HWF-001','fingerlakes_farms','pantry','Farmer Ground Half White Flour — 25 lb','','bag','25 lb',33.00,true,false,811),
('PT-HWF-002','fingerlakes_farms','pantry','Farmer Ground Half White Flour — 12/2 lb','','case','12/2 lb',40.75,true,true,812),
('PT-RYE-001','fingerlakes_farms','pantry','Farmer Ground Rye Flour — 25 lb','','bag','25 lb',28.85,true,false,813),
('PT-SPF-001','fingerlakes_farms','pantry','Farmer Ground Spelt Flour — 25 lb','','bag','25 lb',39.25,true,false,814),
('PT-SPF-002','fingerlakes_farms','pantry','Farmer Ground Spelt Flour — 12/2 lb','','case','12/2 lb',51.25,true,true,815),
('PT-WBF-002','fingerlakes_farms','pantry','Farmer Ground Whole Wheat Bread — 12/2 lb','','case','12/2 lb',40.75,true,true,816),
('PT-WPF-001','fingerlakes_farms','pantry','Farmer Ground White Pastry Flour — 25 lb','','bag','25 lb',29.00,true,false,817),
('PT-WWP-001','fingerlakes_farms','pantry','Farmer Ground Whole Wheat Pastry — 25 lb','','bag','25 lb',29.50,true,false,818),
('PT-WWP-002','fingerlakes_farms','pantry','Farmer Ground Whole Wheat Pastry — 12/2 lb','','case','12/2 lb',43.25,true,true,819),
('PT-CRM-002','fingerlakes_farms','pantry','Farmer Ground Corn Meal — 12/2 lb','','case','12/2 lb',40.75,true,true,820),
('PT-POL-001','fingerlakes_farms','pantry','Farmer Ground Polenta — 25 lb','','bag','25 lb',34.00,true,false,821),
('PT-POL-002','fingerlakes_farms','pantry','Farmer Ground Polenta — 12/2 lb','','case','12/2 lb',43.25,true,true,822),
('PT-EIK-001','fingerlakes_farms','pantry','Farmer Ground Einkorn Flour — 25 lb','','bag','25 lb',65.00,true,false,823),
('PT-EIK-002','fingerlakes_farms','pantry','Farmer Ground Einkorn Berries — 25 lb','','bag','25 lb',59.50,true,false,824),
('PT-RYB-001','fingerlakes_farms','pantry','Farmer Ground Rye Berries — 25 lb','','bag','25 lb',26.75,true,false,825),
('PT-HRW-001','fingerlakes_farms','pantry','Farmer Ground Hard Red Wheat Berries — 25 lb','','bag','25 lb',28.50,true,false,826),
('PT-SPB-001','fingerlakes_farms','pantry','Farmer Ground Spelt Berries — 25 lb','','bag','25 lb',49.50,true,false,827)
on conflict (sku) do nothing;

-- ============ HAWTHORNE VALLEY FERMENTS + SPECIALTY ============
insert into products (sku, brand, category, name, description, unit, pack_size, wholesale_price, available_b2b, available_dtc, sort_order) values
('PT-SVD-001','fingerlakes_farms','pantry','Sattva Vida Energy Bites','8/4.6 oz clamshell','case','8/4.6 oz',38.00,true,true,830),
('PT-HVK-001','fingerlakes_farms','pantry','Hawthorne Valley Plain Sauerkraut','Raw lacto-fermented, 6/15 oz','case','6/15 oz',39.00,true,false,831),
('PT-HVK-002','fingerlakes_farms','pantry','Hawthorne Valley Caraway Sauerkraut','Raw, 6/15 oz','case','6/15 oz',39.00,true,false,832),
('PT-HVK-003','fingerlakes_farms','pantry','Hawthorne Valley Jalapeno Sauerkraut','Raw, 6/15 oz','case','6/15 oz',39.00,true,false,833),
('PT-HVK-004','fingerlakes_farms','pantry','Hawthorne Valley Ruby Sauerkraut','Raw, 6/15 oz','case','6/15 oz',39.00,true,false,834),
('PT-HVK-005','fingerlakes_farms','pantry','Hawthorne Valley Turmeric Curry Kraut','Raw, 6/15 oz','case','6/15 oz',39.00,true,false,835),
('PT-HVC-001','fingerlakes_farms','pantry','Hawthorne Valley Ginger Carrots','Raw, 6/15 oz','case','6/15 oz',49.00,true,false,836),
('PT-HVK-006','fingerlakes_farms','pantry','Hawthorne Valley Kim Chee','Raw, 6/15 oz','case','6/15 oz',49.00,true,false,837),
('PT-HVB-001','fingerlakes_farms','pantry','Hawthorne Valley Ginger Beets','6/15 oz','case','6/15 oz',49.00,true,false,838),
-- Red Jacket extras
('PT-RJA-001','fingerlakes_farms','pantry','Red Jacket Apple Butter','12/8 oz','case','12/8 oz',51.75,true,true,839),
('PT-RJA-002','fingerlakes_farms','pantry','Red Jacket Apple Sauce','12/16 oz','case','12/16 oz',54.00,true,true,840),
-- Pierogie individual flavors (sample)
('PT-PRG-002','fingerlakes_farms','pantry','Pierogies Buffalo Chicken','10/1.25 lb','case','10/1.25 lb',101.75,true,false,841),
('PT-PRG-003','fingerlakes_farms','pantry','Pierogies Pulled Pork','10/1.25 lb','case','10/1.25 lb',101.75,true,false,842),
('PT-PRG-004','fingerlakes_farms','pantry','Pierogies Sauerkraut & Mushroom','10/1.25 lb','case','10/1.25 lb',94.75,true,false,843)
on conflict (sku) do nothing;

-- ============ BEVERAGES — comprehensive ============
insert into products (sku, brand, category, name, description, unit, pack_size, wholesale_price, available_b2b, available_dtc, sort_order) values
-- Red Jacket Stomps
('BV-RJS-001','fingerlakes_farms','beverages','Red Jacket Tart Cherry Stomp — 12 oz','6 pk','case','6/12 oz',16.50,true,true,840),
('BV-RJS-002','fingerlakes_farms','beverages','Red Jacket Tart Cherry Stomp — 32 oz','8 pk','case','8/32 oz',41.75,true,false,841),
('BV-RJS-003','fingerlakes_farms','beverages','Red Jacket Apricot Stomp — 12 oz','6 pk','case','6/12 oz',16.20,true,true,842),
('BV-RJS-004','fingerlakes_farms','beverages','Red Jacket Apricot Stomp — 32 oz','8 pk','case','8/32 oz',41.00,true,false,843),
('BV-RJS-005','fingerlakes_farms','beverages','Red Jacket Black & Blue Stomp — 32 oz','8 pk','case','8/32 oz',41.00,true,false,844),
-- Lemonade / Ciders
('BV-JOE-002','fingerlakes_farms','beverages','Joe''s NY Lemonade — 32 oz','8 pk','case','8/32 oz',28.40,true,false,845),
('BV-LZ-001','fingerlakes_farms','beverages','Lemonade Zinger — 12 oz','6 pk','case','6/12 oz',10.25,true,true,846),
('BV-LZ-002','fingerlakes_farms','beverages','Lemonade Zinger — 64 oz','9 pk','case','9/64 oz',35.40,true,false,847),
('BV-CDR-001','fingerlakes_farms','beverages','Original Cider w/ Preserves — 12 oz','6 pk','case','6/12 oz',10.25,true,true,848),
('BV-CDR-002','fingerlakes_farms','beverages','Original Cider w/ Preserves — 64 oz','9 pk','case','9/64 oz',32.40,true,true,849),
('BV-CDR-003','fingerlakes_farms','beverages','Original Cider w/ Preserves — 128 oz','4 pk','case','4/128 oz',28.50,true,false,850),
('BV-CDR-004','fingerlakes_farms','beverages','Fuji Cider — 64 oz','9 pk','case','9/64 oz',32.40,true,true,851),
('BV-CDR-005','fingerlakes_farms','beverages','Organic Cider — 64 oz','Seasonal, 9 pk','case','9/64 oz',49.50,true,true,852),
('BV-CDR-006','fingerlakes_farms','beverages','HoneyCrisp Cider — 64 oz','Seasonal, 9 pk','case','9/64 oz',34.00,true,true,853),
('BV-CDR-007','fingerlakes_farms','beverages','Spiced Cider — 64 oz','Seasonal, 9 pk','case','9/64 oz',34.00,true,true,854),
-- Bear's Fruit
('BV-BFT-001','fingerlakes_farms','beverages','Bear''s Fruit RTD Organic Teas & Juices','Assorted, 12/16 oz','case','12/16 oz',23.40,true,false,855),
-- CBD Tea Sachets (grouped by flavor family)
('BV-CBD-001','fingerlakes_farms','beverages','CBD Tea Sachet CENTER — 6/8 oz','Cinnamon Spice w/ 8mg CBD','case','6/8 oz',43.75,true,true,856),
('BV-CBD-002','fingerlakes_farms','beverages','CBD Tea Sachet CALM — 6/8 oz','Turmeric Ginger w/ 9mg CBD','case','6/8 oz',43.75,true,true,857),
('BV-CBD-003','fingerlakes_farms','beverages','CBD Tea Sachet CHILL — 6/8 oz','Chamomile Mint w/ 16mg CBD','case','6/8 oz',43.75,true,true,858),
('BV-CBD-004','fingerlakes_farms','beverages','CBD Tea Sachet SLEEP — 6/8 oz','Holy Basil & Coconut w/ 25mg CBD','case','6/8 oz',51.50,true,true,859),
('BV-CBD-005','fingerlakes_farms','beverages','CBD Tea Sachet BOOM — 6/8 oz','Chocolate & Coconut w/ 22mg CBD','case','6/8 oz',51.50,true,true,860),
('BV-CBD-006','fingerlakes_farms','beverages','CBD Tea REFRESH — 12/16 oz','Cranberry, Green Tea & Coconut','case','12/16 oz',40.00,true,false,861),
('BV-CBD-007','fingerlakes_farms','beverages','CBD Tea CALM — 12/16 oz','Turmeric Ginger Honey','case','12/16 oz',40.00,true,false,862),
('BV-CBD-008','fingerlakes_farms','beverages','CBD Coffee — 12/12 oz','Brewed Coffee & Hemp, 12 pk','case','12/12 oz',42.50,true,false,863),
('BV-CBD-009','fingerlakes_farms','beverages','CBD Sparkling Elixir — 12/12 oz','Assorted, 12 pk','case','12/12 oz',35.50,true,false,864),
-- THD Shots
('BV-THD-001','fingerlakes_farms','beverages','THD Turmeric Ginger Shot — 8/2 oz','','case','8/2 oz',27.15,true,true,865),
('BV-THD-002','fingerlakes_farms','beverages','THD Peach Tea Shot — 8/2 oz','','case','8/2 oz',34.30,true,true,866),
('BV-THD-003','fingerlakes_farms','beverages','THD Green Tea & Honey Shot — 8/2 oz','','case','8/2 oz',27.15,true,true,867),
('BV-THD-004','fingerlakes_farms','beverages','THD Delta 9 Coffee Shot — 8/2 oz','','case','8/2 oz',34.30,true,true,868),
-- Harney & Sons
('BV-HSP-001','fingerlakes_farms','beverages','Harney & Sons Premium Coconut Water','12/10.8 oz','case','12/10.8 oz',19.95,true,false,869),
('BV-HSP-002','fingerlakes_farms','beverages','Harney & Sons Pineapple Juice','12/10.8 oz','case','12/10.8 oz',19.95,true,false,870),
('BV-HSP-003','fingerlakes_farms','beverages','Harney & Sons Watermelon Juice','12/10.8 oz','case','12/10.8 oz',19.95,true,false,871),
-- Natalie's Orchid Island Juice
('BV-NAT-001','fingerlakes_farms','beverages','Natalie''s Orange Juice — 8 oz','25 pk','case','25/8 oz',42.60,true,false,872),
('BV-NAT-002','fingerlakes_farms','beverages','Natalie''s Orange Juice — 12 oz','12 pk','case','12/12 oz',25.55,true,false,873),
('BV-NAT-003','fingerlakes_farms','beverages','Natalie''s Orange Juice — 32 oz','6 pk','case','6/32 oz',31.50,true,false,874),
('BV-NAT-004','fingerlakes_farms','beverages','Natalie''s Orange Juice — 56 oz','4 pk','case','4/56 oz',48.15,true,false,875),
('BV-NAT-005','fingerlakes_farms','beverages','Natalie''s Orange Mango — 12 oz','6 pk','case','6/12 oz',14.50,true,true,876),
('BV-NAT-006','fingerlakes_farms','beverages','Natalie''s Orange Pineapple — 12 oz','6 pk','case','6/12 oz',14.50,true,true,877),
('BV-NAT-007','fingerlakes_farms','beverages','Natalie''s Orange Beet — 12 oz','6 pk','case','6/12 oz',14.50,true,true,878),
('BV-NAT-008','fingerlakes_farms','beverages','Natalie''s Blood Orange — 12 oz','6 pk','case','6/12 oz',19.25,true,true,879),
('BV-NAT-009','fingerlakes_farms','beverages','Natalie''s Grapefruit Juice — 12 oz','6 pk','case','6/12 oz',14.85,true,true,880),
('BV-NAT-010','fingerlakes_farms','beverages','Natalie''s Grapefruit Juice — 32 oz','6 pk','case','6/32 oz',31.50,true,false,881),
('BV-NAT-011','fingerlakes_farms','beverages','Natalie''s Grapefruit Juice — 48 oz','6 pk','case','6/48 oz',48.15,true,false,882),
('BV-NAT-012','fingerlakes_farms','beverages','Natalie''s Tangerine Juice — 12 oz','6 pk','case','6/12 oz',15.60,true,true,883),
('BV-NAT-013','fingerlakes_farms','beverages','Natalie''s Tangerine Juice — 32 oz','6 pk','case','6/32 oz',37.20,true,false,884),
('BV-NAT-014','fingerlakes_farms','beverages','Natalie''s Tangerine Juice — 56 oz','4 pk','case','4/56 oz',32.95,true,false,885),
('BV-NAT-015','fingerlakes_farms','beverages','Natalie''s Carrot Ginger Juice — 12 oz','6 pk','case','6/12 oz',19.25,true,true,886),
('BV-NAT-016','fingerlakes_farms','beverages','Natalie''s Pineapple Kale & Zinc — 12 oz','6 pk','case','6/12 oz',19.85,true,true,887),
('BV-NAT-017','fingerlakes_farms','beverages','Natalie''s Natural Lemonade — 12 oz','6 pk','case','6/12 oz',11.35,true,true,888),
('BV-NAT-018','fingerlakes_farms','beverages','Natalie''s Natural Lemonade — 56 oz','6 pk','case','6/56 oz',26.45,true,false,889),
('BV-NAT-019','fingerlakes_farms','beverages','Natalie''s Strawberry Lemonade — 12 oz','6 pk','case','6/12 oz',11.65,true,true,890),
('BV-NAT-020','fingerlakes_farms','beverages','Natalie''s Guava Lemonade — 12 oz','6 pk','case','6/12 oz',11.65,true,true,891),
('BV-NAT-021','fingerlakes_farms','beverages','Natalie''s Lemon Juice — 32 oz','6 pk','case','6/32 oz',37.65,true,false,892),
('BV-NAT-022','fingerlakes_farms','beverages','Natalie''s Lime Juice NFC — 32 oz','6 pk','case','6/32 oz',36.15,true,false,893),
-- College Club sodas
('BV-CCL-002','fingerlakes_farms','beverages','Buffalo Birch Beer','College Club, 24/12 oz','case','24/12 oz',29.00,true,true,894),
('BV-CCL-003','fingerlakes_farms','beverages','Cola','College Club, 24/12 oz','case','24/12 oz',29.00,true,true,895),
('BV-CCL-004','fingerlakes_farms','beverages','Roc City Root Beer','College Club, 24/12 oz','case','24/12 oz',29.00,true,true,896),
('BV-CCL-005','fingerlakes_farms','beverages','Ginger Ale — 1922','College Club, 24/12 oz','case','24/12 oz',29.00,true,true,897),
('BV-CCL-006','fingerlakes_farms','beverages','Grapefruit Soda','College Club, 24/12 oz','case','24/12 oz',29.00,true,true,898),
('BV-CCL-007','fingerlakes_farms','beverages','Shirley Temple Soda','College Club, 24/12 oz','case','24/12 oz',29.00,true,true,899)
on conflict (sku) do nothing;
