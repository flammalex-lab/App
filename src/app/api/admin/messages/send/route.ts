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
  const { data: buyers } = await svc.from("profiles").select("id,phone").eq("account_id", accountId).limit(1);
  const toProfile = (buyers as any[] | null)?.[0];

  const smsResult = toProfile?.phone ? await sendSms({ to: toProfile.phone, body }) : { ok: false };

  await svc.from("messages").insert({
    account_id: accountId,
    from_profile_id: admin.userId,
    to_profile_id: toProfile?.id ?? null,
    body,
    channel: smsResult.ok ? "sms" : "app",
    direction: "outbound",
    to_phone: toProfile?.phone ?? null,
    sms_sid: (smsResult as any).sid ?? null,
  });
  return NextResponse.json({ ok: true });
}
