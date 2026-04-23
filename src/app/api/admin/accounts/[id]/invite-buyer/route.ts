import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/utils/phone";
import { sendSms } from "@/lib/twilio/client";
import { seedStarterGuide } from "@/lib/order-guides/seed";

interface InviteBody {
  phone: string;
  name: string;
  email?: string | null;
  title?: string | null;
  buyer_type?: string | null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }
  const { id: accountId } = await params;
  const body = (await request.json()) as InviteBody;
  const e164 = normalizePhone(body.phone);
  if (!e164) return NextResponse.json({ error: "invalid phone" }, { status: 400 });
  if (!body.name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

  const svc = createServiceClient();

  const firstName = body.name.split(" ")[0] ?? "";
  const lastName = body.name.split(" ").slice(1).join(" ");

  const { data: created, error } = await svc.auth.admin.createUser({
    phone: e164,
    phone_confirm: true,
    email: body.email?.trim() || undefined,
    user_metadata: {
      first_name: firstName,
      last_name: lastName,
      role: "b2b_buyer",
    },
  });
  if (error || !created.user) {
    return NextResponse.json({ error: error?.message ?? "create failed" }, { status: 500 });
  }
  const profileId = created.user.id;

  await svc
    .from("profiles")
    .update({
      account_id: accountId,
      role: "b2b_buyer",
      title: body.title?.trim() || null,
      buyer_type: body.buyer_type || null,
      email: body.email?.trim() || null,
    })
    .eq("id", profileId);

  await svc
    .from("profile_accounts")
    .insert({ profile_id: profileId, account_id: accountId, is_default: true })
    .select()
    .maybeSingle();

  const seeded = await seedStarterGuide(svc, profileId, body.buyer_type ?? null);

  await sendSms({
    to: e164,
    body: `Welcome to Fingerlakes Farms. Sign in at ${process.env.NEXT_PUBLIC_APP_URL}/login — enter this number to receive a code.`,
  });

  return NextResponse.json({ ok: true, profileId, seeded });
}
