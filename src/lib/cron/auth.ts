import { NextResponse } from "next/server";
import { constantTimeEquals } from "@/lib/utils/crypto-compare";

/**
 * Verify a Vercel Cron request. Returns a NextResponse to short-circuit the
 * route if auth fails, or null to continue.
 *
 * `CRON_SECRET` is mandatory in *every* environment — leaving it unset on
 * a preview/staging deploy would let any anonymous caller trigger draft
 * orders + SMS, which is exactly the misconfiguration C2 in the audit
 * called out. Local-curl testing should set the secret in `.env.local`
 * (or run with `CRON_SECRET=foo curl …`).
 */
export function verifyCronAuth(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const auth = request.headers.get("authorization") ?? "";
  if (!constantTimeEquals(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return null;
}
