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
  // Signatures are *always* required. Local dev can opt out with an
  // explicit env flag — never fall back to NODE_ENV alone, since
  // preview/staging builds frequently set NODE_ENV=production.
  const allowUnsigned = process.env.ALLOW_UNSIGNED_TWILIO === "true";
  if (!valid && !allowUnsigned) {
    return new NextResponse("bad signature", { status: 403 });
  }

  const fromPhone = params["From"];
  const body = params["Body"] ?? "";
  const smsSid = params["MessageSid"] ?? params["SmsSid"];

  if (!fromPhone) return new NextResponse("", { status: 200 });
  const svc = createServiceClient();
  const { data: profile } = await svc
    .from("profiles")
    .select("id, account_id")
    .eq("phone", fromPhone)
    .maybeSingle();

  // Unknown phone — park the message in the sms_triage table so a rep
  // can attach it to a profile by hand, instead of silently dropping.
  if (!profile) {
    await svc.from("sms_triage").insert({
      from_phone: fromPhone,
      body,
      sms_sid: smsSid,
    });
    return new NextResponse(
      "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>",
      { headers: { "Content-Type": "text/xml" } },
    );
  }

  // Resolve a destination account: legacy profile.account_id first, then
  // any account this profile is linked to via profile_accounts. Fall back
  // to a profile-scoped null-account thread (migration 0014) so unknown
  // / multi-account / between-accounts messages still reach the rep.
  const profileId = (profile as { id: string }).id;
  let accountId = (profile as { account_id: string | null }).account_id;
  if (!accountId) {
    const { data: link } = await svc
      .from("profile_accounts")
      .select("account_id")
      .eq("profile_id", profileId)
      .order("is_default", { ascending: false })
      .limit(1)
      .maybeSingle();
    accountId = (link as { account_id: string } | null)?.account_id ?? null;
  }

  await svc.from("messages").insert({
    account_id: accountId,
    from_profile_id: profileId,
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
