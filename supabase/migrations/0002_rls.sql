-- Row Level Security policies
-- admin: full access. b2b_buyer: own account + own data. dtc_customer: own data only.

alter table accounts                 enable row level security;
alter table profiles                 enable row level security;
alter table products                 enable row level security;
alter table account_pricing          enable row level security;
alter table delivery_zones           enable row level security;
alter table pickup_locations         enable row level security;
alter table order_guides             enable row level security;
alter table order_guide_items        enable row level security;
alter table orders                   enable row level security;
alter table order_items              enable row level security;
alter table standing_orders          enable row level security;
alter table standing_order_items     enable row level security;
alter table activities               enable row level security;
alter table messages                 enable row level security;
alter table notifications            enable row level security;
alter table push_subscriptions       enable row level security;
alter table admin_impersonation_log  enable row level security;
alter table qb_settings              enable row level security;

-- Helper functions
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
create policy "profiles self insert" on profiles for insert with check (auth.uid() = id);

-- ----- accounts -----
create policy "accounts admin all"    on accounts for all using (is_admin()) with check (is_admin());
create policy "accounts member read"  on accounts for select using (id = my_account_id());

-- ----- products -----
create policy "products read active"   on products for select using (is_active = true or is_admin());
create policy "products admin write"   on products for all using (is_admin()) with check (is_admin());

-- ----- account_pricing -----
create policy "acct_pricing admin"       on account_pricing for all using (is_admin()) with check (is_admin());
create policy "acct_pricing member read" on account_pricing for select using (account_id = my_account_id());

-- ----- delivery_zones / pickup_locations -----
create policy "zones read"         on delivery_zones for select using (true);
create policy "zones admin write"  on delivery_zones for all using (is_admin()) with check (is_admin());
create policy "pickup read"        on pickup_locations for select using (active = true or is_admin());
create policy "pickup admin write" on pickup_locations for all using (is_admin()) with check (is_admin());

-- ----- order_guides -----
create policy "guides admin all"   on order_guides for all using (is_admin()) with check (is_admin());
create policy "guides self"        on order_guides for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "guide items admin all" on order_guide_items for all using (is_admin()) with check (is_admin());
create policy "guide items self"      on order_guide_items for all using (
  exists (select 1 from order_guides g where g.id = order_guide_id and g.profile_id = auth.uid())
) with check (
  exists (select 1 from order_guides g where g.id = order_guide_id and g.profile_id = auth.uid())
);

-- ----- orders -----
create policy "orders admin all" on orders for all using (is_admin()) with check (is_admin());
create policy "orders owner read" on orders for select using (profile_id = auth.uid() or account_id = my_account_id());
create policy "orders owner insert" on orders for insert with check (profile_id = auth.uid());
create policy "orders owner cancel" on orders for update
  using (profile_id = auth.uid() and status in ('draft','pending','confirmed'))
  with check (profile_id = auth.uid());

create policy "order_items admin all" on order_items for all using (is_admin()) with check (is_admin());
create policy "order_items owner read" on order_items for select using (
  exists (select 1 from orders o where o.id = order_id and (o.profile_id = auth.uid() or o.account_id = my_account_id()))
);
create policy "order_items owner insert" on order_items for insert with check (
  exists (select 1 from orders o where o.id = order_id and o.profile_id = auth.uid())
);

-- ----- standing orders -----
create policy "standing admin all" on standing_orders for all using (is_admin()) with check (is_admin());
create policy "standing owner"     on standing_orders for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "standing items admin" on standing_order_items for all using (is_admin()) with check (is_admin());
create policy "standing items owner" on standing_order_items for all using (
  exists (select 1 from standing_orders s where s.id = standing_order_id and s.profile_id = auth.uid())
) with check (
  exists (select 1 from standing_orders s where s.id = standing_order_id and s.profile_id = auth.uid())
);

-- ----- activities -----
create policy "activities admin all" on activities for all using (is_admin()) with check (is_admin());

-- ----- messages -----
create policy "messages admin all" on messages for all using (is_admin()) with check (is_admin());
create policy "messages account read" on messages for select using (account_id = my_account_id());
create policy "messages account insert" on messages for insert with check (
  account_id = my_account_id() and from_profile_id = auth.uid()
);

-- ----- notifications -----
create policy "notifs admin all" on notifications for all using (is_admin()) with check (is_admin());
create policy "notifs self read" on notifications for select using (profile_id = auth.uid());

-- ----- push_subscriptions -----
create policy "push self" on push_subscriptions for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "push admin read" on push_subscriptions for select using (is_admin());

-- ----- admin_impersonation_log -----
create policy "impersonation admin" on admin_impersonation_log for all using (is_admin()) with check (is_admin());

-- ----- qb_settings -----
create policy "qb_settings admin" on qb_settings for all using (is_admin()) with check (is_admin());

-- =========================
-- AUTO-PROVISION PROFILE ON SIGNUP
-- =========================
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, role, first_name, last_name, phone, email)
  values (
    new.id,
    coalesce((new.raw_user_meta_data->>'role')::role_t, 'dtc_customer'),
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    coalesce(new.phone, new.raw_user_meta_data->>'phone'),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =========================
-- AUTO-CREATE DEFAULT ORDER GUIDE for new b2b_buyer profiles
-- =========================
create or replace function ensure_default_order_guide() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'b2b_buyer' then
    insert into order_guides (profile_id, name, is_default)
    values (new.id, 'My order guide', true)
    on conflict do nothing;
  end if;
  return new;
end; $$;

drop trigger if exists t_profiles_default_guide on profiles;
create trigger t_profiles_default_guide
  after insert or update of role on profiles
  for each row execute function ensure_default_order_guide();
