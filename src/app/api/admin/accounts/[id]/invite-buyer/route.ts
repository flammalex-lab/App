import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/utils/phone";
import { sendSms } from "@/lib/twilio/client";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(); } catch { return NextResponse.json({ error: "admin only" }, { status: 403 }); }
  const { id: accountId } = await params;
  const { phone, name } = (await request.json()) as { phone: string; name: string };
  const e164 = normalizePhone(phone);
  if (!e164) return NextResponse.json({ error: "invalid phone" }, { status: 400 });
  const svc = createServiceClient();

  // Create the auth user with phone (no password — they'll sign in via OTP)
  const { data: created, error } = await svc.auth.admin.createUser({
    phone: e164,
    phone_confirm: true,
    user_metadata: {
      first_name: name.split(" ")[0] ?? "",
      last_name: name.split(" ").slice(1).join(" "),
      role: "b2b_buyer",
    },
  });
  if (error || !created.user) return NextResponse.json({ error: error?.message ?? "create failed" }, { status: 500 });

  // Link profile to account
  await svc
    .from("profiles")
    .update({ account_id: accountId, role: "b2b_buyer" })
    .eq("id", created.user.id);

  // Send welcome SMS — they'll sign in by entering phone at /login
  await sendSms({
    to: e164,
    body: `Welcome to Fingerlakes Farms. Sign in at ${process.env.NEXT_PUBLIC_APP_URL}/login — enter this number to receive a code.`,
  });

  return NextResponse.json({ ok: true, profileId: created.user.id });
}
