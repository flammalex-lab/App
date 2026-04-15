-- Fingerlakes Farms Portal — core schema
-- Choco/Pepper-style: order-guide-first, phone OTP, standing orders, SMS bridge.

create extension if not exists "pgcrypto";

-- =========================
-- ENUMS
-- =========================
create type role_t            as enum ('admin', 'b2b_buyer', 'dtc_customer');
create type account_type_t    as enum ('restaurant', 'grocery', 'institutional', 'country_club', 'distributor', 'other');
create type channel_t         as enum ('foodservice', 'retail', 'institutional');
create type pricing_tier_t    as enum ('standard', 'volume', 'custom');
create type account_status_t  as enum ('prospect', 'active', 'inactive', 'churned');
create type delivery_zone_t   as enum ('finger_lakes', 'nyc_metro', 'hudson_valley', 'long_island', 'nj_pa_ct');
create type brand_t           as enum ('grasslands', 'meadow_creek', 'fingerlakes_farms');
create type category_t        as enum ('beef', 'pork', 'eggs', 'dairy', 'produce');
create type cut_type_t        as enum ('primal', 'sub_primal', 'retail_cut', 'value_added', 'whole');
create type order_type_t      as enum ('b2b', 'dtc');
create type order_status_t    as enum ('draft', 'pending', 'confirmed', 'processing', 'ready', 'shipped', 'delivered', 'cancelled');
create type payment_method_t  as enum ('invoice', 'stripe', 'venmo', 'cash');
create type payment_status_t  as enum ('unpaid', 'partial', 'paid');
create type activity_type_t   as enum ('call', 'email', 'visit', 'sample_drop', 'order', 'note', 'follow_up');
create type standing_freq_t   as enum ('weekly', 'biweekly');
create type msg_channel_t     as enum ('app', 'sms', 'email');
create type msg_direction_t   as enum ('outbound', 'inbound');
create type notif_type_t      as enum ('order_confirmation', 'order_status', 'cutoff_warning', 'reorder_prompt',
                                       'standing_order_ready', 'delivery_reminder', 'message', 'welcome');
create type notif_channel_t   as enum ('sms', 'push', 'email');
create type notif_status_t    as enum ('pending', 'sent', 'failed', 'skipped');

