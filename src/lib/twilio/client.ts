/**
 * Thin Twilio wrapper — REST API via fetch, no SDK dependency.
 * Use for outbound SMS. Inbound SMS is handled by a webhook route.
 *
 * Falls back to console-logging when credentials are absent so dev works offline.
 */

export interface SendSmsInput {
  to: string;          // E.164
  body: string;
  from?: string;       // optional override; otherwise Messaging Service
}

export interface SendSmsResult {
  ok: boolean;
  sid?: string;
  error?: string;
  skipped?: boolean;   // dev/no-creds mode
}

export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

  if (!sid || !token || (!messagingServiceSid && !input.from)) {
    console.log("[sms] (dev) →", input.to, input.body.slice(0, 160));
    return { ok: true, skipped: true };
  }

  const body = new URLSearchParams();
  body.set("To", input.to);
  body.set("Body", input.body);
  if (input.from) body.set("From", input.from);
  else body.set("MessagingServiceSid", messagingServiceSid!);

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: `twilio ${res.status}: ${text.slice(0, 300)}` };
  }
  const data = (await res.json()) as { sid?: string };
  return { ok: true, sid: data.sid };
}

/**
 * Validate a Twilio webhook signature (X-Twilio-Signature).
 * See https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
export async function validateTwilioSignature(
  signature: string | null,
  url: string,
  params: Record<string, string>,
): Promise<boolean> {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token || !signature) return false;
  const sortedKeys = Object.keys(params).sort();
  const data = url + sortedKeys.map((k) => k + params[k]).join("");
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(token),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  const expected = Buffer.from(mac).toString("base64");
  return timingSafeEqual(expected, signature);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
