import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import type { Message } from "@/lib/supabase/types";
import { MessagesClient } from "./MessagesClient";

export const metadata = { title: "Messages — Fingerlakes Farms" };

export default async function MessagesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const impersonating = session.profile.role === "admin" ? getImpersonation() : null;
  const db = impersonating ? createServiceClient() : await createClient();
  const profileId = impersonating ?? session.userId;

  const { data: me } = await db.from("profiles").select("*").eq("id", profileId).maybeSingle();
  if (!me?.account_id) redirect("/account");

  const { data } = await db
    .from("messages")
    .select("*")
    .eq("account_id", me.account_id)
    .order("created_at", { ascending: true })
    .limit(200);

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl mb-4">Messages</h1>
      <MessagesClient
        accountId={me.account_id}
        profileId={profileId}
        initial={(data as Message[] | null) ?? []}
      />
    </div>
  );
}
