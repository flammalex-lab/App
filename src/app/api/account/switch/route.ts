import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { setActiveAccountCookie } from "@/lib/auth/active-account";
import type { ProfileAccount } from "@/lib/supabase/types";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { accountId } = (await request.json()) as { accountId: string };
  if (!accountId) return NextResponse.json({ error: "accountId required" }, { status: 400 });

  const svc = createServiceClient();
  const { data: link } = await svc
    .from("profile_accounts")
    .select("account_id")
    .eq("profile_id", session.userId)
    .eq("account_id", accountId)
    .maybeSingle();

  // Fallback for legacy profiles without a profile_accounts row:
  // honor their profile.account_id.
  const legacyOwned = (link as ProfileAccount | null) == null && session.profile.account_id === accountId;

  if (!link && !legacyOwned) {
    return NextResponse.json({ error: "not a member of that account" }, { status: 403 });
  }

  setActiveAccountCookie(accountId);
  return NextResponse.json({ ok: true });
}
