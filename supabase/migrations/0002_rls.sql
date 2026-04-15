-- Row Level Security policies
-- Roles are stored on profiles.role. Helper fn keeps policies terse.

alter table profiles        enable row level security;
alter table accounts        enable row level security;
alter table products        enable row level security;
alter table account_pricing enable row level security;
alter table orders          enable row level security;
alter table order_items     enable row level security;
alter table activities      enable row level security;
alter table qb_settings     enable row level security;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function my_account_id() returns uuid
language sql stable security definer set search_path = public as $$
  select account_id from profiles where id = auth.uid();
$$;

-- ----- profiles -----
create policy "profiles self read"   on profiles for select using (auth.uid() = id or is_admin());
create policy "profiles self update" on profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles admin all"   on profiles for all    using (is_admin()) with check (is_admin());
-- On signup, a trigger creates the profile row; allow self-insert as safety net.
create policy "profiles self insert" on profiles for insert with check (auth.uid() = id);

-- ----- accounts -----
create policy "accounts admin all" on accounts for all using (is_admin()) with check (is_admin());
create policy "accounts member read" on accounts for select using (id = my_account_id());

-- ----- products -----
-- Any authenticated user can read active products; writes are admin-only.
create policy "products read" on products for select using (
  is_active = true or is_admin()
);
create policy "products admin write" on products for all using (is_admin()) with check (is_admin());

-- ----- account_pricing -----
-- Only admin manages; buyers see their own account's pricing.
create policy "acct_pricing admin" on account_pricing for all using (is_admin()) with check (is_admin());
create policy "acct_pricing member read" on account_pricing for select using (account_id = my_account_id());

-- ----- orders -----
create policy "orders admin all" on orders for all using (is_admin()) with check (is_admin());
create policy "orders owner read" on orders for select using (profile_id = auth.uid() or account_id = my_account_id());
create policy "orders owner insert" on orders for insert with check (profile_id = auth.uid());
create policy "orders owner cancel" on orders for update
  using (profile_id = auth.uid() and status in ('pending','confirmed'))
  with check (profile_id = auth.uid());

-- ----- order_items -----
create policy "order_items admin all" on order_items for all using (is_admin()) with check (is_admin());
create policy "order_items owner read" on order_items for select using (
  exists (select 1 from orders o where o.id = order_id and (o.profile_id = auth.uid() or o.account_id = my_account_id()))
);
create policy "order_items owner insert" on order_items for insert with check (
  exists (select 1 from orders o where o.id = order_id and o.profile_id = auth.uid())
);

-- ----- activities -----
create policy "activities admin all" on activities for all using (is_admin()) with check (is_admin());

-- ----- qb_settings -----
create policy "qb_settings admin all" on qb_settings for all using (is_admin()) with check (is_admin());

-- =========================
-- AUTO-PROVISION PROFILE ON SIGNUP
-- =========================
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, role, first_name, last_name)
  values (
    new.id,
    coalesce((new.raw_user_meta_data->>'role')::role_t, 'dtc_customer'),
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name'
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
