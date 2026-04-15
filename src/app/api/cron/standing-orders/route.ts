import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { computeNextRun } from "@/lib/utils/standing-order";
import { runStandingOrder } from "@/lib/standing-orders/run";
import type { StandingOrder } from "@/lib/supabase/types";

/**
 * Daily cron: find standing orders whose next_run_date ≤ today and execute them.
 * Vercel Cron calls with `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) return NextResponse.json({ error: "forbidden" }, { status: 403 });

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
    const nextRun = computeNextRun(so, new Date());
    await svc.from("standing_orders").update({
      next_run_date: nextRun ? nextRun.toISOString().slice(0, 10) : null,
    }).eq("id", so.id);
    results.push({ id: so.id, ...r });
  }
  return NextResponse.json({ ran: results.length, results });
}
