import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sendSms } from "@/lib/twilio/client";

/** Admin sends a message — writes to thread AND delivers via SMS to buyer's phone. */
export async function POST(request: Request) {
  let admin;
  try { admin = await requireAdmin(); } catch { return NextResponse.json({ error: "admin only" }, { status: 403 }); }
  const { accountId, body } = (await request.json()) as { accountId: string; body: string };
  if (!accountId || !body?.trim()) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const svc = createServiceClient();
  // Find primary buyer phone
  const { data: buyers } = await svc.from("profiles").select("id,phone,sms_opted_in").eq("account_id", accountId).limit(1);
  const toProfile = (buyers as { id: string; phone: string | null; sms_opted_in: boolean }[] | null)?.[0];

  // Only deliver via SMS if the buyer has explicitly opted in. Otherwise the
  // message still lands in their in-app thread.
  const smsResult = toProfile?.phone && toProfile.sms_opted_in
    ? await sendSms({ to: toProfile.phone, body })
    : { ok: false as const };

  await svc.from("messages").insert({
    account_id: accountId,
    from_profile_id: admin.userId,
    to_profile_id: toProfile?.id ?? null,
    body,
    channel: smsResult.ok ? "sms" : "app",
    direction: "outbound",
    to_phone: toProfile?.phone ?? null,
    // sendSms returns { ok, sid?, ... } when ok=true; the failure /
    // not-attempted branches don't carry a sid.
    sms_sid: ("sid" in smsResult ? smsResult.sid : null) ?? null,
  });
  return NextResponse.json({ ok: true });
}
