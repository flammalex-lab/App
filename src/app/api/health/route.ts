import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { constantTimeEquals } from "@/lib/utils/crypto-compare";

/**
 * Config health check. Reports which env vars are set (never the values)
 * and whether the database is reachable. Useful for "is my deploy wired up?"
 *
 * Public callers get a minimal `healthy: bool` and the db roundtrip
 * status. The detailed env / counts / hints are only returned to a
 * caller presenting `Authorization: Bearer ${HEALTH_TOKEN}` (defaults
 * to CRON_SECRET so existing monitoring keeps working) so a recon
 * attacker can't enumerate which integrations are wired up.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const secret = process.env.HEALTH_TOKEN ?? process.env.CRON_SECRET ?? null;
  const isAuthorized = !!secret && constantTimeEquals(auth, `Bearer ${secret}`);

  const env = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_APP_URL: !!process.env.NEXT_PUBLIC_APP_URL,
    TWILIO_ACCOUNT_SID: !!process.env.TWILIO_ACCOUNT_SID,
    TWILIO_MESSAGING_SERVICE_SID: !!process.env.TWILIO_MESSAGING_SERVICE_SID,
    STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: !!process.env.STRIPE_WEBHOOK_SECRET,
    CRON_SECRET: !!process.env.CRON_SECRET,
    ACCOUNTING_PROVIDER: process.env.ACCOUNTING_PROVIDER ?? "iif",
  };

  let db: { ok: boolean; error?: string; counts?: Record<string, number> } = { ok: false };
  try {
    const svc = createServiceClient();
    const [{ count: products }, { count: accounts }, { count: zones }] = await Promise.all([
      svc.from("products").select("id", { count: "exact", head: true }),
      svc.from("accounts").select("id", { count: "exact", head: true }),
      svc.from("delivery_zones").select("zone", { count: "exact", head: true }),
    ]);
    db = {
      ok: true,
      counts: {
        products: products ?? 0,
        accounts: accounts ?? 0,
        delivery_zones: zones ?? 0,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    db = { ok: false, error: msg };
  }

  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ] as const;
  const missingRequired = required.filter((k) => !env[k]);
  const healthy = db.ok && missingRequired.length === 0;

  if (!isAuthorized) {
    return NextResponse.json(
      { healthy, db: { ok: db.ok } },
      { status: healthy ? 200 : 503 },
    );
  }

  return NextResponse.json(
    {
      healthy,
      env,
      db,
      missing_required: missingRequired,
      hints: {
        sms_disabled_fallback: !env.TWILIO_ACCOUNT_SID,
        stripe_disabled: !env.STRIPE_SECRET_KEY,
      },
    },
    { status: healthy ? 200 : 503 },
  );
}
