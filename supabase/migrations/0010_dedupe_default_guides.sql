-- =========================
-- Dedupe duplicate default order guides
-- =========================
-- A bug in the get-or-create code let buyers accumulate multiple rows with
-- is_default=true (seen in prod: 8 defaults for one dairy buyer). Writes
-- scattered randomly across duplicates, reads landed on a different one,
-- the UI always looked empty.
--
-- Strategy:
--   (1) Pick a winning guide per buyer = the one with the most items,
--       oldest created_at wins ties.
--   (2) Move items from losing duplicates into the winner (skipping any
--       product already in the winner to respect the unique constraint).
--   (3) Delete the losing guides' remaining items, then demote the losers
--       to is_default=false.
--   (4) Add a unique partial index so concurrent "create default" races
--       fail fast (the calling code already handles that).

-- (1)+(2) Copy items from losers into the canonical winner.
insert into order_guide_items (order_guide_id, product_id, suggested_qty, par_levels, sort_order)
select w.id, i.product_id, i.suggested_qty, i.par_levels, i.sort_order
from order_guide_items i
join order_guides og on og.id = i.order_guide_id and og.is_default = true
join lateral (
  select og2.id
  from order_guides og2
  where og2.profile_id = og.profile_id and og2.is_default = true
  order by
    (select count(*) from order_guide_items x where x.order_guide_id = og2.id) desc,
    og2.created_at asc
  limit 1
) w on true
where og.id <> w.id
  and not exists (
    select 1 from order_guide_items existing
    where existing.order_guide_id = w.id
      and existing.product_id = i.product_id
  );

-- (3a) Delete items from losing guides so we can demote them cleanly.
with winners as (
  select distinct on (profile_id) id
  from order_guides
  where is_default = true
  order by profile_id,
           (select count(*) from order_guide_items i where i.order_guide_id = order_guides.id) desc,
           created_at asc
)
delete from order_guide_items
where order_guide_id in (
  select id from order_guides
  where is_default = true and id not in (select id from winners)
);

-- (3b) Demote the losers.
with winners as (
  select distinct on (profile_id) id
  from order_guides
  where is_default = true
  order by profile_id,
           (select count(*) from order_guide_items i where i.order_guide_id = order_guides.id) desc,
           created_at asc
)
update order_guides
set is_default = false
where is_default = true
  and id not in (select id from winners);

-- (4) Prevent future dupes at the DB level.
create unique index if not exists order_guides_one_default_per_profile
  on order_guides (profile_id)
  where is_default = true;
