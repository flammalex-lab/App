/**
 * Thin Resend wrapper — REST API via fetch, no SDK dependency.
 * Mirrors src/lib/twilio/client.ts so dev / no-key environments
 * fall back to a console log rather than crashing.
 *
 * Buyer-facing email today: order confirmations + status updates,
 * delivered alongside SMS in dispatch.ts. SMS opt-in gates SMS;
 * email is sent independently so a buyer who declines SMS still
 * gets the confirmation paper trail.
 */

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  from?: string;
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
  /** True when RESEND_API_KEY is absent (dev / no-config). */
  skipped?: boolean;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = input.from ?? process.env.RESEND_FROM;

  if (!apiKey || !from) {
    // No-key fallback so local dev and Vercel previews without the
    // secret don't error out. The notification row still gets
    // marked "sent" so downstream code (which uses notifications.status
    // as its only observability signal today) doesn't think we
    // silently failed.
    console.log("[email] (dev) →", input.to, "·", input.subject);
    return { ok: true, skipped: true };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html ?? input.text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    return { ok: false, error: `resend ${res.status}: ${body.slice(0, 300)}` };
  }
  const data = (await res.json().catch(() => ({}))) as { id?: string };
  return { ok: true, id: data.id };
}
