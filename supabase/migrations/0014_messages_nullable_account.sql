-- =========================
-- Allow messages without an account
-- =========================
-- A buyer without an active account (newly invited, multi-account
-- resolution failing, etc.) used to get bounced to /account when they
-- tapped the Chat tab. Now /chat renders regardless, and a no-account
-- message just lands in the profile's personal thread and fans out to
-- the first available admin via SMS.

alter table messages alter column account_id drop not null;

-- Self-read for account-less messages: buyer sees threads where they're
-- the sender or recipient, even if account_id is null.
create policy "messages self thread read" on messages for select using (
  account_id is null and (from_profile_id = auth.uid() or to_profile_id = auth.uid())
);

-- Self-insert when there's no active account — lets the buyer post a
-- message tied to their own profile without the RLS check requiring
-- my_account_id(). Admins still get full access via the existing policy.
create policy "messages self thread insert" on messages for insert with check (
  account_id is null and from_profile_id = auth.uid()
);
