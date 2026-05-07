-- =========================
-- Seed default order-guide templates
-- =========================
-- Creates one template per buyer-facing product group and populates each
-- with up to 15 items matching that group/category. Gives every new FLF
-- install (and this dev project) a sensible starting point so the Add
-- Buyer dialog has something to pick from on day one.
--
-- Dairy and Cheese are intentionally SEPARATE templates (not folded),
-- because they're curated differently — milk/eggs/butter vs wheels and
-- specialty cheeses.
--
-- Idempotent: each template is inserted only when missing, and items are
-- only seeded when the template is empty. Safe to re-run.

do $$
declare
  rec record;
  v_template_id uuid;
  v_has_items boolean;
begin
  for rec in
    -- (name, buyer_type hint, description, category_matches, product_group,
    --  exclude_cheese_group) — when exclude_cheese_group is true we skip
    --  products tagged product_group='cheese' even if they're category=dairy.
    select * from (
      values
        ('Meat',    'meat_buyer',    'Starter beef, pork, and lamb selections',    array['beef','pork','lamb']::text[], 'meat'::text,    false),
        ('Produce', 'produce_buyer', 'Seasonal produce basics',                    array['produce']::text[],            'produce'::text, false),
        ('Dairy',   'dairy_buyer',   'Eggs, milk, butter, yogurt (not cheese)',    array['dairy','eggs']::text[],       'dairy'::text,   true),
        ('Cheese',  'cheese_buyer',  'Cheese-focused list for specialty buyers',   array[]::text[],                     'cheese'::text,  false),
        ('Grocery', 'grocery_buyer', 'Pantry + beverages starter kit',             array['pantry','beverages']::text[], 'grocery'::text, false)
    ) as x(tname, btype, tdesc, cats, pg, exclude_cheese)
  loop
    -- Create the template row if it doesn't exist.
    insert into order_guide_templates (name, buyer_type, description)
    select rec.tname, rec.btype, rec.tdesc
    where not exists (
      select 1 from order_guide_templates t where t.name = rec.tname
    );

    select t.id into v_template_id from order_guide_templates t where t.name = rec.tname limit 1;
    if v_template_id is null then continue; end if;

    -- Only seed if empty.
    select exists (
      select 1 from order_guide_template_items i where i.template_id = v_template_id
    ) into v_has_items;
    if v_has_items then continue; end if;

    -- Strict pass: is_active + available_b2b. Cascades to loose below.
    with picked as (
      select p.id, row_number() over (order by p.sort_order asc, p.name asc) - 1 as rn
      from products p
      where p.is_active = true
        and p.available_b2b = true
        and (
          (array_length(rec.cats, 1) is not null and p.category::text = any(rec.cats))
          or p.product_group = rec.pg
        )
        and (not rec.exclude_cheese or p.product_group is distinct from 'cheese')
      order by p.sort_order asc, p.name asc
      limit 15
    )
    insert into order_guide_template_items (template_id, product_id, sort_order)
    select v_template_id, id, rn from picked;

    -- Loose pass if strict yielded zero (drops available_b2b).
    select exists (
      select 1 from order_guide_template_items i where i.template_id = v_template_id
    ) into v_has_items;
    if not v_has_items then
      with picked_loose as (
        select p.id, row_number() over (order by p.sort_order asc, p.name asc) - 1 as rn
        from products p
        where p.is_active = true
          and (
            (array_length(rec.cats, 1) is not null and p.category::text = any(rec.cats))
            or p.product_group = rec.pg
          )
          and (not rec.exclude_cheese or p.product_group is distinct from 'cheese')
        order by p.sort_order asc, p.name asc
        limit 15
      )
      insert into order_guide_template_items (template_id, product_id, sort_order)
      select v_template_id, id, rn from picked_loose;
    end if;
  end loop;
end $$;
