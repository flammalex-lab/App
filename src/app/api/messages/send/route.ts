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

  // Resolve the recipients — every admin profile with a phone + sms_opted_in.
  // Previous behavior used accounts.salesperson_id with first-admin fallback,
  // but per the current single-admin setup the routing is "all messages go
  // to the admin." If multiple admins exist later, each opted-in admin gets
  // a copy of the SMS. The toProfileId on the message row is set to the
  // first admin for thread bookkeeping; the admin chat surface lists by
  // account_id anyway so this is just metadata.
  let accountName: string | null = null;
  if (accountId) {
    const { data: accountRow } = await svc
      .from("accounts")
      .select("name")
      .eq("id", accountId)
      .maybeSingle();
    accountName = (accountRow as { name: string } | null)?.name ?? null;
  }
  const { data: adminRows } = await svc
    .from("profiles")
    .select("id, phone, sms_opted_in")
    .eq("role", "admin")
    .order("created_at", { ascending: true });
  const admins = (adminRows as { id: string; phone: string | null; sms_opted_in: boolean }[] | null) ?? [];
  const toProfileId: string | null = admins[0]?.id ?? null;
  const smsRecipients = admins.filter((a) => a.phone && a.sms_opted_in);

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

  // Fan out SMS to every opted-in admin. Errors are intentionally swallowed
  // (Twilio outage shouldn't fail the buyer's send); the message itself is
  // already persisted so admins can still read it in /admin/messages.
  const prefix = accountName ? `[${accountName}]` : "[no account]";
  await Promise.all(
    smsRecipients.map((r) =>
      sendSms({ to: r.phone!, body: `${prefix} ${fromFirstName}: ${body}` }).catch(() => {
        /* swallow */
      }),
    ),
  );
  return NextResponse.json({ ok: true, message: inserted });
}