-- =========================
-- ACCOUNTS
-- =========================
create table accounts (
  id uuid primary key default gen_random_uuid(),
  parent_account_id uuid references accounts(id) on delete set null,
  name text not null,
  type account_type_t not null,
  channel channel_t not null,
  pricing_tier pricing_tier_t not null default 'standard',
  status account_status_t not null default 'prospect',
  -- buying profile: which categories this account is allowed to see / order
  enabled_categories category_t[] not null default '{beef,pork,eggs,dairy,produce}',
  -- contact
  primary_contact_name text,
  primary_contact_email text,
  primary_contact_phone text,
  -- address
  address_line1 text,
  address_line2 text,
  city text,
  state text default 'NY',
  zip text,
  -- delivery
  delivery_zone delivery_zone_t,
  delivery_day text,
  delivery_notes text,
  order_minimum numeric,  -- overrides zone minimum when set
  -- sales
  salesperson_id uuid,    -- FK added after profiles exists
  source text,
  notes text,
  -- quickbooks
  qb_customer_name text,
  qb_terms text,          -- 'Net 30', 'Net 15', 'Due on Receipt' — overrides default
  qb_synced_at timestamptz,
  -- audit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- PROFILES (extends auth.users)
-- =========================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role role_t not null default 'dtc_customer',
  first_name text,
  last_name text,
  phone text,
  email text,
  account_id uuid references accounts(id) on delete set null,
  -- convenience
  title text,          -- "Chef", "Buyer", "Manager"
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- now that profiles exists, add the salesperson FK
alter table accounts
  add constraint accounts_salesperson_fk
  foreign key (salesperson_id) references profiles(id) on delete set null;

-- =========================
-- PRODUCTS
-- =========================
create table products (
  id uuid primary key default gen_random_uuid(),
  sku text unique,
  brand brand_t not null,
  category category_t not null,
  name text not null,
  description text,
  primal text,
  sub_primal text,
  cut_type cut_type_t,
  unit text not null,           -- 'lb', 'dozen', 'case', 'each'
  pack_size text,
  case_pack text,
  avg_weight_lbs numeric,       -- informational
  wholesale_price numeric,
  retail_price numeric,
  available_b2b boolean not null default true,
  available_dtc boolean not null default false,
  in_season boolean not null default true,
  available_this_week boolean not null default true,  -- weekly toggle
  is_active boolean not null default true,
  image_url text,
  -- QB override (nullable → fall back to category mapping in qb_settings)
  qb_income_account text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- ACCOUNT-SPECIFIC PRICING
-- =========================
create table account_pricing (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  custom_price numeric not null,
  effective_date date not null default current_date,
  expiry_date date,
  unique (account_id, product_id)
);

-- =========================
-- DELIVERY ZONES config
-- =========================
create table delivery_zones (
  zone delivery_zone_t primary key,
  label text not null,
  order_minimum numeric not null default 0,
  cutoff_hours_before_delivery int not null default 24,
  delivery_days text[] not null default '{}',  -- e.g. '{Tuesday,Friday}'
  active boolean not null default true
);

-- =========================
-- PICKUP LOCATIONS (DTC)
-- =========================
create table pickup_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  pickup_days text[] not null default '{}',
  pickup_window text,
  active boolean not null default true,
  sort_order int not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

-- =========================
-- ORDER GUIDES (per buyer)
-- =========================
create table order_guides (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  name text not null default 'My order guide',
  is_default boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table order_guide_items (
  id uuid primary key default gen_random_uuid(),
  order_guide_id uuid not null references order_guides(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  suggested_qty numeric,
  par_levels jsonb,              -- {"mon":4,"tue":6,"fri":12}
  sort_order int not null default 0,
  unique (order_guide_id, product_id)
);

-- =========================
-- ORDERS
-- =========================
create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  order_type order_type_t not null,
  status order_status_t not null default 'pending',
  -- who
  profile_id uuid not null references profiles(id) on delete restrict,
  account_id uuid references accounts(id) on delete set null,
  placed_by_id uuid references profiles(id) on delete set null,  -- rep who submitted, null if buyer self-submitted
  standing_order_id uuid,   -- FK added below
  -- when
  requested_delivery_date date,
  pickup_date date,
  pickup_window text,
  pickup_location_id uuid references pickup_locations(id) on delete set null,
  -- financials
  subtotal numeric not null default 0,
  tax numeric not null default 0,
  delivery_fee numeric not null default 0,
  total numeric not null default 0,
  -- payment
  payment_method payment_method_t not null default 'invoice',
  payment_status payment_status_t not null default 'unpaid',
  stripe_payment_id text,
  -- notes
  customer_notes text,
  internal_notes text,
  -- quickbooks
  qb_exported boolean not null default false,
  qb_exported_at timestamptz,
  qb_invoice_ref text,
  -- audit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  quantity numeric not null,
  unit_price numeric not null,
  line_total numeric not null,
  notes text
);

-- =========================
-- STANDING ORDERS (recurring)
-- =========================
create table standing_orders (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  name text default 'Standing order',
  frequency standing_freq_t not null default 'weekly',
  days_of_week text[] not null default '{}',
  active boolean not null default true,
  pause_until date,
  last_run_date date,
  next_run_date date,
  require_confirmation boolean not null default true,  -- SMS confirmation before submitting
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table standing_order_items (
  id uuid primary key default gen_random_uuid(),
  standing_order_id uuid not null references standing_orders(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  quantity numeric not null,
  notes text
);

alter table orders
  add constraint orders_standing_fk
  foreign key (standing_order_id) references standing_orders(id) on delete set null;

-- =========================
-- ACTIVITIES (CRM-lite)
-- =========================
create table activities (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  profile_id uuid references profiles(id) on delete set null,
  type activity_type_t not null,
  subject text,
  body text,
  follow_up_date date,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

-- =========================
-- MESSAGES (buyer ↔ rep thread, SMS-bridged)
-- =========================
create table messages (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  from_profile_id uuid references profiles(id) on delete set null,
  to_profile_id uuid references profiles(id) on delete set null,
  body text not null,
  channel msg_channel_t not null default 'app',
  direction msg_direction_t not null default 'outbound',
  sms_sid text,
  from_phone text,
  to_phone text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_messages_account on messages(account_id, created_at desc);
create index idx_messages_unread on messages(to_profile_id) where read_at is null;

-- =========================
-- NOTIFICATIONS (outbound comms queue)
-- =========================
create table notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  account_id uuid references accounts(id) on delete cascade,
  type notif_type_t not null,
  channel notif_channel_t not null,
  subject text,
  body text,
  to_address text,   -- phone, email, or push token
  related_order_id uuid references orders(id) on delete set null,
  related_standing_order_id uuid references standing_orders(id) on delete set null,
  status notif_status_t not null default 'pending',
  error text,
  metadata jsonb,
  scheduled_for timestamptz default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_notifications_pending on notifications(status, scheduled_for) where status = 'pending';

-- =========================
-- PUSH SUBSCRIPTIONS
-- =========================
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (profile_id, endpoint)
);

-- =========================
-- ADMIN IMPERSONATION LOG
-- =========================
create table admin_impersonation_log (
  id uuid primary key default gen_random_uuid(),
  admin_profile_id uuid not null references profiles(id) on delete cascade,
  target_profile_id uuid not null references profiles(id) on delete cascade,
  reason text,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

-- =========================
-- QB SETTINGS (key/value)
-- =========================
create table qb_settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value text not null,
  updated_at timestamptz not null default now()
);

insert into qb_settings (key, value) values
  ('income_account.beef',    'Beef Sales'),
  ('income_account.pork',    'Pork Sales'),
  ('income_account.eggs',    'Egg Sales'),
  ('income_account.dairy',   'Dairy Sales'),
  ('income_account.produce', 'Produce Sales'),
  ('default_terms',          'Net 30'),
  ('ar_account',             'Accounts Receivable'),
  ('sms_daily_cap',          '200'),
  ('venmo_handle',           '@alex_flamm')
on conflict (key) do nothing;

-- =========================
-- INDEXES
-- =========================
create index idx_products_brand    on products(brand);
create index idx_products_category on products(category);
create index idx_products_active   on products(is_active) where is_active = true;
create index idx_orders_account    on orders(account_id);
create index idx_orders_profile    on orders(profile_id);
create index idx_orders_status     on orders(status);
create index idx_orders_created    on orders(created_at desc);
create index idx_orders_qb_export  on orders(qb_exported) where qb_exported = false;
create index idx_activities_account on activities(account_id);
create index idx_activities_follow_up on activities(follow_up_date) where completed = false;
create index idx_accounts_status   on accounts(status);
create index idx_accounts_parent   on accounts(parent_account_id);
create index idx_accounts_salesperson on accounts(salesperson_id);
create index idx_standing_orders_next on standing_orders(next_run_date) where active = true;
create index idx_order_guides_profile on order_guides(profile_id);
create index idx_order_guide_items_guide on order_guide_items(order_guide_id, sort_order);

-- =========================
-- TRIGGERS
-- =========================
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger t_accounts_updated        before update on accounts        for each row execute function set_updated_at();
create trigger t_profiles_updated        before update on profiles        for each row execute function set_updated_at();
create trigger t_products_updated        before update on products        for each row execute function set_updated_at();
create trigger t_orders_updated          before update on orders          for each row execute function set_updated_at();
create trigger t_order_guides_updated    before update on order_guides    for each row execute function set_updated_at();
create trigger t_standing_orders_updated before update on standing_orders for each row execute function set_updated_at();

-- =========================
-- ORDER NUMBER GENERATOR (FLF-YYYY-NNNN)
-- =========================
create sequence if not exists order_number_seq;

create or replace function generate_order_number() returns text as $$
declare n int;
begin
  n := nextval('order_number_seq');
  return 'FLF-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 4, '0');
end;
$$ language plpgsql;
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
-- Seed: delivery zones + pickup locations

insert into delivery_zones (zone, label, order_minimum, cutoff_hours_before_delivery, delivery_days) values
  ('finger_lakes',  'Finger Lakes',    150, 24, '{Tuesday,Friday}'),
  ('nyc_metro',     'NYC Metro',       300, 48, '{Tuesday,Friday}'),
  ('hudson_valley', 'Hudson Valley',   250, 24, '{Wednesday}'),
  ('long_island',   'Long Island',     300, 48, '{Thursday}'),
  ('nj_pa_ct',      'NJ / PA / CT',    400, 72, '{Wednesday}')
on conflict (zone) do update set
  label = excluded.label,
  order_minimum = excluded.order_minimum,
  cutoff_hours_before_delivery = excluded.cutoff_hours_before_delivery,
  delivery_days = excluded.delivery_days;

insert into pickup_locations (name, address, pickup_days, pickup_window, sort_order) values
  ('Fingerlakes Farms — Seneca Falls', '2345 State Route 414, Seneca Falls, NY', '{Saturday}',  '10am-2pm', 10),
  ('Union Square Greenmarket',         'E 17th St & Union Sq W, New York, NY',   '{Wednesday,Friday,Saturday}', '9am-4pm', 20),
  ('McCarren Park Greenmarket',        'Lorimer St & Driggs Ave, Brooklyn, NY',  '{Saturday}',  '8am-2pm', 30)
on conflict do nothing;
-- Product seed — broad product guide across beef, pork, eggs, dairy, produce
-- (no chicken; suspended March 2026)

insert into products
  (sku, brand, category, name, description, primal, sub_primal, cut_type, unit, pack_size, case_pack, avg_weight_lbs,
   wholesale_price, retail_price, available_b2b, available_dtc, sort_order)
values
  -- GRASSLANDS BEEF (B2B primals & sub-primals)
  ('BF-STR-001','grasslands','beef','Strip Loin',         'Whole NY strip loin, trim to spec',  'Loin',          'Strip Loin',   'sub_primal','lb','2x14lb avg','2/case',14.0, 14.50, null, true, false, 10),
  ('BF-TOP-001','grasslands','beef','Top Sirloin',        'Center-cut top sirloin',             'Loin',          'Top Sirloin',  'sub_primal','lb','2x12lb avg','2/case',12.0, 11.00, null, true, false, 20),
  ('BF-TRI-001','grasslands','beef','Tri Tip',            'Trimmed tri tip',                    'Bottom Sirloin','Tri Tip',      'sub_primal','lb','2.5lb avg','8/case',2.5,   9.75,22.00, true, true,  30),
  ('BF-CHK-001','grasslands','beef','Chuck Roll',         'Whole chuck roll, netted',           'Chuck',         'Chuck Roll',   'primal',    'lb','20lb avg','1/case',20.0,   7.25, null, true, false, 40),
  ('BF-BRS-001','grasslands','beef','Whole Brisket',      'Packer brisket',                     'Brisket',       'Whole Brisket','primal',    'lb','14lb avg','1/case',14.0,   8.50, null, true, false, 50),
  ('BF-RIB-001','grasslands','beef','Ribeye Lip-On',      'Lip-on bone-in ribeye',              'Rib',           'Ribeye',       'sub_primal','lb','2x18lb avg','2/case',18.0, 18.50, null, true, false, 60),
  ('BF-TEN-001','grasslands','beef','Tenderloin',         'PSMO tenderloin',                    'Loin',          'Tenderloin',   'sub_primal','lb','6lb avg','4/case',6.0,   26.00, null, true, false, 70),
  -- GRASSLANDS BEEF (retail / value-added)
  ('BF-SHO-001','grasslands','beef','Beef Short Ribs',    'Cross-cut flanken-style',            'Rib', null, 'retail_cut', 'lb','1 lb pack', null,1.0, 10.00, 18.00, true, true, 110),
  ('BF-CHE-001','grasslands','beef','Beef Cheeks',        'Trimmed cheeks for braising',        null,  null, 'retail_cut', 'lb','1 lb pack', null,1.0,  9.50, 16.00, true, true, 120),
  ('BF-SHA-001','grasslands','beef','Beef Shank',         'Cross-cut, osso buco style',         'Shank',null,'retail_cut','lb','1.5 lb avg',null,1.5,  7.50, 12.00, true, true, 130),
  ('BF-BRO-001','grasslands','beef','Bone Broth Bundle',  'Marrow + knuckle bones',             null,  null, 'value_added','each','5 lb bundle',null,5.0, null,35.00, false, true, 140),
  ('BF-GRD-001','grasslands','beef','Ground Beef 85/15',  'Chuck-forward grind',                null,  null, 'retail_cut', 'lb','1 lb pack', null,1.0,  7.00, 12.00, true, true, 150),
  ('BF-STK-001','grasslands','beef','Strip Steak Portion','10oz center-cut',                    'Loin','Strip Loin','retail_cut','each','10 oz','12/case',null,12.00,24.00, true, true, 160),
  -- PORK
  ('PK-CHP-001','fingerlakes_farms','pork','Bone-In Pork Chop','Center-cut, 1-inch thick',      'Loin','Center Loin','retail_cut','lb','2x0.75lb','12/case',0.75, 7.50, 14.00, true, true, 210),
  ('PK-RIB-001','fingerlakes_farms','pork','St. Louis Ribs',   'Trimmed St. Louis spare ribs',  'Belly', null,      'sub_primal','lb','3lb avg','4/case',3.0,  8.25, 16.00, true, true, 220),
  ('PK-BEL-001','fingerlakes_farms','pork','Pork Belly',       'Skin-on fresh belly',           'Belly', null,      'sub_primal','lb','10lb avg','1/case',10.0, 7.75, null, true, false, 230),
  ('PK-BUT-001','fingerlakes_farms','pork','Boston Butt',      'Boneless Boston butt',          'Shoulder','Butt',  'sub_primal','lb','8lb avg','2/case',8.0,  6.50, null, true, false, 240),
  ('PK-SAU-001','fingerlakes_farms','pork','Italian Sausage',  'Sweet, 1 lb links',             null,  null,       'value_added','lb','1 lb pack',null,1.0, 7.50, 13.00, true, true, 250),
  -- EGGS
  ('EG-DOZ-001','meadow_creek','eggs','Large Brown Eggs — Dozen','Pasture-raised',              null, null,'whole','dozen','12 ct','15/case',null,  null, 7.00, false, true,  310),
  ('EG-CSE-001','meadow_creek','eggs','Large Brown Eggs — Case', '15 dz case',                  null, null,'whole','case', '15 dz','1/case', null, 72.00, null, true, false, 320),
  ('EG-JMB-001','meadow_creek','eggs','Jumbo Brown Eggs — Dozen','Pasture-raised jumbo',        null, null,'whole','dozen','12 ct','15/case',null, null, 8.50, false, true,  330),
  -- DAIRY (partner / sourced)
  ('DY-MLK-001','fingerlakes_farms','dairy','Whole Milk — Gallon','Glass, from partner dairy',  null, null,'whole','gallon','1 ga','4/case',null, 5.50, 9.00, true, true, 410),
  ('DY-BTR-001','fingerlakes_farms','dairy','Cultured Butter — 1 lb','Sea salt cultured',       null, null,'whole','lb','1 lb brick',null,1.0, 7.00,12.00, true, true, 420),
  ('DY-YGT-001','fingerlakes_farms','dairy','Plain Yogurt — Quart','Whole milk',                null, null,'whole','quart','32 oz','6/case',null,5.25, 9.00, true, true, 430),
  -- PRODUCE (seasonal — sample list)
  ('PR-TOM-001','fingerlakes_farms','produce','Heirloom Tomatoes','Mixed varieties, seasonal', null, null,'whole','lb','10 lb case','1/case',null, 3.50, 6.00, true, true, 510),
  ('PR-LET-001','fingerlakes_farms','produce','Little Gem Lettuce','Trays of 24',              null, null,'whole','case','24 ct','1/case', null,28.00, null, true, false, 520),
  ('PR-MSH-001','fingerlakes_farms','produce','Mixed Mushrooms','Chef mix, 3 lb',              null, null,'whole','lb','3 lb pack','1/case',3.0, 11.50,15.00, true, true, 530),
  ('PR-BER-001','fingerlakes_farms','produce','Mixed Berries','Seasonal pint',                 null, null,'whole','each','1 pt','12/case',null,4.50, 7.50, true, true, 540)
on conflict (sku) do nothing;
