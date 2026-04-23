-- =========================
-- Seed default order-guide templates
-- =========================
-- Creates one template per product group and populates each with up to 15
-- items (is_active + available_b2b) matching that group/category. Gives
-- every new FLF install (and this dev project) a sensible starting point so
-- the Add Buyer dialog has something to pick from on day one.
--
-- Idempotent: each template is inserted only if a template with the same
-- name doesn't already exist, and items are only seeded when the template
-- has zero items so re-running won't clobber admin curation.

do $$
declare
  -- (template_name, buyer_type_hint, description, categories[], product_group)
  rec record;
  template_id uuid;
begin
  for rec in
    select * from (
      values
        ('Meat',              'meat_buyer',     'Starter beef, pork, and lamb selections',          array['beef','pork','lamb']::text[], 'meat'),
        ('Produce',           'produce_buyer',  'Seasonal produce basics',                          array['produce']::text[],            'produce'),
        ('Dairy & Cheese',    'dairy_buyer',    'Eggs, milk, cream, and cheese staples',            array['dairy','eggs']::text[],        'dairy'),
        ('Cheese',            'cheese_buyer',   'Cheese-focused list for specialty buyers',          array['dairy']::text[],               'cheese'),
        ('Grocery',           'grocery_buyer',  'Pantry + beverages starter kit',                    array['pantry','beverages']::text[], 'grocery')
    ) as x(name, buyer_type, description, cats, pg)
  loop
    -- Create the template row if it doesn't exist.
    insert into order_guide_templates (name, buyer_type, description)
    select rec.name, rec.buyer_type, rec.description
    where not exists (
      select 1 from order_guide_templates where name = rec.name
    );

    select id into template_id from order_guide_templates where name = rec.name limit 1;
    if template_id is null then continue; end if;

    -- Only seed items if this template is empty.
    if exists (select 1 from order_guide_template_items where template_id = template_id) then
      continue;
    end if;

    -- Top 15 candidates: active + B2B-available, matching by category OR
    -- product_group, ordered by sort_order (the same signal the catalog
    -- uses for "Best sellers"). Cascades to a less-strict filter if the
    -- strict one returns nothing.
    with picked as (
      select p.id, row_number() over (order by p.sort_order asc, p.name asc) - 1 as rn
      from products p
      where p.is_active = true
        and p.available_b2b = true
        and (p.category = any(rec.cats) or p.product_group = rec.pg)
      order by p.sort_order asc, p.name asc
      limit 15
    )
    insert into order_guide_template_items (template_id, product_id, sort_order)
    select template_id, id, rn from picked;

    -- If strict filter yielded nothing, try once more without the B2B flag.
    if not exists (select 1 from order_guide_template_items where template_id = template_id) then
      with picked_loose as (
        select p.id, row_number() over (order by p.sort_order asc, p.name asc) - 1 as rn
        from products p
        where p.is_active = true
          and (p.category = any(rec.cats) or p.product_group = rec.pg)
        order by p.sort_order asc, p.name asc
        limit 15
      )
      insert into order_guide_template_items (template_id, product_id, sort_order)
      select template_id, id, rn from picked_loose;
    end if;
  end loop;
end $$;
