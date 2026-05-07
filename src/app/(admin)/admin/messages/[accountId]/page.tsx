import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminMessagesClient } from "./AdminMessagesClient";
import type { Account, Message, Profile } from "@/lib/supabase/types";
import { requireAdmin } from "@/lib/auth/session";

export default async function AdminAccountMessages({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  const { profile } = await requireAdmin();
  const db = await createClient();

  const { data: account } = await db.from("accounts").select("*").eq("id", accountId).maybeSingle();
  if (!account) notFound();

  const { data: messages } = await db
    .from("messages")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: true })
    .limit(500);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl mb-1">{(account as Account).name}</h1>
      <p className="text-ink-secondary text-sm mb-3">{(account as Account).primary_contact_phone ?? ""}</p>
      <AdminMessagesClient
        accountId={accountId}
        adminProfileId={profile.id}
        initial={(messages as Message[] | null) ?? []}
      />
    </div>
  );
}
