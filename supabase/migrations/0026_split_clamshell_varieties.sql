-- Split lumped "clamshell" SKUs (Satur Farms × 2, Olivia's Organics × 1)
-- into one row per variety. Each parent row stuffs a variety list into the
-- description field — buyers had no way to specify which variety they
-- actually wanted, and the catalog card couldn't surface them either.
--
-- Decisions (per Alex):
--   - Each case is a single variety (12/5 oz = 12 clamshells, all one
--     variety). So we split into separate SKUs, not into mixed-variety
--     pack_options.
--   - Delete the parent SKUs after splitting. If a parent is referenced by
--     historical orders or standing orders (FK ON DELETE RESTRICT on
--     order_items / standing_order_items), the DELETE will fail; we catch
--     the FK violation in a DO block and fall back to is_active=false on
--     the parent so the catalog hides it but historical references stay
--     intact. Either outcome is correct — pure delete is the cleaner end
--     state when there's no historical traffic yet.
--   - Replicate parent's order-guide and pricing-list refs to all children
--     so a buyer whose guide had the lumped clamshell still has every
--     variety in their guide after the split (they can prune to taste).
--     Same for account-specific pricing overrides and account_products
--     visibility allow-lists.
--
-- Children insert with on conflict do nothing — re-running this migration
-- after a partial run is a no-op on the children that already exist.

-- ─── 1. Insert variety SKUs ────────────────────────────────────────────

-- Olivia's Organics Clamshells (PR-OLV-001) → 4 varieties.
insert into products (
  sku, name, description,
  brand, category, producer, unit, pack_size, case_pack,
  wholesale_price, retail_price, available_b2b, available_dtc,
  sort_order, is_active, available_this_week, in_season,
  image_url, primal, sub_primal, cut_type, avg_weight_lbs, qb_income_account
)
select v.sku, v.name, 'PRE ORDER 1 wk',
       p.brand, p.category, p.producer, p.unit, p.pack_size, p.case_pack,
       p.wholesale_price, p.retail_price, p.available_b2b, p.available_dtc,
       p.sort_order, p.is_active, p.available_this_week, p.in_season,
       p.image_url, p.primal, p.sub_primal, p.cut_type, p.avg_weight_lbs, p.qb_income_account
  from products p
  cross join (values
    ('PR-OLV-001S', 'Olivia''s Organics Baby Spinach Clamshells'),
    ('PR-OLV-001A', 'Olivia''s Organics Arugula Clamshells'),
    ('PR-OLV-001K', 'Olivia''s Organics Kale Clamshells'),
    ('PR-OLV-001M', 'Olivia''s Organics Spring Mix Clamshells')
  ) as v(sku, name)
 where p.sku = 'PR-OLV-001'
on conflict (sku) do nothing;

-- Satur Farms Clamshells — 1 lb (PR-SAT-001) → 2 varieties.
insert into products (
  sku, name, description,
  brand, category, producer, unit, pack_size, case_pack,
  wholesale_price, retail_price, available_b2b, available_dtc,
  sort_order, is_active, available_this_week, in_season,
  image_url, primal, sub_primal, cut_type, avg_weight_lbs, qb_income_account
)
select v.sku, v.name, null,
       p.brand, p.category, p.producer, p.unit, p.pack_size, p.case_pack,
       p.wholesale_price, p.retail_price, p.available_b2b, p.available_dtc,
       p.sort_order, p.is_active, p.available_this_week, p.in_season,
       p.image_url, p.primal, p.sub_primal, p.cut_type, p.avg_weight_lbs, p.qb_income_account
  from products p
  cross join (values
    ('PR-SAT-001A', 'Satur Farms Wild Arugula Clamshells — 1 lb'),
    ('PR-SAT-001S', 'Satur Farms Baby Spinach Clamshells — 1 lb')
  ) as v(sku, name)
 where p.sku = 'PR-SAT-001'
on conflict (sku) do nothing;

-- Satur Farms Clamshells — 5 oz (PR-SAT-002) → 4 varieties.
insert into products (
  sku, name, description,
  brand, category, producer, unit, pack_size, case_pack,
  wholesale_price, retail_price, available_b2b, available_dtc,
  sort_order, is_active, available_this_week, in_season,
  image_url, primal, sub_primal, cut_type, avg_weight_lbs, qb_income_account
)
select v.sku, v.name, null,
       p.brand, p.category, p.producer, p.unit, p.pack_size, p.case_pack,
       p.wholesale_price, p.retail_price, p.available_b2b, p.available_dtc,
       p.sort_order, p.is_active, p.available_this_week, p.in_season,
       p.image_url, p.primal, p.sub_primal, p.cut_type, p.avg_weight_lbs, p.qb_income_account
  from products p
  cross join (values
    ('PR-SAT-002A', 'Satur Farms Arugula Clamshells — 5 oz'),
    ('PR-SAT-002S', 'Satur Farms Spinach Clamshells — 5 oz'),
    ('PR-SAT-002M', 'Satur Farms Mesclun Clamshells — 5 oz'),
    ('PR-SAT-002K', 'Satur Farms Kale Clamshells — 5 oz')
  ) as v(sku, name)
 where p.sku = 'PR-SAT-002'
on conflict (sku) do nothing;

-- ─── 2. Replicate FK refs from parent to children ──────────────────────

-- order_guide_items: any guide that had the parent now also has each child.
insert into order_guide_items (order_guide_id, product_id, suggested_qty, par_levels, sort_order)
select ogi.order_guide_id, c.id, ogi.suggested_qty, ogi.par_levels, ogi.sort_order
  from order_guide_items ogi
  join products parent on parent.id = ogi.product_id
  join products c on (
       (parent.sku = 'PR-OLV-001' and c.sku in ('PR-OLV-001S','PR-OLV-001A','PR-OLV-001K','PR-OLV-001M'))
    or (parent.sku = 'PR-SAT-001' and c.sku in ('PR-SAT-001A','PR-SAT-001S'))
    or (parent.sku = 'PR-SAT-002' and c.sku in ('PR-SAT-002A','PR-SAT-002S','PR-SAT-002M','PR-SAT-002K'))
  )
 where parent.sku in ('PR-OLV-001','PR-SAT-001','PR-SAT-002')
on conflict (order_guide_id, product_id) do nothing;

-- account_pricing: per-customer overrides on the parent → also override on
-- each child.
insert into account_pricing (account_id, product_id, custom_price, effective_date, expiry_date)
select ap.account_id, c.id, ap.custom_price, ap.effective_date, ap.expiry_date
  from account_pricing ap
  join products parent on parent.id = ap.product_id
  join products c on (
       (parent.sku = 'PR-OLV-001' and c.sku in ('PR-OLV-001S','PR-OLV-001A','PR-OLV-001K','PR-OLV-001M'))
    or (parent.sku = 'PR-SAT-001' and c.sku in ('PR-SAT-001A','PR-SAT-001S'))
    or (parent.sku = 'PR-SAT-002' and c.sku in ('PR-SAT-002A','PR-SAT-002S','PR-SAT-002M','PR-SAT-002K'))
  )
 where parent.sku in ('PR-OLV-001','PR-SAT-001','PR-SAT-002')
on conflict (account_id, product_id) do nothing;

-- price_list_items: same idea for shared price-list rows.
insert into price_list_items (price_list_id, product_id, unit_price, effective_date, expiry_date)
select pli.price_list_id, c.id, pli.unit_price, pli.effective_date, pli.expiry_date
  from price_list_items pli
  join products parent on parent.id = pli.product_id
  join products c on (
       (parent.sku = 'PR-OLV-001' and c.sku in ('PR-OLV-001S','PR-OLV-001A','PR-OLV-001K','PR-OLV-001M'))
    or (parent.sku = 'PR-SAT-001' and c.sku in ('PR-SAT-001A','PR-SAT-001S'))
    or (parent.sku = 'PR-SAT-002' and c.sku in ('PR-SAT-002A','PR-SAT-002S','PR-SAT-002M','PR-SAT-002K'))
  )
 where parent.sku in ('PR-OLV-001','PR-SAT-001','PR-SAT-002')
on conflict (price_list_id, product_id) do nothing;

-- account_products: private-product visibility allow-lists carry over too.
insert into account_products (account_id, product_id)
select aprod.account_id, c.id
  from account_products aprod
  join products parent on parent.id = aprod.product_id
  join products c on (
       (parent.sku = 'PR-OLV-001' and c.sku in ('PR-OLV-001S','PR-OLV-001A','PR-OLV-001K','PR-OLV-001M'))
    or (parent.sku = 'PR-SAT-001' and c.sku in ('PR-SAT-001A','PR-SAT-001S'))
    or (parent.sku = 'PR-SAT-002' and c.sku in ('PR-SAT-002A','PR-SAT-002S','PR-SAT-002M','PR-SAT-002K'))
  )
 where parent.sku in ('PR-OLV-001','PR-SAT-001','PR-SAT-002')
on conflict (account_id, product_id) do nothing;

-- ─── 3. Retire parent SKUs ─────────────────────────────────────────────
-- Try DELETE first; fall back to soft-delete if FK ON DELETE RESTRICT
-- (order_items / standing_order_items) blocks.
do $$
begin
  begin
    delete from products where sku in ('PR-OLV-001','PR-SAT-001','PR-SAT-002');
  exception when foreign_key_violation then
    update products
       set is_active = false
     where sku in ('PR-OLV-001','PR-SAT-001','PR-SAT-002');
  end;
end $$;
