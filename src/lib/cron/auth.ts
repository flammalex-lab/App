import { NextResponse } from "next/server";

/**
 * Verify a Vercel Cron request. Returns a NextResponse to short-circuit the
 * route if auth fails, or null to continue. In production, a missing
 * CRON_SECRET hard-fails so the endpoint can't be hit anonymously if env
 * vars were forgotten in the deploy. Outside production we allow unsigned
 * requests so local `curl` testing keeps working.
 */
export function verifyCronAuth(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
    }
    return null;
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return null;
}
