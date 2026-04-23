import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import { resolveActiveAccount } from "@/lib/auth/active-account";
import { sendSms } from "@/lib/twilio/client";

/**
 * Buyer sends a message.
 *
 * With an active account: posts to the account thread and forwards to the
 * account's salesperson via SMS. Respects impersonation — the message is
 * attributed to the buyer, not the admin who's viewing as them.
 *
 * Without an active account (new buyer not yet linked, etc.): posts a
 * personal thread row with account_id = null and forwards to the first
 * admin that has a phone on file. Keeps the chat tab useful for anyone
 * regardless of account setup status.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { body } = (await request.json()) as { body: string };
  if (!body?.trim()) return NextResponse.json({ error: "empty" }, { status: 400 });

  const impersonating = session.profile.role === "admin" ? getImpersonation() : null;
  const svc = createServiceClient();

  let fromProfileId = session.userId;
  let fromFirstName = session.profile.first_name ?? "";
  let fromPhone: string | null = session.profile.phone;
  let accountId: string | null = session.profile.account_id;

  if (impersonating) {
    const { data: target } = await svc
      .from("profiles")
      .select("id, first_name, phone, account_id")
      .eq("id", impersonating)
      .maybeSingle();
    if (target) {
      fromProfileId = (target as any).id;
      fromFirstName = (target as any).first_name ?? "";
      fromPhone = (target as any).phone;
      accountId = (target as any).account_id;
    }
  } else {
    const { active } = await resolveActiveAccount(fromProfileId, accountId);
    accountId = active?.id ?? null;
  }

  // Resolve the recipient. Account thread → salesperson. No-account thread
  // → fall back to the first admin with a phone so the message still reaches
  // someone real via SMS.
  let toProfileId: string | null = null;
  let accountName: string | null = null;
  if (accountId) {
    const { data: account } = await svc
      .from("accounts")
      .select("salesperson_id, name")
      .eq("id", accountId)
      .maybeSingle();
    toProfileId = ((account as any)?.salesperson_id as string | null) ?? null;
    accountName = ((account as any)?.name as string | null) ?? null;
  }
  if (!toProfileId) {
    const { data: fallbackAdmin } = await svc
      .from("profiles")
      .select("id, phone")
      .eq("role", "admin")
      .not("phone", "is", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    toProfileId = ((fallbackAdmin as any)?.id as string | null) ?? null;
  }

  const { data: inserted, error: insertErr } = await svc
    .from("messages")
    .insert({
      account_id: accountId,
      from_profile_id: fromProfileId,
      to_profile_id: toProfileId,
      body,
      channel: "app",
      direction: "outbound",
      from_phone: fromPhone,
    })
    .select("*")
    .single();
  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  // Forward to the recipient via SMS if they have a phone on file.
  if (toProfileId) {
    const { data: rep } = await svc
      .from("profiles")
      .select("phone")
      .eq("id", toProfileId)
      .maybeSingle();
    const phone = (rep as any)?.phone as string | null;
    if (phone) {
      const prefix = accountName ? `[${accountName}]` : "[no account]";
      await sendSms({
        to: phone,
        body: `${prefix} ${fromFirstName}: ${body}`,
      });
    }
  }
  return NextResponse.json({ ok: true, message: inserted });
}
