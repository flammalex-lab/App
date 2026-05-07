-- =========================
-- Curate the Produce and Dairy default templates
-- =========================
-- Alex curated the defaults to specific producers:
--   Produce → Olivia's, Satur Farms, Barrel Brine only
--   Dairy   → Meadow Creek (eggs), Ithaca (milk), Five Acre Farms only
--
-- This migration:
--   (1) wipes Produce and Dairy template_items and re-seeds them from
--       the producer-filtered product set (case-insensitive ILIKE so
--       "Olivia's Organics" and "Satur Farms Inc." both match).
--   (2) adds any newly-in-template items to existing buyers' default
--       guides, if that guide was seeded from these templates, with
--       the standard sync semantics: items the buyer has explicitly
--       removed (tombstones in order_guide_item_removals) are skipped,
--       and items already in the guide aren't duplicated.
--
-- NOTE: existing buyers' guides keep their old seeded items. This is
-- conservative on purpose — we can't distinguish between "seeded and
-- kept" vs "buyer actively wanted this." To fully reset a buyer to the
-- new template, detach and re-attach the template from the Edit Buyer
-- page (or a future "wipe and re-seed" button).

do $$
declare
  produce_id uuid;
  dairy_id   uuid;
begin
  select id into produce_id from order_guide_templates where name = 'Produce' limit 1;
  select id into dairy_id   from order_guide_templates where name = 'Dairy'   limit 1;

  -- (1a) Re-curate Produce
  if produce_id is not null then
    delete from order_guide_template_items where template_id = produce_id;
    insert into order_guide_template_items (template_id, product_id, sort_order)
    select
      produce_id,
      p.id,
      (row_number() over (order by p.producer asc, p.name asc) - 1)::int
    from products p
    where p.is_active = true
      and (p.category::text = 'produce' or p.product_group = 'produce')
      and (
        p.producer ilike '%olivia%'
        or p.producer ilike '%satur%'
        or p.producer ilike '%barrel brine%'
      );
    update order_guide_templates
    set description = 'Curated: Olivia''s, Satur Farms, Barrel Brine',
        updated_at  = now()
    where id = produce_id;
  end if;

  -- (1b) Re-curate Dairy
  if dairy_id is not null then
    delete from order_guide_template_items where template_id = dairy_id;
    insert into order_guide_template_items (template_id, product_id, sort_order)
    select
      dairy_id,
      p.id,
      (row_number() over (order by p.producer asc, p.name asc) - 1)::int
    from products p
    where p.is_active = true
      and (p.category::text in ('dairy', 'eggs') or p.product_group = 'dairy')
      and (
        p.producer ilike '%meadow creek%'
        or p.producer ilike '%ithaca%'
        or p.producer ilike '%five acre%'
      );
    update order_guide_templates
    set description = 'Curated: Meadow Creek eggs, Ithaca milk, Five Acre Farms',
        updated_at  = now()
    where id = dairy_id;
  end if;
end $$;

-- (2) Sync existing buyers whose default guide was seeded from these templates.
-- Add missing items. Respect tombstones. Never duplicate.
insert into order_guide_items (order_guide_id, product_id, suggested_qty, par_levels, sort_order)
select
  g.id,
  ti.product_id,
  ti.suggested_qty,
  ti.par_levels,
  ti.sort_order + 1000
from order_guide_seed_sources seed
join order_guides g             on g.id = seed.guide_id
join order_guide_templates t    on t.id = seed.template_id
join order_guide_template_items ti on ti.template_id = t.id
where t.name in ('Produce', 'Dairy')
  and not exists (
    select 1 from order_guide_items gi
    where gi.order_guide_id = g.id and gi.product_id = ti.product_id
  )
  and not exists (
    select 1 from order_guide_item_removals r
    where r.profile_id = g.profile_id and r.product_id = ti.product_id
  );
