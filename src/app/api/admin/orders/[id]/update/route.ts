import { NextResponse, after } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { enqueueAndSend } from "@/lib/notifications/dispatch";
import { trackServer } from "@/lib/analytics/server";
import { notificationUrl } from "@/lib/analytics/notification-click-url";
import type { Order, OrderStatus } from "@/lib/supabase/types";
import { requireSameOrigin } from "@/lib/auth/same-origin";

type PrevOrder = Pick<Order, "status" | "order_number" | "profile_id" | "account_id"> & {
  buyer: { phone: string | null; email: string | null } | null;
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originGate = requireSameOrigin(request);
  if (originGate) return originGate;
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
    void trackServer(svc, {
      event: "order_status_changed",
      profileId: prev.profile_id,
      accountId: prev.account_id,
      properties: {
        order_id: id,
        order_number: prev.order_number,
        from_status: prev.status,
        to_status: status,
      },
    });
    const smsLink = notificationUrl(`/orders/${id}`, {
      name: "order_status",
      transport: "sms",
    });
    const emailLink = notificationUrl(`/orders/${id}`, {
      name: "order_status",
      transport: "email",
    });
    const smsBodies: Record<OrderStatus, string> = {
      draft: "",
      pending: "",
      confirmed: `FLF: order ${prev.order_number} confirmed. View: ${smsLink}`,
      processing: `FLF: order ${prev.order_number} being prepped. View: ${smsLink}`,
      ready: `FLF: order ${prev.order_number} is ready for pickup. View: ${smsLink}`,
      shipped: `FLF: order ${prev.order_number} out for delivery. View: ${smsLink}`,
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

    // SMS + email dispatch is offloaded to `after()` so a slow Twilio or
    // Resend call can't blow the Vercel 10s budget after the orders.update
    // has already succeeded — admin saw a network error on a status change
    // that actually landed. Promise.allSettled so one channel failing
    // doesn't compound; failures land in Vercel logs because the response
    // is already gone.
    const phone = prev.buyer?.phone;
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

    after(async () => {
      const tasks: Promise<unknown>[] = [];
      if (phone && smsBodies[status]) {
        tasks.push(
          enqueueAndSend({
            supabase: svc,
            profileId: prev.profile_id,
            accountId: prev.account_id,
            type: "order_status",
            channel: "sms",
            toAddress: phone,
            body: smsBodies[status],
            relatedOrderId: id,
          }),
        );
      }
      if (email && appBody) {
        tasks.push(
          enqueueAndSend({
            supabase: svc,
            profileId: prev.profile_id,
            accountId: prev.account_id,
            type: "order_status",
            channel: "email",
            toAddress: email,
            subject: `Order ${prev.order_number} ${subjectLabels[status] || status} — Fingerlakes Farms`,
            body: `${appBody}\n\nView your order: ${emailLink}`,
            relatedOrderId: id,
          }),
        );
      }
      const results = await Promise.allSettled(tasks);
      results.forEach((r, i) => {
        if (r.status === "rejected") {
          console.error(
            `[admin/orders/update] notification ${i} for order ${prev.order_number} threw:`,
            r.reason,
          );
        } else if (r.value && typeof r.value === "object" && "ok" in r.value && !(r.value as { ok: boolean }).ok) {
          console.warn(
            `[admin/orders/update] notification ${i} for order ${prev.order_number} not delivered:`,
            (r.value as { error?: string }).error,
          );
        }
      });
    });

    // In-app system message — same surface as the order_placed bubble,
    // rendered as a status update pill by ChatClient. Kept inline (not in
    // after) because the chat UI reads from this row immediately on the
    // admin's redirect back to the order page.
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
