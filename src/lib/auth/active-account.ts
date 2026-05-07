import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import type { Account, ProfileAccount } from "@/lib/supabase/types";

const ACTIVE_ACCOUNT_COOKIE = "flf-active-account";

/**
 * Load every account the buyer is linked to (via profile_accounts), and
 * resolve the "currently active" one. Priority:
 *   1) cookie value (if still a valid membership)
 *   2) profile.account_id (default set on the profile itself)
 *   3) first membership row
 *
 * Buyers with a single account never see a switcher; the cookie is
 * ignored until a second membership exists.
 */
export async function resolveActiveAccount(
  profileId: string,
  profileDefaultAccountId: string | null,
): Promise<{ active: Account | null; memberships: Account[] }> {
  const svc = createServiceClient();

  const { data: links } = await svc
    .from("profile_accounts")
    .select("account_id, is_default")
    .eq("profile_id", profileId);

  const membershipIds = ((links as ProfileAccount[] | null) ?? []).map((l) => l.account_id);

  // If there are no membership rows at all, fall back to the single account_id
  // on the profile (covers old data + admin-seeded profiles that never got
  // a profile_accounts row inserted).
  const idsToLoad = membershipIds.length
    ? membershipIds
    : profileDefaultAccountId
    ? [profileDefaultAccountId]
    : [];

  if (idsToLoad.length === 0) return { active: null, memberships: [] };

  const { data: accounts } = await svc
    .from("accounts")
    .select("*")
    .in("id", idsToLoad);

  const memberships = (accounts as Account[] | null) ?? [];
  memberships.sort((a, b) => a.name.localeCompare(b.name));

  const cookieVal = cookies().get(ACTIVE_ACCOUNT_COOKIE)?.value ?? null;

  const active =
    memberships.find((a) => a.id === cookieVal) ??
    memberships.find((a) => a.id === profileDefaultAccountId) ??
    memberships[0] ??
    null;

  return { active, memberships };
}

export function setActiveAccountCookie(accountId: string | null) {
  const store = cookies();
  if (accountId === null) {
    store.delete(ACTIVE_ACCOUNT_COOKIE);
    return;
  }
  store.set(ACTIVE_ACCOUNT_COOKIE, accountId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
