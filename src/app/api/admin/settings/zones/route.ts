import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try { await requireAdmin(); } catch { return NextResponse.json({ error: "admin only" }, { status: 403 }); }
  const zone = await request.json();
  const svc = createServiceClient();
  const { error } = await svc
    .from("delivery_zones")
    .update({
      order_minimum: zone.order_minimum,
      cutoff_hours_before_delivery: zone.cutoff_hours_before_delivery,
      delivery_days: zone.delivery_days,
    })
    .eq("zone", zone.zone);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
