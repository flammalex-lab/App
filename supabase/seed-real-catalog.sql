-- Real FLF catalog from Weekly Flyer 4.13.26. Replaces placeholder seed data.
-- Run 0004_add_categories.sql first (adds pantry, beverages, lamb enums).
-- Safe to re-run: ON CONFLICT (sku) DO NOTHING.

-- Clear old placeholder data (keeps any orders referencing old products intact via FK restrict)
-- If you want a clean slate: DELETE FROM order_guide_items; DELETE FROM standing_order_items; DELETE FROM products;

-- ============ GRASSLAND FARMS BEEF ============
insert into products (sku, brand, category, name, description, unit, pack_size, wholesale_price, available_b2b, available_dtc, sort_order) values
('BF-HW-001','grasslands','meat','Whole/Half Hanging Weight','Pasture fed, no hormones or antibiotics','lb',null,4.75,true,false,100),
('BF-GRD-080','grasslands','meat','Ground All Natural','per lb','lb',null,7.49,true,true,101),
('BF-GRD-090','grasslands','meat','Ground 90/10','Preorder','lb',null,8.49,true,false,102),
('BF-PAT-001','grasslands','meat','Burger Patties Retail Pack','4 ct, 1-10 lbs','case',null,79.50,true,false,103),
('BF-STL-001','grasslands','meat','Strip Loin Whole Bnls','NAMP','lb',null,20.75,true,false,110),
('BF-TSR-001','grasslands','meat','Top Sirloin Whole Bnls','','lb',null,10.95,true,false,111),
('BF-103-001','grasslands','meat','NAMP 103 Rib','','lb',null,18.95,true,false,112),
('BF-107-001','grasslands','meat','NAMP 107 Rib','','lb',null,21.95,true,false,113),
('BF-109-001','grasslands','meat','NAMP 109 Export','','lb',null,24.95,true,false,114),
('BF-RBE-001','grasslands','meat','Ribeye Whole Bnls Lip-On','','lb',null,24.95,true,false,115),
('BF-TND-001','grasslands','meat','Tenderloin Whole','','lb',null,28.99,true,false,116),
('BF-STP-001','grasslands','meat','Sirloin Tip Whole Bnls','','lb',null,7.99,true,false,117),
('BF-TPR-001','grasslands','meat','Top Round Whole','','lb',null,8.49,true,false,118),
('BF-BTR-001','grasslands','meat','Bottom Round Whole','','lb',null,7.49,true,false,119),
('BF-CHR-001','grasslands','meat','Boneless Chuck Roll','','lb',null,8.99,true,false,120),
('BF-BRK-001','grasslands','meat','Brisket Whole','','lb',null,8.99,true,false,121),
('BF-STW-001','grasslands','meat','Stew Cube/Kabobs','','lb',null,7.99,true,true,122),
('BF-FLK-002','grasslands','meat','Flank','Limited','lb',null,15.95,true,true,123),
('BF-SKR-001','grasslands','meat','Skirt Steaks','','lb',null,14.95,true,true,124),
('BF-HNG-002','grasslands','meat','Hanger Steak','Limited','lb',null,14.95,true,true,125),
('BF-FLT-001','grasslands','meat','Flat Iron Whole','','lb',null,9.49,true,false,126),
('BF-TRI-002','grasslands','meat','Sirloin Tri Tips','','lb',null,11.95,true,true,127),
('BF-FLP-001','grasslands','meat','Sirloin Flap','','lb',null,11.95,true,false,128),
('BF-EYE-001','grasslands','meat','Eye of Round Whole','','lb',null,7.99,true,false,129),
('BF-BSR-001','grasslands','meat','Bone-In Short Ribs','','lb',null,7.99,true,true,130),
('BF-BSR-002','grasslands','meat','Whole Boneless Short Ribs','','lb',null,10.99,true,true,131),
('BF-LVR-001','grasslands','meat','Liver','','lb',null,4.00,true,true,132),
('BF-TNG-001','grasslands','meat','Tongue','','lb',null,6.75,true,false,133),
('BF-HRT-001','grasslands','meat','Heart','','lb',null,5.00,true,false,134),
('BF-OSS-001','grasslands','meat','Osso Buco','','lb',null,5.99,true,true,135),
('BF-BON-001','grasslands','meat','Bones','','lb',null,2.50,true,true,136),
('BF-OXT-002','grasslands','meat','Oxtail','','lb',null,8.99,true,true,137),
('BF-DOG-001','grasslands','meat','Grassland Farms Beef Dogs','1 lb','lb','1 lb',8.49,true,true,138)
on conflict (sku) do nothing;

