import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { validateTwilioSignature } from "@/lib/twilio/client";

/**
 * Twilio webhook for inbound SMS.
 * Configure in Twilio console: Messaging → A Message Comes In → POST to
 *   https://<host>/api/sms/inbound
 *
 * Matches the sender's phone to a profile, finds their account, and posts
 * the message into the thread.
 */
export async function POST(request: Request) {
  const url = request.url;
  const form = await request.formData();
  const params: Record<string, string> = {};
  form.forEach((v, k) => { params[k] = typeof v === "string" ? v : ""; });

  const signature = request.headers.get("x-twilio-signature");
  const valid = await validateTwilioSignature(signature, url, params);
  if (!valid && process.env.NODE_ENV === "production") {
    return new NextResponse("bad signature", { status: 403 });
  }

  const fromPhone = params["From"];
  const body = params["Body"] ?? "";
  const smsSid = params["MessageSid"] ?? params["SmsSid"];

  if (!fromPhone) return new NextResponse("", { status: 200 });
  const svc = createServiceClient();
  const { data: profile } = await svc.from("profiles").select("id, account_id").eq("phone", fromPhone).maybeSingle();
  if (!profile?.account_id) {
    console.warn("[sms inbound] no profile/account for", fromPhone);
    return new NextResponse("", { status: 200 });
  }
  await svc.from("messages").insert({
    account_id: (profile as any).account_id,
    from_profile_id: (profile as any).id,
    body,
    channel: "sms",
    direction: "inbound",
    sms_sid: smsSid,
    from_phone: fromPhone,
  });
  return new NextResponse("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>", {
    headers: { "Content-Type": "text/xml" },
  });
}
