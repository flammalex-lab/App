import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Order, OrderItem, Product, Account } from "@/lib/supabase/types";
import { StatusBadge } from "@/components/ui/Badge";
import { dateShort, money } from "@/lib/utils/format";
import { OrderStatusForm } from "./OrderStatusForm";

export default async function AdminOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const db = await createClient();
  const { id } = await params;

  const { data: order } = await db.from("orders").select("*, account:accounts(*)").eq("id", id).maybeSingle();
  if (!order) notFound();
  const { data: items } = await db.from("order_items").select("*, product:products(*)").eq("order_id", id);

  const o = order as Order & { account: Account | null };
  const rows = (items as (OrderItem & { product: Product })[] | null) ?? [];

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl mono">{o.order_number}</h1>
          <div className="text-ink-secondary text-sm">{dateShort(o.created_at)} · {o.account?.name ?? "DTC"}</div>
        </div>
        <StatusBadge status={o.status} />
      </div>

      <div className="card mt-4 divide-y divide-black/5">
        {rows.map((r) => (
          <div key={r.id} className="p-3 flex items-center">
            <div className="flex-1">
              <div className="font-medium">{r.product.name}</div>
              <div className="text-xs text-ink-secondary">
                {r.product.pack_size ? `${r.product.pack_size} · ` : ""}
                {r.quantity} × {money(r.unit_price)} / {r.product.unit}
              </div>
              {r.notes ? <div className="text-xs italic mt-1">{r.notes}</div> : null}
            </div>
            <div className="mono text-sm">{money(r.line_total)}</div>
          </div>
        ))}
      </div>

      <div className="card mt-4 p-4 space-y-1 text-sm">
        <Row label="Subtotal" value={money(o.subtotal)} />
        {o.delivery_fee ? <Row label="Delivery" value={money(o.delivery_fee)} /> : null}
        {o.tax ? <Row label="Tax" value={money(o.tax)} /> : null}
        <Row label="Total" value={money(o.total)} strong />
        <div className="divider" />
        <Row label="Payment" value={`${o.payment_method} · ${o.payment_status}`} />
        {o.customer_notes ? <Row label="Customer notes" value={o.customer_notes} /> : null}
        {o.internal_notes ? <Row label="Internal notes" value={o.internal_notes} /> : null}
      </div>

      <OrderStatusForm orderId={o.id} currentStatus={o.status} internalNotes={o.internal_notes ?? ""} />
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "font-semibold" : ""}`}>
      <span className="text-ink-secondary">{label}</span>
      <span className="mono">{value}</span>
    </div>
  );
}
