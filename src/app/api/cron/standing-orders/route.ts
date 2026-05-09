import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { computeNextRun } from "@/lib/utils/standing-order";
import { runStandingOrder } from "@/lib/standing-orders/run";
import { verifyCronAuth } from "@/lib/cron/auth";
import type { StandingOrder } from "@/lib/supabase/types";

/**
 * Daily cron: find standing orders whose next_run_date ≤ today and execute them.
 * Vercel Cron calls with `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(request: Request) {
  const denied = verifyCronAuth(request);
  if (denied) return denied;

  const svc = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await svc
    .from("standing_orders")
    .select("*")
    .eq("active", true)
    .lte("next_run_date", today);

  const results = [];
  for (const so of ((data as StandingOrder[] | null) ?? [])) {
    const r = await runStandingOrder(svc, so.id);
    if (r.ok) {
      const nextRun = computeNextRun(so, new Date());
      await svc.from("standing_orders").update({
        next_run_date: nextRun ? nextRun.toISOString().slice(0, 10) : null,
      }).eq("id", so.id);
    } else if (so.account_id) {
      // Failed run: leave next_run_date alone so it retries tomorrow, and
      // surface the failure in the account thread so the rep notices instead
      // of silently skipping a cycle.
      await svc.from("messages").insert({
        account_id: so.account_id,
        from_profile_id: null,
        to_profile_id: null,
        body: `Standing order didn't run today — ${r.error}. Will retry tomorrow.`,
        channel: "app",
        direction: "outbound",
        is_system: true,
      });
    }
    results.push({ id: so.id, ...r });
  }
  return NextResponse.json({ ran: results.length, results });
}
