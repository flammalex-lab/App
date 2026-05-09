import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { enqueueAndSend } from "@/lib/notifications/dispatch";
import type { Order, OrderStatus } from "@/lib/supabase/types";

type PrevOrder = Pick<Order, "status" | "order_number" | "profile_id" | "account_id"> & {
  buyer: { phone: string | null } | null;
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
    .select("status, order_number, profile_id, account_id, buyer:profiles!orders_profile_id_fkey(phone)")
    .eq("id", id)
    .maybeSingle();
  const prev = prevRow as PrevOrder | null;
  if (!prev) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { error } = await svc.from("orders").update({ status, internal_notes }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fire status notification if changed
  if (prev.status !== status) {
    const phone = prev.buyer?.phone;
    if (phone) {
      const messages: Record<OrderStatus, string> = {
        draft: "",
        pending: "",
        confirmed: `FLF: order ${prev.order_number} confirmed.`,
        processing: `FLF: order ${prev.order_number} being prepped.`,
        ready: `FLF: order ${prev.order_number} is ready for pickup.`,
        shipped: `FLF: order ${prev.order_number} out for delivery.`,
        delivered: `FLF: order ${prev.order_number} delivered. Thanks!`,
        cancelled: `FLF: order ${prev.order_number} cancelled.`,
      };
      const body = messages[status];
      if (body) {
        await enqueueAndSend({
          supabase: svc,
          profileId: prev.profile_id,
          accountId: prev.account_id,
          type: "order_status",
          channel: "sms",
          toAddress: phone,
          body,
          relatedOrderId: id,
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
