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
