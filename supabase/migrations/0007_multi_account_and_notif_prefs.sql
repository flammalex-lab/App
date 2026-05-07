-- One human → many accounts (multi-location buyers).
-- Today `profiles.account_id` is a single FK; this join table lets a buyer
-- log in once and switch between every account they're attached to.
-- `profiles.account_id` stays as the buyer's *default* landing account.

create table profile_accounts (
  profile_id uuid not null references profiles(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (profile_id, account_id)
);

create index idx_profile_accounts_profile on profile_accounts(profile_id);
create index idx_profile_accounts_account on profile_accounts(account_id);

-- Backfill: every profile with an existing account_id gets a default membership
insert into profile_accounts (profile_id, account_id, is_default)
select id, account_id, true
from profiles
where account_id is not null
on conflict do nothing;

-- Per-user notification preferences (profile-scoped, not account-scoped:
-- one buyer across multiple accounts still has one phone / one email).
alter table profiles
  add column if not exists notification_prefs jsonb not null default jsonb_build_object(
    'push_order_tracking', true,
    'email_order_confirmation', true,
    'email_new_chat', true,
    'email_payments', false,
    'sms_cutoff_warning', true
  );

-- Messages: system-authored posts (order placed, status changed, etc.) have
-- no human sender. `is_system=true` + `from_profile_id=null` is the shape.
alter table messages
  add column if not exists is_system boolean not null default false,
  add column if not exists related_order_id uuid references orders(id) on delete set null;

create index if not exists idx_messages_related_order on messages(related_order_id);

-- RLS: profile_accounts
alter table profile_accounts enable row level security;

create policy "profile_accounts self read"
  on profile_accounts for select
  using (profile_id = auth.uid() or is_admin());

create policy "profile_accounts admin write"
  on profile_accounts for all
  using (is_admin()) with check (is_admin());
