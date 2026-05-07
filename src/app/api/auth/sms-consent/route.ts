import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Record SMS opt-in for the authenticated user.
 *
 * Called from /register and /login after successful auth, but only when the
 * user actually checked the (unchecked-by-default) consent checkbox on the
 * form. Stamps the timestamp and source so we can produce evidence to TCR
 * for any specific phone number.
 *
 * Note: opt-OUT is not handled here — the canonical channel is the user
 * texting STOP, which Twilio's Messaging Service handles natively.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { source } = (await request.json().catch(() => ({}))) as { source?: string };
  if (source !== "register" && source !== "login") {
    return NextResponse.json({ error: "invalid source" }, { status: 400 });
  }

  const svc = createServiceClient();
  const { error } = await svc
    .from("profiles")
    .update({
      sms_opted_in: true,
      sms_opt_in_at: new Date().toISOString(),
      sms_opt_in_source: source,
    })
    .eq("id", session.userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
