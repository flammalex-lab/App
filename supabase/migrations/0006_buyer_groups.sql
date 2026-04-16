-- Add a buyer-facing "product group" dimension (Meat / Grocery / Produce /
-- Dairy / Cheese) on top of the existing granular category enum. Buyers see
-- products grouped by this; admin still edits products by their underlying
-- category. Also adds a `buyer_type` on accounts that auto-picks which groups
-- the buyer can see.
--
-- Safe to re-run.

alter table products add column if not exists product_group text;
create index if not exists idx_products_group on products(product_group);

alter table accounts add column if not exists buyer_type text default 'gm_restaurant';

-- ============ Backfill product_group from category + name hints ============
-- Meat: beef, pork, lamb
update products set product_group = 'meat'
  where category in ('beef','pork','lamb') and product_group is null;

-- Grocery: pantry + beverages
update products set product_group = 'grocery'
  where category in ('pantry','beverages') and product_group is null;

-- Produce
update products set product_group = 'produce'
  where category = 'produce' and product_group is null;

-- Dairy = eggs + dairy that aren't cheese
update products set product_group = 'dairy'
  where category = 'eggs' and product_group is null;

-- Cheese = items in dairy category that are cheeses (by name + producer hints)
update products set product_group = 'cheese'
  where category = 'dairy'
    and product_group is null
    and (
      name ilike '%cheese%' or
      name ilike '%cheddar%' or
      name ilike '%chevre%' or
      name ilike '%ricotta%' or
      name ilike '%feta%' or
      name ilike '%mozzarella%' or
      name ilike '%parm%' or
      name ilike '%brie%' or
      name ilike '%gouda%' or
      name ilike '%gruyere%' or
      name ilike '%raclette%' or
      name ilike '%blue yonder%' or
      name ilike '%sheldrake%' or
      name ilike '%shire%' or
      name ilike '%finger lakes gold%' or
      name ilike '%cayuga blue%' or
      name ilike '%silver lake%' or
      name ilike '%underpass%' or
      name ilike '%chamomilla%' or
      name ilike '%gitane%' or
      name ilike '%bel ceillo%' or
      name ilike '%red buddy%' or
      name ilike '%old man%' or
      name ilike '%farm house%' or
      name ilike '%cream cheese%' or
      name ilike '%crème cheese%' or
      producer = 'Muranda Cheese Company' or
      producer = 'Lively Run Dairy' or
      producer = 'East Hill Creamery'
    );

-- Everything else in dairy category → dairy group
update products set product_group = 'dairy'
  where category = 'dairy' and product_group is null;
