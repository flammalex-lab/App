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
