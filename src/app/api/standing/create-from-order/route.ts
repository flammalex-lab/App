import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getImpersonation } from "@/lib/auth/impersonation";
import { createServiceClient } from "@/lib/supabase/server";
import { requireSameOrigin } from "@/lib/auth/same-origin";
import { createStandingOrderFromOrder } from "@/lib/standing-orders/create-from-order";
import type { Order, StandingFreq } from "@/lib/supabase/types";

interface Body {
  orderId: string;
  daysOfWeek: string[];
  cadence?: StandingFreq;
}

/**
 * POST /api/standing/create-from-order
 *
 * Spin up a recurring standing order from an existing one-shot order.
 * Authorized to the order's owner (or an admin/impersonator) — service
 * client is fine because we re-check ownership in code.
 *
 * Idempotent: a standing order created from a given source order is
 * traceable via standing_orders.name (we stamp the source order_number
 * into it). A repeat POST returns the existing standing order id.
 */
export async function POST(request: Request) {
  const originGate = requireSameOrigin(request);
  if (originGate) return originGate;

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || typeof body.orderId !== "string") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!Array.isArray(body.daysOfWeek)) {
    return NextResponse.json({ error: "daysOfWeek required" }, { status: 400 });
  }

  const isAdmin = session.profile.role === "admin";
  const impersonating = isAdmin ? await getImpersonation() : null;
  const actingAsId = impersonating ?? session.userId;

  const svc = createServiceClient();
  const { data: orderRow } = await svc
    .from("orders")
    .select("*")
    .eq("id", body.orderId)
    .maybeSingle();
  if (!orderRow) return NextResponse.json({ error: "order not found" }, { status: 404 });
  const order = orderRow as Order;

  // Authorize: the buyer who placed (or owns) the order, or an admin
  // (including an admin impersonating the buyer). Mirrors the gate on
  // /api/standing/[id]/route.ts.
  if (order.profile_id !== actingAsId && !isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const cadence: StandingFreq = body.cadence === "biweekly" ? "biweekly" : "weekly";

  const result = await createStandingOrderFromOrder(svc, {
    sourceOrder: order,
    daysOfWeek: body.daysOfWeek,
    cadence,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    ok: true,
    id: result.standingOrderId,
    created: result.created,
  });
}
