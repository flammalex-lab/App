-- Hotfix for migration 0027: the REVOKE on is_admin / my_account_id /
-- latest_messages_per_account stripped authenticated's EXECUTE too,
-- because their only path was via PUBLIC. RLS policies on `profiles`
-- (and others) call is_admin() at evaluate-time, so every authenticated
-- read errored with `permission denied for function is_admin`. Net
-- effect: sign-in worked at the auth layer, but the very next query
-- (profile lookup) failed, getSession() returned null, and the layout
-- redirected back to /login. Looked like a "bounce to phone".
--
-- Re-grant EXECUTE on the helpers needed by RLS (is_admin, my_account_id)
-- to authenticated AND anon. anon needs it because RLS policies declared
-- `to public` are evaluated even for anon, and an EXECUTE-denied function
-- in the policy expression errors the whole policy out — better to let
-- the function run and return false/null for anon than to crash the policy.
--
-- latest_messages_per_account is admin-only (gates on is_admin() inside),
-- but admin users are still `authenticated` at the Postgres role layer,
-- so authenticated needs EXECUTE. Keep anon revoked.
--
-- The trigger functions (handle_new_user, ensure_default_order_guide) are
-- correctly fully revoked — triggers don't need EXECUTE on the function
-- (they invoke under the trigger machinery, not via the function-call
-- permission check).

grant execute on function public.is_admin()      to authenticated, anon;
grant execute on function public.my_account_id() to authenticated, anon;
grant execute on function public.latest_messages_per_account(integer, integer) to authenticated;
