-- Tighten Supabase advisor WARN findings ahead of buyer testing.
--
-- 1. Pin search_path on two functions that didn't have it set. Defense
--    against pg_temp schema hijacks; cheap to add.
-- 2. Revoke RPC-exposure on functions that never needed it:
--      - handle_new_user, ensure_default_order_guide are trigger
--        functions — triggers still fire after the revoke (SECURITY
--        DEFINER runs as owner regardless of caller EXECUTE).
--      - is_admin, my_account_id are RLS helpers — keep authenticated
--        EXECUTE so RLS policies still resolve them; drop anon access.
--      - latest_messages_per_account is an admin RPC — gates on
--        is_admin() internally, but no reason anon should see /rpc/ entry.
-- 3. Drop the broad SELECT policy on storage.objects for product-images.
--    The bucket is public, so /storage/v1/object/public/<key> still works
--    via the CDN path; the policy was only enabling list operations that
--    nothing in the app uses.

-- 1. search_path pins
alter function public.set_updated_at()       set search_path = public, pg_temp;
alter function public.generate_order_number() set search_path = public, pg_temp;

-- 2a. Trigger functions: revoke all RPC access
revoke execute on function public.handle_new_user()           from public, anon, authenticated;
revoke execute on function public.ensure_default_order_guide() from public, anon, authenticated;

-- 2b. RLS helpers: anon doesn't need them
revoke execute on function public.is_admin()        from public, anon;
revoke execute on function public.my_account_id()   from public, anon;

-- 2c. Admin RPC: anon doesn't need it
revoke execute on function public.latest_messages_per_account(integer, integer)
  from public, anon;

-- 3. Drop unused list-allowing policy on product-images
drop policy if exists "product-images public read" on storage.objects;
