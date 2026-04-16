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
  const impersonating = session.profile.role === "admin" ? getImpersonation() : null;
  const db = impersonating ? createServiceClient() : await createClient();
  const profileId = impersonating ?? session.userId;

  const { data: meData } = await db.from("profiles").select("*").eq("id", profileId).maybeSingle();
  if (!meData) redirect("/login");
  const me = meData as Profile;

  const { active } = await resolveActiveAccount(me.id, me.account_id);
  if (!active) redirect("/account");

  const { data } = await db
    .from("messages")
    .select("*")
    .eq("account_id", active.id)
    .order("created_at", { ascending: true })
    .limit(200);

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="display text-3xl mb-1">Chat</h1>
      <p className="text-sm text-ink-secondary mb-4">
        Messages go to your rep as a text too — reply from either side.
      </p>
      <ChatClient
        accountId={active.id}
        profileId={profileId}
        initial={(data as Message[] | null) ?? []}
      />
    </div>
  );
}
