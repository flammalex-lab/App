import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import type { Order, OrderItem, Product } from "@/lib/supabase/types";
import { StatusBadge } from "@/components/ui/Badge";
import { dateShort, money } from "@/lib/utils/format";
import Link from "next/link";

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const impersonating = session.profile.role === "admin" ? getImpersonation() : null;
  const db = impersonating ? createServiceClient() : await createClient();
  const { id } = await params;

  const { data: order } = await db.from("orders").select("*").eq("id", id).maybeSingle();
  if (!order) notFound();
  const { data: items } = await db
    .from("order_items")
    .select("*, product:products(*)")
    .eq("order_id", id);

  const o = order as Order;
  const rows = (items as (OrderItem & { product: Product })[] | null) ?? [];

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/orders" className="text-sm text-ink-secondary hover:underline">← Orders</Link>
      <div className="mt-3 flex items-center justify-between">
        <div>
          <h1 className="text-2xl mono">{o.order_number}</h1>
          <div className="text-ink-secondary text-sm">{dateShort(o.created_at)}</div>
        </div>
        <StatusBadge status={o.status} />
      </div>

      <div className="card mt-4 divide-y divide-black/5">
        {rows.map((r) => (
          <div key={r.id} className="p-3 flex items-center gap-3">
            <div className="flex-1">
              <div className="font-medium">{r.product.name}</div>
              <div className="text-xs text-ink-secondary">
                {r.product.pack_size ? `${r.product.pack_size} · ` : ""}
                {r.quantity} × {money(r.unit_price)} / {r.product.unit}
              </div>
              {r.notes ? <div className="text-xs text-ink-secondary italic mt-1">{r.notes}</div> : null}
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
        {o.requested_delivery_date ? <Row label="Delivery date" value={dateShort(o.requested_delivery_date)} /> : null}
        {o.pickup_date ? <Row label="Pickup date" value={dateShort(o.pickup_date)} /> : null}
        {o.customer_notes ? <Row label="Your notes" value={o.customer_notes} /> : null}
      </div>
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
