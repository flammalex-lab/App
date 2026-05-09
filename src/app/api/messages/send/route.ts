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

  const impersonating = session.profile.role === "admin" ? await getImpersonation() : null;
  const svc = createServiceClient();

  let fromProfileId = session.userId;
  let fromFirstName = session.profile.first_name ?? "";
  let fromPhone: string | null = session.profile.phone;
  let accountId: string | null = session.profile.account_id;

  if (impersonating) {
    const { data: targetRow } = await svc
      .from("profiles")
      .select("id, first_name, phone, account_id")
      .eq("id", impersonating)
      .maybeSingle();
    const target = targetRow as
      | { id: string; first_name: string | null; phone: string | null; account_id: string | null }
      | null;
    if (target) {
      fromProfileId = target.id;
      fromFirstName = target.first_name ?? "";
      fromPhone = target.phone;
      accountId = target.account_id;
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
    const { data: accountRow } = await svc
      .from("accounts")
      .select("salesperson_id, name")
      .eq("id", accountId)
      .maybeSingle();
    const account = accountRow as { salesperson_id: string | null; name: string } | null;
    toProfileId = account?.salesperson_id ?? null;
    accountName = account?.name ?? null;
  }
  if (!toProfileId) {
    const { data: fallbackAdminRow } = await svc
      .from("profiles")
      .select("id, phone")
      .eq("role", "admin")
      .not("phone", "is", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const fallbackAdmin = fallbackAdminRow as { id: string; phone: string | null } | null;
    toProfileId = fallbackAdmin?.id ?? null;
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

  // Forward to the recipient via SMS if they've opted in. Otherwise the
  // message stays in-app only.
  if (toProfileId) {
    const { data: repRow } = await svc
      .from("profiles")
      .select("phone, sms_opted_in")
      .eq("id", toProfileId)
      .maybeSingle();
    const rep = repRow as { phone: string | null; sms_opted_in: boolean } | null;
    const phone = rep?.phone ?? null;
    const optedIn = Boolean(rep?.sms_opted_in);
    if (phone && optedIn) {
      const prefix = accountName ? `[${accountName}]` : "[no account]";
      await sendSms({
        to: phone,
        body: `${prefix} ${fromFirstName}: ${body}`,
      });
    }
  }
  return NextResponse.json({ ok: true, message: inserted });
}
