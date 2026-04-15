-- Fingerlakes Farms Portal — initial schema
-- Extensions
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
create type category_t        as enum ('beef', 'pork', 'eggs', 'produce');
create type cut_type_t        as enum ('primal', 'sub_primal', 'retail_cut', 'value_added', 'whole');
create type order_type_t      as enum ('b2b', 'dtc');
create type order_status_t    as enum ('pending', 'confirmed', 'processing', 'ready', 'shipped', 'delivered', 'cancelled');
create type payment_method_t  as enum ('invoice', 'stripe', 'venmo', 'cash');
create type payment_status_t  as enum ('unpaid', 'partial', 'paid');
create type activity_type_t   as enum ('call', 'email', 'visit', 'sample_drop', 'order', 'note', 'follow_up');

-- =========================
-- ACCOUNTS
-- =========================
create table accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type account_type_t not null,
  channel channel_t not null,
  pricing_tier pricing_tier_t not null default 'standard',
  status account_status_t not null default 'prospect',
  primary_contact_name text,
  primary_contact_email text,
  primary_contact_phone text,
  address_line1 text,
  address_line2 text,
  city text,
  state text default 'NY',
  zip text,
  delivery_zone delivery_zone_t,
  delivery_day text,
  delivery_notes text,
  source text,
  notes text,
  -- QB integration
  qb_customer_name text,
  qb_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- PROFILES  (extends auth.users)
-- =========================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role role_t not null default 'dtc_customer',
  first_name text,
  last_name text,
  phone text,
  account_id uuid references accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- PRODUCTS
-- =========================
create table products (
  id uuid primary key default gen_random_uuid(),
  brand brand_t not null,
  category category_t not null,
  name text not null,
  description text,
  primal text,
  sub_primal text,
  cut_type cut_type_t,
  unit text not null,
  pack_size text,
  case_pack text,
  avg_weight_lbs numeric,
  wholesale_price numeric,
  retail_price numeric,
  available_b2b boolean not null default true,
  available_dtc boolean not null default false,
  in_season boolean not null default true,
  is_active boolean not null default true,
  image_url text,
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
-- ORDERS
-- =========================
create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  order_type order_type_t not null,
  status order_status_t not null default 'pending',
  profile_id uuid not null references profiles(id) on delete restrict,
  account_id uuid references accounts(id) on delete set null,
  requested_delivery_date date,
  pickup_date date,
  pickup_window text,
  subtotal numeric not null default 0,
  tax numeric not null default 0,
  delivery_fee numeric not null default 0,
  total numeric not null default 0,
  payment_method payment_method_t not null default 'invoice',
  payment_status payment_status_t not null default 'unpaid',
  stripe_payment_id text,
  customer_notes text,
  internal_notes text,
  -- QB integration
  qb_exported boolean not null default false,
  qb_exported_at timestamptz,
  qb_invoice_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- ORDER ITEMS
-- =========================
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
-- QB SETTINGS (key/value)
-- =========================
create table qb_settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value text not null,
  updated_at timestamptz not null default now()
);

-- Seed default QB settings
insert into qb_settings (key, value) values
  ('income_account.beef',    'Beef Sales'),
  ('income_account.pork',    'Pork Sales'),
  ('income_account.eggs',    'Egg Sales'),
  ('income_account.produce', 'Produce Sales'),
  ('default_terms',          'Net 30'),
  ('ar_account',             'Accounts Receivable')
on conflict (key) do nothing;

-- =========================
-- INDEXES
-- =========================
create index idx_products_brand    on products(brand);
create index idx_products_category on products(category);
create index idx_orders_account    on orders(account_id);
create index idx_orders_status     on orders(status);
create index idx_orders_created    on orders(created_at desc);
create index idx_orders_qb_export  on orders(qb_exported) where qb_exported = false;
create index idx_activities_account on activities(account_id);
create index idx_activities_follow_up on activities(follow_up_date) where completed = false;
create index idx_accounts_status   on accounts(status);

-- =========================
-- TRIGGER: updated_at maintenance
-- =========================
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger t_accounts_updated  before update on accounts  for each row execute function set_updated_at();
create trigger t_profiles_updated  before update on profiles  for each row execute function set_updated_at();
create trigger t_products_updated  before update on products  for each row execute function set_updated_at();
create trigger t_orders_updated    before update on orders    for each row execute function set_updated_at();

-- =========================
-- ORDER NUMBER GENERATOR
-- FLF-YYYY-NNNN, monotonic per-year
-- =========================
create sequence if not exists order_number_seq;

create or replace function generate_order_number() returns text as $$
declare n int;
begin
  n := nextval('order_number_seq');
  return 'FLF-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 4, '0');
end;
$$ language plpgsql;
