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
