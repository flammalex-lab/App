import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { enqueueAndSend } from "@/lib/notifications/dispatch";
import type { Account, DeliveryZoneRow } from "@/lib/supabase/types";
import { nextDeliveryForZone } from "@/lib/utils/cutoff";

/**
 * Hourly cron: for each active account, if the cutoff for their next delivery
 * is < 6 hours away and they don't already have a pending order for that
 * delivery, send a reorder nudge to the primary buyer.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const svc = createServiceClient();
  const { data: accounts } = await svc
    .from("accounts")
    .select("id, name, delivery_zone")
    .eq("status", "active")
    .not("delivery_zone", "is", null);
  const { data: zones } = await svc.from("delivery_zones").select("*");
  const zoneById: Record<string, DeliveryZoneRow> = Object.fromEntries(((zones as DeliveryZoneRow[] | null) ?? []).map((z) => [z.zone, z]));

  let sent = 0;
  for (const a of ((accounts as (Account & { delivery_zone: string })[] | null) ?? [])) {
    const zone = zoneById[a.delivery_zone];
    if (!zone) continue;
    const next = nextDeliveryForZone(zone);
    if (!next) continue;
    const hoursToCutoff = next.msUntilCutoff / 3_600_000;
    if (hoursToCutoff > 6 || hoursToCutoff < 0) continue;

    // Skip if they already have a pending order for this delivery date
    const { data: existing } = await svc
      .from("orders")
      .select("id")
      .eq("account_id", a.id)
      .eq("requested_delivery_date", next.deliveryDate.toISOString().slice(0, 10))
      .neq("status", "cancelled")
      .limit(1);
    if ((existing as any[] | null)?.length) continue;

    const { data: buyers } = await svc.from("profiles").select("id, phone").eq("account_id", a.id).limit(1);
    const buyer = (buyers as any[] | null)?.[0];
    if (!buyer?.phone) continue;

    await enqueueAndSend({
      supabase: svc,
      profileId: buyer.id,
      accountId: a.id,
      type: "reorder_prompt",
      channel: "sms",
      toAddress: buyer.phone,
      body: `FLF: cutoff in ${Math.round(hoursToCutoff)}h for ${next.deliveryDayName} delivery. Tap to order → ${process.env.NEXT_PUBLIC_APP_URL}/guide`,
      metadata: { deliveryDate: next.deliveryDate.toISOString() },
    });
    sent++;
  }
  return NextResponse.json({ sent });
}
