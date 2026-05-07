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
