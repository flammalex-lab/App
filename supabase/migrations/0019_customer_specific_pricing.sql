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

-- =========================
-- 1. PRIVATE PRODUCTS
-- =========================
alter table products
  add column private boolean not null default false;

create index idx_products_private on products(private) where private = true;

-- =========================
-- 2. ACCOUNT ⇄ PRODUCT ALLOW-LIST
-- =========================
create table account_products (
  account_id uuid not null references accounts(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (account_id, product_id)
);

create index idx_account_products_account on account_products(account_id);
create index idx_account_products_product on account_products(product_id);

alter table account_products enable row level security;

create policy "account_products admin all"
  on account_products for all
  using (is_admin()) with check (is_admin());

create policy "account_products member read"
  on account_products for select
  using (account_id = my_account_id());

-- =========================
-- 3. PRICE LISTS
-- =========================
create table price_lists (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger t_price_lists_updated
  before update on price_lists
  for each row execute function set_updated_at();

create table price_list_items (
  id uuid primary key default gen_random_uuid(),
  price_list_id uuid not null references price_lists(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  unit_price numeric not null,
  effective_date date not null default current_date,
  expiry_date date,
  unique (price_list_id, product_id)
);

create index idx_price_list_items_list on price_list_items(price_list_id);
create index idx_price_list_items_product on price_list_items(product_id);

alter table price_lists      enable row level security;
alter table price_list_items enable row level security;

create policy "price_lists admin all"
  on price_lists for all
  using (is_admin()) with check (is_admin());

-- A buyer can read their own account's assigned price list (so we can render
-- "your contract pricing" surfaces in the future without going through admin).
create policy "price_lists member read"
  on price_lists for select
  using (
    id = (select price_list_id from accounts where id = my_account_id())
  );

create policy "price_list_items admin all"
  on price_list_items for all
  using (is_admin()) with check (is_admin());

create policy "price_list_items member read"
  on price_list_items for select
  using (
    price_list_id = (select price_list_id from accounts where id = my_account_id())
  );

-- =========================
-- 4. ACCOUNT → PRICE LIST POINTER
-- =========================
alter table accounts
  add column price_list_id uuid references price_lists(id) on delete set null;

create index idx_accounts_price_list on accounts(price_list_id);

-- =========================
-- 5. TIGHTEN PRODUCTS RLS FOR PRIVATE GATING
-- =========================
-- Replace the simple "is_active or admin" read policy with one that also
-- hides private products from buyers whose account isn't on the allow-list.
-- Defense-in-depth: the query layer also filters, but RLS is the backstop.
drop policy if exists "products read active" on products;

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
