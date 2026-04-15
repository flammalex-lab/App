import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { sendSms } from "@/lib/twilio/client";

/** Buyer sends a message — posts to their account thread and forwards to rep via SMS. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!session.profile.account_id) return NextResponse.json({ error: "no account" }, { status: 400 });
  const { body } = (await request.json()) as { body: string };
  if (!body?.trim()) return NextResponse.json({ error: "empty" }, { status: 400 });

  const svc = createServiceClient();
  const { data: account } = await svc.from("accounts").select("salesperson_id,name").eq("id", session.profile.account_id).maybeSingle();
  let toProfileId: string | null = (account as any)?.salesperson_id ?? null;

  await svc.from("messages").insert({
    account_id: session.profile.account_id,
    from_profile_id: session.userId,
    to_profile_id: toProfileId,
    body,
    channel: "app",
    direction: "outbound",
    from_phone: session.profile.phone,
  });

  // Forward to salesperson via SMS if they have a phone on file
  if (toProfileId) {
    const { data: sp } = await svc.from("profiles").select("phone").eq("id", toProfileId).maybeSingle();
    const phone = (sp as any)?.phone;
    if (phone) {
      await sendSms({
        to: phone,
        body: `[${(account as any)?.name}] ${session.profile.first_name ?? ""}: ${body}`,
      });
    }
  }
  return NextResponse.json({ ok: true });
}
