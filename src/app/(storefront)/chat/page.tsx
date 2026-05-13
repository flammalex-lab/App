import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import { resolveActiveAccount } from "@/lib/auth/active-account";
import type { Message, Profile } from "@/lib/supabase/types";
import { ChatClient } from "./ChatClient";

export const metadata = { title: "Chat — Fingerlakes Farms" };

export default async function ChatPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const impersonating = session.profile.role === "admin" ? await getImpersonation() : null;
  const db = impersonating ? createServiceClient() : await createClient();
  const profileId = impersonating ?? session.userId;

  const { data: meData } = await db.from("profiles").select("*").eq("id", profileId).maybeSingle();
  if (!meData) redirect("/login");
  const me = meData as Profile;

  const { active } = await resolveActiveAccount(me.id, me.account_id);
  const accountId = active?.id ?? null;

  // Fetch the thread: either the account thread OR the buyer's personal
  // account-less thread (account_id IS NULL + sender/recipient is them).
  let messages: Message[] = [];
  if (accountId) {
    const { data } = await db
      .from("messages")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: true })
      .limit(200);
    messages = (data as Message[] | null) ?? [];
  } else {
    const { data } = await db
      .from("messages")
      .select("*")
      .is("account_id", null)
      .or(`from_profile_id.eq.${profileId},to_profile_id.eq.${profileId}`)
      .order("created_at", { ascending: true })
      .limit(200);
    messages = (data as Message[] | null) ?? [];
  }

  // Full-bleed surface — page title lives in the MobileHeader (mobile) and
  // is implicit from the rep header strip (desktop). No page-level chrome
  // here; ChatClient owns its rectangle and escapes the storefront <main>
  // padding via negative margins.
  return <ChatClient accountId={accountId} profileId={profileId} initial={messages} />;
}
