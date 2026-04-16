import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import { resolveActiveAccount } from "@/lib/auth/active-account";
import { sendSms } from "@/lib/twilio/client";

/**
 * Buyer sends a message — posts to their account thread and forwards to rep
 * via SMS. Respects admin impersonation: if an admin is acting as a buyer,
 * the message is attributed to the buyer, not the admin.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { body } = (await request.json()) as { body: string };
  if (!body?.trim()) return NextResponse.json({ error: "empty" }, { status: 400 });

  const impersonating = session.profile.role === "admin" ? getImpersonation() : null;
  const svc = createServiceClient();

  // Resolve effective buyer (the profile we're sending the message AS)
  let fromProfileId = session.userId;
  let fromFirstName = session.profile.first_name ?? "";
  let fromPhone = session.profile.phone;
  let accountId = session.profile.account_id;

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
    // Non-impersonating: honor the active-account cookie for multi-location buyers
    const { active } = await resolveActiveAccount(fromProfileId, accountId);
    if (active) accountId = active.id;
  }

  if (!accountId) {
    return NextResponse.json({ error: "no account for this profile" }, { status: 400 });
  }

  const { data: account } = await svc
    .from("accounts")
    .select("salesperson_id, name")
    .eq("id", accountId)
    .maybeSingle();
  const toProfileId: string | null = (account as any)?.salesperson_id ?? null;

  const { error: insertErr } = await svc.from("messages").insert({
    account_id: accountId,
    from_profile_id: fromProfileId,
    to_profile_id: toProfileId,
    body,
    channel: "app",
    direction: "outbound",
    from_phone: fromPhone,
  });
  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  // Forward to salesperson via SMS if they have a phone on file
  if (toProfileId) {
    const { data: sp } = await svc.from("profiles").select("phone").eq("id", toProfileId).maybeSingle();
    const phone = (sp as any)?.phone;
    if (phone) {
      await sendSms({
        to: phone,
        body: `[${(account as any)?.name}] ${fromFirstName}: ${body}`,
      });
    }
  }
  return NextResponse.json({ ok: true });
}
