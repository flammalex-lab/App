-- Security hardening: close several issues from the full-project audit.
--
-- 1) Privilege escalation — handle_new_user() previously read role from
--    raw_user_meta_data, which is client-controllable on supabase.auth.signUp.
--    Anyone could sign up as 'admin'. Force every new profile to dtc_customer.
--
-- 2) orders.account_id — was nullable with on delete set null, leaving
--    orphaned orders invisible to RLS. Backfill any nulls to a sentinel
--    'unassigned' account so we can apply NOT NULL safely.
--
-- 3) standing_orders RLS — was profile_id-only, ignoring multi-account
--    membership (introduced in 0007). Re-scope to honor profile_accounts.

-- ---- 1) handle_new_user: never trust client-supplied role ----
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Role is *never* read from raw_user_meta_data. New users default to
  -- dtc_customer; admins/reps must promote via direct profiles.update or
  -- the admin Quick Add Buyer flow.
  insert into profiles (id, role, first_name, last_name, phone, email)
  values (
    new.id,
    'dtc_customer',
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    coalesce(new.phone, new.raw_user_meta_data->>'phone'),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end; $$;

-- ---- 2) orders.account_id NOT NULL ----
do $$
declare
  unassigned_id uuid;
begin
  -- Provision a sentinel "Unassigned" account if any orphan orders exist.
  if exists (select 1 from orders where account_id is null) then
    select id into unassigned_id
      from accounts
     where name = 'Unassigned (orphaned orders)'
     limit 1;
    if unassigned_id is null then
      insert into accounts (name, type, channel, status, notes)
      values ('Unassigned (orphaned orders)', 'other', 'foodservice', 'inactive',
              'Auto-created by 0020_security_hardening to backfill orders.account_id NOT NULL')
      returning id into unassigned_id;
    end if;
    update orders set account_id = unassigned_id where account_id is null;
  end if;
end $$;

alter table orders alter column account_id set not null;

-- ---- 3) standing_orders RLS — honor multi-account membership ----
drop policy if exists "standing owner" on standing_orders;
create policy "standing owner read" on standing_orders for select using (
  profile_id = auth.uid()
  or account_id = my_account_id()
  or exists (
    select 1 from profile_accounts pa
     where pa.profile_id = auth.uid()
       and pa.account_id = standing_orders.account_id
  )
);
create policy "standing owner write" on standing_orders for all using (
  profile_id = auth.uid()
  and (
    account_id = my_account_id()
    or exists (
      select 1 from profile_accounts pa
       where pa.profile_id = auth.uid()
         and pa.account_id = standing_orders.account_id
    )
  )
) with check (
  profile_id = auth.uid()
  and (
    account_id = my_account_id()
    or exists (
      select 1 from profile_accounts pa
       where pa.profile_id = auth.uid()
         and pa.account_id = standing_orders.account_id
    )
  )
);

-- Items policy uses the parent — already enforced via existence-of standing_orders
-- with profile_id = auth.uid(). No change needed for standing_order_items.

-- ---- 4) payment_status_t: extend with stripe lifecycle states ----
-- The original enum (unpaid/partial/paid) couldn't represent failed cards,
-- refunds, or disputes — the webhook would silently leave the order in
-- "paid" after a chargeback. ALTER TYPE … ADD VALUE is non-transactional;
-- run this migration outside any wrapping transaction.
do $$ begin
  if not exists (select 1 from pg_enum where enumtypid = 'payment_status_t'::regtype and enumlabel = 'failed') then
    alter type payment_status_t add value 'failed';
  end if;
  if not exists (select 1 from pg_enum where enumtypid = 'payment_status_t'::regtype and enumlabel = 'refunded') then
    alter type payment_status_t add value 'refunded';
  end if;
  if not exists (select 1 from pg_enum where enumtypid = 'payment_status_t'::regtype and enumlabel = 'partially_refunded') then
    alter type payment_status_t add value 'partially_refunded';
  end if;
  if not exists (select 1 from pg_enum where enumtypid = 'payment_status_t'::regtype and enumlabel = 'disputed') then
    alter type payment_status_t add value 'disputed';
  end if;
end $$;

-- ---- 5) latest_messages_per_account: DB-side dedupe for admin Messages
-- The admin page used to pull the latest 500 messages and JS-dedupe by
-- account_id. That misses long-tail conversations once the table grows
-- past ~200 active accounts. DISTINCT ON does this in one ordered scan.
create or replace function latest_messages_per_account(p_limit int default 50, p_offset int default 0)
returns table (
  account_id uuid,
  account_name text,
  body text,
  direction text,
  created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  with latest as (
    select distinct on (m.account_id)
      m.account_id, m.body, m.direction, m.created_at
    from messages m
    where m.account_id is not null
    order by m.account_id, m.created_at desc
  )
  select l.account_id, a.name as account_name, l.body, l.direction::text, l.created_at
  from latest l
  join accounts a on a.id = l.account_id
  where (select is_admin())
  order by l.created_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
$$;

-- ---- 6) Scrub the personal Venmo handle out of qb_settings ----
-- Migration 0001 hardcoded '@alex_flamm' as the venmo_handle seed value.
-- Personal identifier in source control; scrub to a placeholder so the
-- admin Settings UI is the single source of truth.
update qb_settings
   set value = ''
 where key = 'venmo_handle'
   and value = '@alex_flamm';

-- ---- 7) sms_triage: capture inbound SMS from unknown phones ----
-- Webhook used to console.warn and drop these. Now we stash them so a
-- rep can see "someone you don't have on file just texted us" and
-- attach the message to a profile manually.
create table if not exists sms_triage (
  id uuid primary key default gen_random_uuid(),
  from_phone text not null,
  body text not null,
  sms_sid text,
  received_at timestamptz not null default now(),
  resolved boolean not null default false,
  resolved_by_profile_id uuid references profiles(id) on delete set null,
  resolved_at timestamptz
);
alter table sms_triage enable row level security;
create policy "sms_triage admin all" on sms_triage for all using (is_admin()) with check (is_admin());
create index if not exists idx_sms_triage_unresolved on sms_triage(received_at desc) where resolved = false;

-- ---- 8) stripe_events: idempotency table for webhook dedupe ----
-- Stripe retries on any 5xx. Insert event.id on receipt; ON CONFLICT do
-- nothing tells the handler "already processed this event" so side
-- effects (status flips, SMS, refunds) only ever happen once.
create table if not exists stripe_events (
  id text primary key,                       -- evt_…
  type text not null,
  received_at timestamptz not null default now(),
  order_id uuid references orders(id) on delete set null
);
alter table stripe_events enable row level security;
create policy "stripe_events admin read" on stripe_events for select using (is_admin());
-- No insert/update policy — only the service-role client (webhook) writes.

