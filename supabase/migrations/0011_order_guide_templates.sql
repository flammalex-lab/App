-- =========================
-- Order-guide templates (admin-curated starter lists)
-- =========================
-- Buyers no longer get a dynamic top-15 seed on creation. Instead, the admin
-- curates named templates ("Produce", "Lincoln Market Dairy", etc.) and the
-- Add Buyer flow picks one or more. Buyers' personal guides are then seeded
-- by unioning + deduping items from the selected templates.
--
-- This migration introduces:
--   order_guide_templates       — named curated starter lists (global)
--   order_guide_template_items  — products + par levels per template
--   order_guide_seed_sources    — junction: which templates seeded a guide
--   order_guide_item_removals   — tombstones: items explicitly removed by the
--                                  buyer / admin, so sync-from-template never
--                                  re-adds them
--
-- Tombstone semantics:
--   - Removing an item from a buyer's guide inserts a tombstone.
--   - Adding an item back (star, admin editor) deletes the tombstone so the
--     item can participate in future syncs normally.

create table if not exists order_guide_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  buyer_type text,                  -- optional hint, surfaces as a group in the picker
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_guide_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references order_guide_templates(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  suggested_qty numeric,
  par_levels jsonb,
  sort_order int not null default 0,
  unique (template_id, product_id)
);

-- Junction: one guide may have been seeded from multiple templates (combined
-- seed flow for GM accounts). Useful for the "sync new items from template"
-- button and for drift calculation.
create table if not exists order_guide_seed_sources (
  guide_id    uuid not null references order_guides(id) on delete cascade,
  template_id uuid not null references order_guide_templates(id) on delete cascade,
  primary key (guide_id, template_id)
);

-- Tombstones: product explicitly removed from a buyer's guide. Suppresses
-- re-adds on future template syncs.
create table if not exists order_guide_item_removals (
  profile_id uuid not null references profiles(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  removed_at timestamptz not null default now(),
  primary key (profile_id, product_id)
);

-- Trigger: keep updated_at current on order_guide_templates
create trigger t_order_guide_templates_updated
  before update on order_guide_templates
  for each row execute function set_updated_at();

-- =========================
-- RLS
-- =========================
alter table order_guide_templates       enable row level security;
alter table order_guide_template_items  enable row level security;
alter table order_guide_seed_sources    enable row level security;
alter table order_guide_item_removals   enable row level security;

-- Only admins manage templates. Service role bypasses RLS for server code
-- paths that need to copy template items into a buyer's guide.
create policy "templates admin"       on order_guide_templates      for all using (is_admin()) with check (is_admin());
create policy "template items admin"  on order_guide_template_items for all using (is_admin()) with check (is_admin());

-- Seed sources: admin writes, buyer can see their own guide's sources.
create policy "seed sources admin"    on order_guide_seed_sources   for all using (is_admin()) with check (is_admin());
create policy "seed sources self"     on order_guide_seed_sources   for select using (
  exists (select 1 from order_guides g where g.id = guide_id and g.profile_id = auth.uid())
);

-- Removals: admin has full access; buyer can CRUD their own tombstones so
-- an "unstar" UI in the buyer app can record removals without hitting an
-- API round-trip through the service role.
create policy "removals admin"        on order_guide_item_removals  for all using (is_admin()) with check (is_admin());
create policy "removals self"         on order_guide_item_removals  for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
