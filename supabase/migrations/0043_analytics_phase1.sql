-- Phase 1 analytics. Three goals:
--   1) Snapshot product fields on order_items so historic reporting
--      doesn't shift when products are renamed/recategorized.
--   2) Stamp per-status timestamps on orders so cycle-time queries
--      are one-liners.
--   3) Add buyer_events for lightweight app-usage tracking, and
--      v_order_lines as the canonical flat row for CSV/dashboards.

-- 1. order_items snapshot columns ---------------------------------------------
alter table public.order_items
  add column if not exists product_name             text,
  add column if not exists product_sku              text,
  add column if not exists product_category         text,
  add column if not exists product_sub_category     text,
  add column if not exists product_producer         text,
  add column if not exists product_brand            text,
  add column if not exists product_pack_size        text,
  add column if not exists product_unit             text,
  add column if not exists wholesale_price_at_order numeric;

comment on column public.order_items.product_name is
  'Product name at time of order. Snapshotted so historic reports do not shift on product renames.';
comment on column public.order_items.product_category is
  'Product category at time of order. Snapshotted so historic reports do not shift on category re-org.';
comment on column public.order_items.wholesale_price_at_order is
  'products.wholesale_price at time of order. Used to compute historic gross margin.';

-- Backfill from current product rows. Safe to re-run — COALESCE keeps any
-- existing snapshot value untouched.
update public.order_items oi
set
  product_name             = coalesce(oi.product_name, p.name),
  product_sku              = coalesce(oi.product_sku, p.sku),
  product_category         = coalesce(oi.product_category, p.category::text),
  product_sub_category     = coalesce(oi.product_sub_category, p.sub_category),
  product_producer         = coalesce(oi.product_producer, p.producer),
  product_brand            = coalesce(oi.product_brand, p.brand::text),
  product_pack_size        = coalesce(oi.product_pack_size, p.pack_size),
  product_unit             = coalesce(oi.product_unit, p.unit),
  wholesale_price_at_order = coalesce(oi.wholesale_price_at_order, p.wholesale_price)
from public.products p
where oi.product_id = p.id;

-- Trigger fills any null snapshot from products at insert time. SECURITY
-- DEFINER so a buyer-session insert (which may not be able to SELECT every
-- product via RLS) still gets the snapshot stamped.
create or replace function public.order_items_fill_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare p record;
begin
  if new.product_id is null then return new; end if;
  if new.product_name is not null
     and new.product_category is not null
     and new.product_brand is not null
     and new.wholesale_price_at_order is not null then
    return new;
  end if;
  select name, sku, category::text as category, sub_category, producer,
         brand::text as brand, pack_size, unit, wholesale_price
    into p
    from public.products
   where id = new.product_id;
  if not found then return new; end if;
  new.product_name             := coalesce(new.product_name, p.name);
  new.product_sku              := coalesce(new.product_sku, p.sku);
  new.product_category         := coalesce(new.product_category, p.category);
  new.product_sub_category     := coalesce(new.product_sub_category, p.sub_category);
  new.product_producer         := coalesce(new.product_producer, p.producer);
  new.product_brand            := coalesce(new.product_brand, p.brand);
  new.product_pack_size        := coalesce(new.product_pack_size, p.pack_size);
  new.product_unit             := coalesce(new.product_unit, p.unit);
  new.wholesale_price_at_order := coalesce(new.wholesale_price_at_order, p.wholesale_price);
  return new;
end;
$$;

revoke all on function public.order_items_fill_snapshot() from public;

drop trigger if exists trg_order_items_fill_snapshot on public.order_items;
create trigger trg_order_items_fill_snapshot
  before insert on public.order_items
  for each row
  execute function public.order_items_fill_snapshot();

-- 2. orders per-status timestamps --------------------------------------------
alter table public.orders
  add column if not exists confirmed_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists cancelled_at timestamptz;

-- Best-effort backfill for the existing backlog: use updated_at as the
-- transition time. Precision doesn't matter for 13 orders.
update public.orders set confirmed_at = updated_at
  where status in ('confirmed','processing','ready','shipped','delivered')
    and confirmed_at is null;
update public.orders set delivered_at = updated_at
  where status = 'delivered' and delivered_at is null;
update public.orders set cancelled_at = updated_at
  where status = 'cancelled' and cancelled_at is null;

create or replace function public.orders_stamp_status_ts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = old.status then return new; end if;
  if new.status in ('confirmed','processing','ready','shipped','delivered')
     and new.confirmed_at is null then
    new.confirmed_at := now();
  end if;
  if new.status = 'delivered' and new.delivered_at is null then
    new.delivered_at := now();
  end if;
  if new.status = 'cancelled' and new.cancelled_at is null then
    new.cancelled_at := now();
  end if;
  return new;
