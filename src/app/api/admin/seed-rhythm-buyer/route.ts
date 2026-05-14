import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { requireSameOrigin } from "@/lib/auth/same-origin";
import { seedRhythmBuyer, BUYER_EMAIL, BUYER_PASSWORD } from "@/lib/seed/rhythm-buyer";

/**
 * Admin-only seed endpoint to spin up a dummy B2B buyer with 4 Fridays
 * of order history. Used for demoing /guide's rhythm-driven draft
 * against the live database without needing local CLI access.
 *
 * Idempotent on the buyer/account; recreates the 4 historical orders
 * every call so the rolling 4-Friday window stays current.
 *
 * Hit from an authenticated admin browser session:
 *
 *   fetch('/api/admin/seed-rhythm-buyer', { method: 'POST' })
 *     .then(r => r.json()).then(console.log)
 */
export async function POST(request: Request) {
  const originGate = requireSameOrigin(request);
  if (originGate) return originGate;
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }
  const svc = createServiceClient();
  try {
    const result = await seedRhythmBuyer(svc);
    return NextResponse.json({
      ok: true,
      email: BUYER_EMAIL,
      password: BUYER_PASSWORD,
      ...result,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
