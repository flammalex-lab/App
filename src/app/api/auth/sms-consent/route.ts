import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Record SMS opt-in (or revoke it) for the authenticated user.
 *
 * Sources:
 *  - 'register' — DTC retail signup
 *  - 'account'  — self-service Notifications panel
 *
 * Note: TCR / CTIA also accepts STOP via SMS as the canonical opt-out
 * channel; Twilio's Messaging Service handles STOP keyword automatically.
 * This endpoint exists so users (especially B2B buyers, who never see
 * /register) can opt in/out from inside the app.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { source, opt_in } = (await request.json().catch(() => ({}))) as {
    source?: string;
    opt_in?: boolean;
  };
  if (source !== "register" && source !== "account") {
    return NextResponse.json({ error: "invalid source" }, { status: 400 });
  }

  const svc = createServiceClient();

  if (opt_in === false) {
    const { error } = await svc
      .from("profiles")
      .update({
        sms_opted_in: false,
        sms_opt_in_at: null,
        sms_opt_in_source: null,
      })
      .eq("id", session.userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, opted_in: false });
  }

  const { error } = await svc
    .from("profiles")
    .update({
      sms_opted_in: true,
      sms_opt_in_at: new Date().toISOString(),
      sms_opt_in_source: source,
    })
    .eq("id", session.userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, opted_in: true });
}
