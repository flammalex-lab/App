-- Native push notification tokens (Capacitor iOS / Android wrapper).
--
-- When a buyer launches the installed app and grants notification
-- permission, the Capacitor Push plugin hands us an APNs (iOS) or FCM
-- (Android) device token. We POST it to /api/push/register, which lands
-- here. The same buyer can have multiple rows — phone + tablet, work
-- and home device, etc.
--
-- RLS: a buyer can read/write only their own tokens. The service role
-- bypasses RLS and is what the (future) push-fanout worker uses to read
-- every token for a profile when an order ships, a chat reply arrives,
-- or a cutoff is approaching.

create table if not exists device_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android')),
  -- Track when we last saw this token so a janitor can prune stale
  -- entries (Apple recycles tokens; FCM expires them). The push worker
  -- bumps last_seen_at on every successful send.
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (profile_id, token)
);

create index if not exists idx_device_tokens_profile on device_tokens (profile_id);

alter table device_tokens enable row level security;

-- A buyer can manage their own tokens. Insert/update/delete all flow
-- through the same policy since the path is "this device, this user."
create policy "owners manage their device tokens"
  on device_tokens
  for all
  to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
