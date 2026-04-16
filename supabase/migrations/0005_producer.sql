-- Add producer/farm layer — a text field that identifies the actual source
-- (Grassland Farms, Oink & Gobble, Ithaca Milk, etc.) beyond our 3-value brand enum.
-- Safe to re-run.

alter table products add column if not exists producer text;
create index if not exists idx_products_producer on products(producer);

-- Backfill from SKU prefix patterns
update products set producer = 'Grassland Farms Beef' where sku like 'BF-%' and sku not like 'RK-%' and producer is null;
update products set producer = 'Rosenkrans Natural Beef Co.' where sku like 'RK-%' and producer is null;
update products set producer = 'Oink & Gobble Farm'       where sku like 'PK-%' and sku not in ('PK-TRK-001','PK-DCK-001','PK-RAB-001') and producer is null;
update products set producer = 'Briar Patch at Whiskey Hill' where sku = 'PK-RAB-001' and producer is null;
update products set producer = 'White Clover Sheep Farm'  where sku like 'LB-%' and producer is null;
update products set producer = 'Meadow Creek'             where sku like 'EG-LB%' or sku like 'EG-XL%' or sku like 'EG-JMB%' or sku = 'EG-ORG-001' and producer is null;
update products set producer = 'Five Acre Farms'          where sku = 'EG-FAF-001' and producer is null;

-- Dairy by SKU hint
update products set producer = 'Ithaca Milk' where (sku like 'DY-YG%' or sku like 'DY-MW%' or sku like 'DY-CMD%' or sku like 'DY-CSD%') and producer is null;
update products set producer = 'Seneca Holstein' where sku like 'DY-SH%' and producer is null;
update products set producer = 'Pittsford Farms Dairy' where (sku like 'DY-HCR%' or sku = 'DY-BTM-001' or sku like 'DY-HH%' or sku like 'DY-PCM%' or sku like 'DY-PHH%') and producer is null;
update products set producer = 'Sweet Acres Creamery' where sku like 'DY-BTR%' and producer is null;
update products set producer = 'Muranda Cheese Company' where sku like 'DY-M%' and producer is null;
update products set producer = 'Lively Run Dairy' where sku like 'DY-LR%' and producer is null;
update products set producer = 'East Hill Creamery' where sku like 'DY-EH%' or sku like 'DY-SLC%' and producer is null;
update products set producer = 'Jones' where sku like 'DY-CRM%' or sku like 'DY-FTA%' or sku like 'DY-JCC%' and producer is null;
update products set producer = 'Five Acre Farms' where sku like 'DY-FA%' and producer is null;

-- Produce producers
update products set producer = 'Olivia''s Organics' where sku = 'PR-OLV-001' or sku = 'PR-CEL-001' and producer is null;
update products set producer = 'Satur Farms' where sku like 'PR-SAT%' and producer is null;
update products set producer = 'Gotham Greens' where sku like 'PR-GH%' and producer is null;

-- Pantry producers
update products set producer = 'Syracuse Salt Co' where sku like 'PT-SLT%' and producer is null;
update products set producer = 'Schoolyard Sugarbush' where sku like 'PT-MAP%' and producer is null;
update products set producer = 'Clear Creek Honey' where sku like 'PT-HON%' and sku not in ('PT-HON-004','PT-HON-005','PT-HON-006','PT-HON-007') and producer is null;
update products set producer = 'Under The Sun Honey' where sku in ('PT-HON-004','PT-HON-005','PT-HON-006','PT-HON-007') and producer is null;
update products set producer = 'Headwater' where sku like 'PT-B%B%' and producer is null;
update products set producer = 'Father Sam''s Bakery' where sku like 'PT-TRT%' or sku like 'PT-PKT%' and producer is null;
update products set producer = 'Barrel + Brine' where sku like 'PT-PKL%' or sku like 'PT-KRT%' or sku like 'PT-KMC%' or sku = 'PT-BMX-001' and producer is null;
update products set producer = 'Vermont Salumi' where sku like 'PT-VS%' and producer is null;
update products set producer = 'Niagara Food Specialties' where sku = 'PT-NFS-001' and producer is null;
update products set producer = 'Saratoga Garlic' where sku = 'PT-SAG-001' and producer is null;
update products set producer = 'Finger Foods Farm' where sku like 'PT-FSP%' and producer is null;
update products set producer = 'Bozza''s' where sku like 'PT-RAV%' or sku like 'PT-PST%' and producer is null;
update products set producer = 'The Pierogie Guy' where sku like 'PT-PRG%' and producer is null;
update products set producer = 'Red Jacket' where sku like 'PT-JAM%' or sku like 'PT-RJA%' and producer is null;
update products set producer = 'Timeless Natural Food' where sku like 'PT-LEN%' and producer is null;
update products set producer = 'Seneca Grain & Bean' where sku like 'PT-BNS%' and producer is null;
update products set producer = 'Farmer Ground Flour' where (sku like 'PT-APF%' or sku like 'PT-HWF%' or sku like 'PT-RYE%' or sku like 'PT-SPF%' or sku like 'PT-WBF%' or sku like 'PT-WPF%' or sku like 'PT-WWP%' or sku like 'PT-CRM%' or sku like 'PT-POL%' or sku like 'PT-EIK%' or sku like 'PT-RYB%' or sku like 'PT-HRW%' or sku like 'PT-SPB%') and producer is null;
update products set producer = 'Sattva Vida' where sku = 'PT-SVD-001' and producer is null;
update products set producer = 'Hawthorne Valley Ferments' where sku like 'PT-HV%' and producer is null;
update products set producer = 'Pilsudski' where sku = 'PT-MST-001' and producer is null;
update products set producer = 'Bettys' where sku = 'PT-HRS-001' and producer is null;
update products set producer = 'Issa''s' where sku = 'PT-PIT-001' and producer is null;

-- Beverage producers
update products set producer = 'Catskill Clear Water' where sku like 'BV-CKW%' and producer is null;
update products set producer = 'Spindrift' where sku like 'BV-SDS%' or sku like 'BV-SPS%' and producer is null;
update products set producer = 'Barrel + Brine' where sku like 'BV-KMB%' and producer is null;
update products set producer = 'Farmwell' where sku like 'BV-FWL%' and producer is null;
update products set producer = 'Fresh Fizz Sodas' where sku like 'BV-FFZ%' and producer is null;
update products set producer = 'Red Jacket' where sku like 'BV-RJ%' and producer is null;
update products set producer = 'Oatly' where sku like 'BV-OAT%' and producer is null;
update products set producer = 'Califia Farms' where sku like 'BV-CLF%' and producer is null;
update products set producer = 'Minor Figures' where sku like 'BV-MNF%' and producer is null;
update products set producer = 'College Club Beverages' where sku like 'BV-CC%' and producer is null;
update products set producer = 'Natalie''s Orchid Island' where sku like 'BV-NAT%' and producer is null;
update products set producer = 'Bear''s Fruit' where sku like 'BV-BF%' and producer is null;
update products set producer = 'Joe''s NY Style' where sku like 'BV-JOE%' or sku like 'BV-LZ%' and producer is null;
update products set producer = 'Red Jacket' where sku like 'BV-CDR%' and producer is null;
update products set producer = 'Harney & Sons' where sku like 'BV-HSP%' and producer is null;
update products set producer = 'FLX Wellness' where sku like 'BV-CBD%' or sku like 'BV-THD%' and producer is null;
