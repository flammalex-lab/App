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
  // Signatures are *always* required in deployed environments. The
  // ALLOW_UNSIGNED_TWILIO escape hatch is only honored when both NODE_ENV
  // and VERCEL_ENV say we're not on a deploy — refuse it in production /
  // preview / staging even if a misconfigured env var sets it. This
  // prevents the H3 finding from silently reopening on a copy-pasted
  // Vercel env var.
  const isDeployed =
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.VERCEL_ENV === "preview";
  const allowUnsigned = process.env.ALLOW_UNSIGNED_TWILIO === "true" && !isDeployed;
  if (process.env.ALLOW_UNSIGNED_TWILIO === "true" && isDeployed) {
    console.warn(
      "[sms inbound] ALLOW_UNSIGNED_TWILIO=true is set in a deployed environment and will be IGNORED. " +
        "Remove the env var.",
    );
  }
  if (!valid && !allowUnsigned) {
    return new NextResponse("bad signature", { status: 403 });
  }

  const fromPhone = params["From"];
  const body = params["Body"] ?? "";
  const smsSid = params["MessageSid"] ?? params["SmsSid"];

  if (!fromPhone) return twimlOk();
  const svc = createServiceClient();
  // profiles.phone has no unique constraint — two profiles can legitimately
  // share a number (re-registration, admin-created duplicates, DTC+B2B
  // overlap). .maybeSingle() would error on >1 row and silently drop the
  // SMS into triage. Take the oldest matching profile (most likely the
  // long-standing canonical one) and let admin clean up dupes via the
  // sms_triage UI when they show up.
  const { data: profileRows } = await svc
    .from("profiles")
    .select("id, account_id")
    .eq("phone", fromPhone)
    .order("created_at", { ascending: true })
    .limit(1);
  const profile = (profileRows as { id: string; account_id: string | null }[] | null)?.[0] ?? null;

  // Unknown phone — park the message in the sms_triage table so a rep
  // can attach it to a profile by hand, instead of silently dropping.
  if (!profile) {
    const { error: triageErr } = await svc.from("sms_triage").insert({
      from_phone: fromPhone,
      body,
      sms_sid: smsSid,
    });
    if (triageErr) {
      console.error("[sms inbound] sms_triage insert failed:", triageErr.message, "from:", fromPhone);
      // Fallback: if sms_triage is missing (e.g. migration 0020 hasn't
      // been applied yet), still surface the message to admins via the
      // messages table with a null account_id — admin RLS sees it. We
      // include the from_phone in the body so the rep can match by hand.
      //
      // Schema constraints this depends on (all pre-0020):
      //   - messages.account_id     — nullable post-0014_messages_nullable_account.
      //   - messages.from_profile_id — always nullable (0001_init.sql,
      //                                `references profiles(id) on delete set null`,
      //                                no NOT NULL).
      //   - messages.from_phone, messages.sms_sid — both columns exist
      //                                on the original 0001_init.sql
      //                                messages table (text, nullable).
      // So this insert is schema-valid even before 0020 lands.
      const { error: fallbackErr } = await svc.from("messages").insert({
        account_id: null,
        from_profile_id: null,
        body: `[unmatched ${fromPhone}] ${body}`,
        channel: "sms",
        direction: "inbound",
        sms_sid: smsSid,
        from_phone: fromPhone,
      });
      if (fallbackErr) {
        // Both inserts failed — the SMS is about to be lost. Return 500
        // so Twilio retries (Twilio backs off and eventually escalates
        // via the failed-message hook); this is strictly better than
        // returning 200 and dropping silently with only a console log.
        console.error("[sms inbound] messages fallback also failed:", fallbackErr.message);
        return new NextResponse("triage + fallback both failed", { status: 500 });
      }
    }
    return twimlOk();
  }

  // Resolve a destination account: legacy profile.account_id first, then
  // any account this profile is linked to via profile_accounts. Fall back
  // to a profile-scoped null-account thread (migration 0014) so unknown
  // / multi-account / between-accounts messages still reach the rep.
  const profileId = profile.id;
  let accountId = profile.account_id;
  if (!accountId) {
    // Belt-and-suspenders: there's a unique partial index on
    // profile_accounts(profile_id) where is_default=true (migration 0020)
    // so the .limit(1) is only ever returning at most one row. We
    // intentionally avoid .maybeSingle() here — it errors on >1 row,
    // which we never expect, but means a future refactor that drops
    // the .limit(1) would 500 instead of just picking the first match.
    // The created_at tiebreaker is defensive in case the partial index
    // is ever bypassed via a direct service-role write.
    const { data: links } = await svc
      .from("profile_accounts")
      .select("account_id")
      .eq("profile_id", profileId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1);
    const link = (links as { account_id: string }[] | null)?.[0];
    accountId = link?.account_id ?? null;
  }

  const { error: msgErr } = await svc.from("messages").insert({
    account_id: accountId,
    from_profile_id: profileId,
    body,
    channel: "sms",
    direction: "inbound",
    sms_sid: smsSid,
    from_phone: fromPhone,
  });
  if (msgErr) {
    console.error("[sms inbound] messages insert failed:", msgErr.message, "from:", fromPhone);
  }
  return twimlOk();
}

// Empty-but-well-formed TwiML response. Twilio accepts an empty 200 too,
// but a TwiML envelope keeps the response shape consistent across both
// success paths (known + unknown phone) and tells Twilio explicitly
// "no further action".
function twimlOk(): NextResponse {
  return new NextResponse(
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>",
    { headers: { "Content-Type": "text/xml" } },
  );
}
