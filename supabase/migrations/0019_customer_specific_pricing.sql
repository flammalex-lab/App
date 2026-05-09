-- Customer-specific products + shared price lists.
--
--  1. products.private          → flagged products are hidden from the catalog
--                                  unless the buyer's account is on the allow-list
--                                  (account_products).
--  2. account_products          → per-account visibility allow-list for private
--                                  products. Public products ignore this table.
--  3. price_lists / price_list_items
--                               → named price sheets that any number of accounts
--                                  can share. Sits between account_pricing
--                                  (per-account override) and the tier multiplier
--                                  in resolvePrice().
--  4. accounts.price_list_id    → optional pointer; null = use tier multiplier.
--
-- Re-runnable: every DDL is idempotent so a half-applied run can be
-- finished by re-executing.

-- =========================
-- 1. PRIVATE PRODUCTS
-- =========================
alter table products
  add column if not exists private boolean not null default false;

create index if not exists idx_products_private on products(private) where private = true;

-- =========================
-- 2. ACCOUNT ⇄ PRODUCT ALLOW-LIST
-- =========================
create table if not exists account_products (
  account_id uuid not null references accounts(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (account_id, product_id)
);

create index if not exists idx_account_products_account on account_products(account_id);
create index if not exists idx_account_products_product on account_products(product_id);

alter table account_products enable row level security;

drop policy if exists "account_products admin all" on account_products;
create policy "account_products admin all"
  on account_products for all
  using (is_admin()) with check (is_admin());

drop policy if exists "account_products member read" on account_products;
create policy "account_products member read"
  on account_products for select
  using (account_id = my_account_id());

-- =========================
-- 3. PRICE LISTS
-- =========================
create table if not exists price_lists (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists t_price_lists_updated on price_lists;
create trigger t_price_lists_updated
  before update on price_lists
  for each row execute function set_updated_at();

create table if not exists price_list_items (
  id uuid primary key default gen_random_uuid(),
  price_list_id uuid not null references price_lists(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  unit_price numeric not null,
  effective_date date not null default current_date,
  expiry_date date,
  unique (price_list_id, product_id)
);

create index if not exists idx_price_list_items_list on price_list_items(price_list_id);
create index if not exists idx_price_list_items_product on price_list_items(product_id);

-- =========================
-- 4. ACCOUNT → PRICE LIST POINTER
--    Must precede the price_lists / price_list_items member-read policies
--    below — they reference accounts.price_list_id.
-- =========================
alter table accounts
  add column if not exists price_list_id uuid references price_lists(id) on delete set null;

create index if not exists idx_accounts_price_list on accounts(price_list_id);

-- =========================
-- 5. PRICE LIST RLS
-- =========================
alter table price_lists      enable row level security;
alter table price_list_items enable row level security;

drop policy if exists "price_lists admin all" on price_lists;
create policy "price_lists admin all"
  on price_lists for all
  using (is_admin()) with check (is_admin());

-- A buyer can read their own account's assigned price list (so we can render
-- "your contract pricing" surfaces in the future without going through admin).
drop policy if exists "price_lists member read" on price_lists;
create policy "price_lists member read"
  on price_lists for select
  using (
    id = (select price_list_id from accounts where id = my_account_id())
  );

drop policy if exists "price_list_items admin all" on price_list_items;
create policy "price_list_items admin all"
  on price_list_items for all
  using (is_admin()) with check (is_admin());

drop policy if exists "price_list_items member read" on price_list_items;
create policy "price_list_items member read"
  on price_list_items for select
  using (
    price_list_id = (select price_list_id from accounts where id = my_account_id())
  );

-- =========================
-- 6. TIGHTEN PRODUCTS RLS FOR PRIVATE GATING
-- =========================
drop policy if exists "products read active" on products;
drop policy if exists "products read" on products;

create policy "products read"
  on products for select
  using (
    is_admin()
    or (
      is_active = true
      and (
        private = false
        or exists (
          select 1 from account_products ap
          where ap.product_id = products.id
            and ap.account_id = my_account_id()
        )
      )
    )
  );