end;
$$;

revoke all on function public.orders_stamp_status_ts() from public;

drop trigger if exists trg_orders_stamp_status_ts on public.orders;
create trigger trg_orders_stamp_status_ts
  before update on public.orders
  for each row
  execute function public.orders_stamp_status_ts();

-- 3. v_order_lines — canonical flat row per line ----------------------------
-- Use this view for daily-orders CSV, account purchase history, top-N
-- reports. Joins are pre-resolved; snapshot fields come from order_items
-- so the row is stable against later product edits.
drop view if exists public.v_order_lines;
create view public.v_order_lines
with (security_invoker = true) as
select
  o.id                              as order_id,
  o.order_number,
  o.order_type::text                as order_type,
  o.status::text                    as status,
  o.payment_method::text            as payment_method,
  o.payment_status::text            as payment_status,
  o.account_id,
  a.name                            as account_name,
  a.buyer_type                      as account_buyer_type,
  a.type::text                      as account_type,
  a.channel::text                   as account_channel,
  a.delivery_zone::text             as delivery_zone,
  o.profile_id,
  nullif(trim(coalesce(pr.first_name,'') || ' ' || coalesce(pr.last_name,'')), '')
                                    as buyer_name,
  pr.email                          as buyer_email,
  o.created_at                      as placed_at,
  ((o.created_at at time zone 'America/New_York'))::date as placed_date,
  o.requested_delivery_date,
  o.pickup_date,
  o.confirmed_at,
  o.delivered_at,
  o.cancelled_at,
  o.subtotal                        as order_subtotal,
  o.delivery_fee                    as order_delivery_fee,
  o.tax                             as order_tax,
  o.total                           as order_total,
  oi.id                             as line_id,
  oi.product_id,
  oi.product_sku,
  oi.product_name,
  oi.product_category,
  oi.product_sub_category,
  oi.product_producer,
  oi.product_brand,
  oi.product_pack_size,
  oi.product_unit,
  oi.pack_variant_key,
  oi.pack_variant_sku,
  oi.quantity,
  oi.unit_price,
  oi.line_total,
  oi.wholesale_price_at_order,
  (oi.unit_price - coalesce(oi.wholesale_price_at_order, 0)) * oi.quantity
                                    as line_gross_margin,
  oi.notes                          as line_notes,
  o.customer_notes
from public.orders o
join public.order_items oi on oi.order_id = o.id
left join public.accounts a on a.id = o.account_id
left join public.profiles pr on pr.id = o.profile_id;

grant select on public.v_order_lines to authenticated;
comment on view public.v_order_lines is
  'Flat per-line row for analytics/CSV. Snapshot fields from order_items keep historic categorization stable across product edits.';

-- 4. buyer_events — app-usage event stream ----------------------------------
-- Lightweight append-only log used to learn how buyers navigate the app:
-- catalog views, add_to_cart, search_performed, checkout_started, etc.
-- properties is jsonb so shape can evolve without DDL.
create table if not exists public.buyer_events (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid references public.profiles(id) on delete set null,
  account_id  uuid references public.accounts(id) on delete set null,
  event_name  text not null,
  properties  jsonb not null default '{}'::jsonb,
  path        text,
  session_id  text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

comment on table public.buyer_events is
  'Append-only app-usage event log. Written by /api/track (client) and trackServer (server). Read by admin analytics.';

create index if not exists idx_buyer_events_created
  on public.buyer_events(created_at desc);
create index if not exists idx_buyer_events_profile_created
  on public.buyer_events(profile_id, created_at desc)
  where profile_id is not null;
create index if not exists idx_buyer_events_account_created
  on public.buyer_events(account_id, created_at desc)
  where account_id is not null;
create index if not exists idx_buyer_events_name_created
  on public.buyer_events(event_name, created_at desc);

alter table public.buyer_events enable row level security;

-- Authenticated buyers can insert their own events (profile_id null OR
-- equal to their auth.uid()). The /api/track endpoint resolves the
-- profile_id server-side before insert, so this is a safety net.
drop policy if exists buyer_events_insert_self on public.buyer_events;
create policy buyer_events_insert_self on public.buyer_events
  for insert to authenticated
  with check (profile_id is null or profile_id = auth.uid());

-- Admin can read everything for dashboards.
drop policy if exists buyer_events_admin_read on public.buyer_events;
create policy buyer_events_admin_read on public.buyer_events
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles
       where id = auth.uid() and role = 'admin'
    )
  );

-- 5. Index supporting "orders delivering on date X" queries -----------------
create index if not exists idx_orders_requested_delivery
  on public.orders(requested_delivery_date)
  where requested_delivery_date is not null;
