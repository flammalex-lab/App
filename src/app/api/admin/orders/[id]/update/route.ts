import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { enqueueAndSend } from "@/lib/notifications/dispatch";
import type { Order, OrderStatus } from "@/lib/supabase/types";

type PrevOrder = Pick<Order, "status" | "order_number" | "profile_id" | "account_id"> & {
  buyer: { phone: string | null; email: string | null } | null;
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdmin(); } catch { return NextResponse.json({ error: "admin only" }, { status: 403 }); }
  const { id } = await params;
  const { status, internal_notes } = (await request.json()) as {
    status: OrderStatus;
    internal_notes: string | null;
  };
  const svc = createServiceClient();
  const { data: prevRow } = await svc
    .from("orders")
    .select("status, order_number, profile_id, account_id, buyer:profiles!orders_profile_id_fkey(phone, email)")
    .eq("id", id)
    .maybeSingle();
  const prev = prevRow as PrevOrder | null;
  if (!prev) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { error } = await svc.from("orders").update({ status, internal_notes }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fire status notification if changed. Two parallel surfaces:
  // 1. SMS via enqueueAndSend (respects opt-in; skips if off).
  // 2. In-app `messages` row so /chat shows a status bubble even when
  //    SMS is opted out — previously the buyer's chat thread silently
  //    stayed on the original order_placed bubble for the entire
  //    lifecycle.
  if (prev.status !== status) {
    const smsBodies: Record<OrderStatus, string> = {
      draft: "",
      pending: "",
      confirmed: `FLF: order ${prev.order_number} confirmed.`,
      processing: `FLF: order ${prev.order_number} being prepped.`,
      ready: `FLF: order ${prev.order_number} is ready for pickup.`,
      shipped: `FLF: order ${prev.order_number} out for delivery.`,
      delivered: `FLF: order ${prev.order_number} delivered. Thanks!`,
      cancelled: `FLF: order ${prev.order_number} cancelled.`,
    };
    const appBodies: Record<OrderStatus, string> = {
      draft: "",
      pending: "",
      confirmed: `Order ${prev.order_number} confirmed — we're prepping it.`,
      processing: `Order ${prev.order_number} is being prepped for delivery.`,
      ready: `Order ${prev.order_number} is ready for pickup.`,
      shipped: `Order ${prev.order_number} is out for delivery.`,
      delivered: `Order ${prev.order_number} delivered. Thanks!`,
      cancelled: `Order ${prev.order_number} was cancelled.`,
    };
    const appBody = appBodies[status];

    // SMS (best-effort; missing phone = no SMS, but in-app still posts).
    const phone = prev.buyer?.phone;
    if (phone && smsBodies[status]) {
      await enqueueAndSend({
        supabase: svc,
        profileId: prev.profile_id,
        accountId: prev.account_id,
        type: "order_status",
        channel: "sms",
        toAddress: phone,
        body: smsBodies[status],
        relatedOrderId: id,
      });
    }

    // Email parallel — same rationale as in /api/orders/create. A buyer
    // who declined SMS still gets the status update in their inbox.
    const email = prev.buyer?.email;
    const subjectLabels: Record<OrderStatus, string> = {
      draft: "",
      pending: "",
      confirmed: "confirmed",
      processing: "being prepped",
      ready: "ready for pickup",
      shipped: "out for delivery",
      delivered: "delivered",
      cancelled: "cancelled",
    };
    if (email && appBody) {
      await enqueueAndSend({
        supabase: svc,
        profileId: prev.profile_id,
        accountId: prev.account_id,
        type: "order_status",
        channel: "email",
        toAddress: email,
        subject: `Order ${prev.order_number} ${subjectLabels[status] || status} — Fingerlakes Farms`,
        body: appBody,
        relatedOrderId: id,
      });
    }

    // In-app system message — same surface as the order_placed bubble,
    // rendered as a status update pill by ChatClient.
    if (appBody) {
      await svc.from("messages").insert({
        account_id: prev.account_id,
        from_profile_id: null,
        to_profile_id: prev.profile_id,
        body: appBody,
        channel: "app",
        direction: "outbound",
        is_system: true,
        related_order_id: id,
        payload: {
          kind: "order_status",
          order_id: id,
          order_number: prev.order_number,
          status,
        },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