-- ============ ROSENKRANS DRY AGED ============
insert into products (sku, brand, category, name, description, unit, pack_size, wholesale_price, available_b2b, available_dtc, sort_order) values
('RK-107-001','fingerlakes_farms','meat','Rosenkrans NAMP 107 Rib','Dry aged','lb',null,21.95,true,false,150),
('RK-SHL-001','fingerlakes_farms','meat','Rosenkrans Whole Shortloins','Dry aged','lb',null,21.95,true,false,151),
('RK-BST-001','fingerlakes_farms','meat','Rosenkrans Bone-In Striploins','Dry aged','lb',null,20.95,true,false,152)
on conflict (sku) do nothing;

-- ============ OINK & GOBBLE PORK ============
insert into products (sku, brand, category, name, description, unit, pack_size, wholesale_price, available_b2b, available_dtc, sort_order) values
('PK-HW-001','fingerlakes_farms','meat','Whole/Half Hanging Weight','Pasture-raised','lb',null,3.90,true,false,200),
('PK-CHP-002','fingerlakes_farms','meat','Center Cut Bone-In Chops 1.5"','','lb',null,9.49,true,true,201),
('PK-SIR-001','fingerlakes_farms','meat','Bnls Sirloin Steaks','','lb',null,7.75,true,true,202),
('PK-SHD-001','fingerlakes_farms','meat','Shoulder Boneless','','lb',null,6.49,true,false,203),
('PK-TND-001','fingerlakes_farms','meat','Whole Boneless Tenders','','lb',null,11.75,true,false,204),
('PK-BLY-001','fingerlakes_farms','meat','Whole Belly Fresh','','lb',null,8.50,true,false,205),
('PK-HAM-002','fingerlakes_farms','meat','Whole Bone-In Fresh Ham','','lb',null,4.75,true,false,206),
('PK-GRD-001','fingerlakes_farms','meat','Ground Pork','','lb',null,5.95,true,true,207),
('PK-LON-001','fingerlakes_farms','meat','Whole Bone-In Loin','','lb',null,8.75,true,false,208),
('PK-LON-002','fingerlakes_farms','meat','Whole Loin Boneless','','lb',null,9.75,true,false,209),
('PK-BAC-002','fingerlakes_farms','meat','Natural Smoke Bacon','','lb',null,10.95,true,true,210),
('PK-HAM-003','fingerlakes_farms','meat','Natural Smoked Deley Hams','','lb',null,7.99,true,false,211),
('PK-SAU-002','fingerlakes_farms','meat','Sausage Links — Breakfast','','lb',null,6.99,true,true,212),
('PK-SAU-003','fingerlakes_farms','meat','Sausage Links — Mild Italian','','lb',null,6.99,true,true,213),
('PK-SAU-004','fingerlakes_farms','meat','Sausage Links — HOT Italian','','lb',null,6.99,true,true,214),
('PK-KLB-001','fingerlakes_farms','meat','Sausage Fresh Kielbasa','','lb',null,6.99,true,true,215),
('PK-STL-001','fingerlakes_farms','meat','St. Louis Ribs','','lb',null,6.50,true,true,216),
('PK-BBR-001','fingerlakes_farms','meat','Baby Back Ribs','Limited','lb',null,9.75,true,true,217),
('PK-HDG-001','fingerlakes_farms','meat','All Natural Hot Dogs','','lb',null,7.49,true,true,218)
on conflict (sku) do nothing;

-- ============ LAMB ============
insert into products (sku, brand, category, name, description, unit, pack_size, wholesale_price, available_b2b, available_dtc, sort_order) values
('LB-GRD-002','fingerlakes_farms','meat','Ground Lamb','100% Grass Fed','lb',null,11.45,true,true,300),
('LB-LEG-001','fingerlakes_farms','meat','Lamb Leg BRT','','lb',null,12.50,true,false,301),
('LB-SHD-001','fingerlakes_farms','meat','Lamb Shoulder NET','','lb',null,12.95,true,false,302),
('LB-LRC-001','fingerlakes_farms','meat','Lamb Loin or Rib Chop','','lb',null,13.75,true,true,303),
('LB-SHC-001','fingerlakes_farms','meat','Lamb Shoulder Chop','','lb',null,12.75,true,true,304),
('LB-LON-001','fingerlakes_farms','meat','Lamb Whole Bone-In Loin','','lb',null,10.95,true,false,305),
('LB-STW-001','fingerlakes_farms','meat','Lamb Stew Kabobs','','lb',null,12.75,true,true,306),
('LB-RCK-002','fingerlakes_farms','meat','Lamb Rack','','lb',null,14.50,true,true,307),
('LB-SHK-002','fingerlakes_farms','meat','Lamb Shank','','lb',null,12.75,true,true,308),
('LB-LVR-001','fingerlakes_farms','meat','Lamb Liver','','lb',null,4.75,true,false,309)
on conflict (sku) do nothing;
