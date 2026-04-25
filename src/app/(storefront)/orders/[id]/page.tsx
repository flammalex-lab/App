import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import type { Order, OrderItem, Product, Profile } from "@/lib/supabase/types";
import { StatusBadge } from "@/components/ui/Badge";
import { dateShort, dateLong, money } from "@/lib/utils/format";
import { LineItem } from "@/components/products/LineItem";
import Link from "next/link";
import { OrderPlacedHero } from "./OrderPlacedHero";

export default async function OrderDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ placed?: string; q?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const impersonating = session.profile.role === "admin" ? getImpersonation() : null;
  const db = impersonating ? createServiceClient() : await createClient();
  const { id } = await params;
  const { placed, q } = await searchParams;

  const { data: order } = await db.from("orders").select("*").eq("id", id).maybeSingle();
  if (!order) notFound();
  const { data: items } = await db
    .from("order_items")
    .select("*, product:products(*)")
    .eq("order_id", id);

  const o = order as Order;
  const rows = (items as (OrderItem & { product: Product })[] | null) ?? [];

  if (placed === "1") {
    return (
      <OrderPlacedHero
        orderNumber={o.order_number}
        deliveryDate={o.requested_delivery_date ?? o.pickup_date ?? null}
        total={o.total}
        orderId={o.id}
      />
    );
  }

  // Placed-by metadata: either the buyer themself, or the rep if admin-submitted
  let placedBy: Profile | null = null;
  if (o.placed_by_id) {
    const { data: pb } = await db.from("profiles").select("*").eq("id", o.placed_by_id).maybeSingle();
    placedBy = (pb as Profile | null) ?? null;
  }
  if (!placedBy) {
    const { data: own } = await db.from("profiles").select("*").eq("id", o.profile_id).maybeSingle();
    placedBy = (own as Profile | null) ?? null;
  }

  const deliveryIso = o.requested_delivery_date ?? o.pickup_date ?? null;
  const qTerm = (q ?? "").trim().toLowerCase();
  const filteredRows = qTerm
    ? rows.filter(
        (r) =>
          r.product.name.toLowerCase().includes(qTerm) ||
          (r.product.sku ?? "").toLowerCase().includes(qTerm) ||
          (r.pack_variant_sku ?? "").toLowerCase().includes(qTerm),
      )
    : rows;

  const totalUnits = rows.reduce((s, r) => s + Number(r.quantity), 0);

  return (
    <div className="max-w-5xl mx-auto pt-3 pb-24">
      <div className="flex items-center justify-between mb-3">
        <Link href="/orders" className="text-sm text-ink-secondary hover:underline">
          ← Orders
        </Link>
        <span className="text-sm text-ink-secondary mono">{o.order_number}</span>
      </div>

      {/* Big delivery / pickup headline, Pepper-style */}
      <h1 className="display text-3xl tracking-tight">
        {o.pickup_date ? "PICKUP" : "DELIVERY"}
        {deliveryIso ? (
          <span className="font-semibold"> on {dateShort(deliveryIso)}</span>
        ) : null}
      </h1>

      <div className="mt-2 flex items-center gap-2 text-sm">
        <StatusBadge status={o.status} />
        {placedBy ? (
          <span className="text-ink-secondary">
            Placed by {placedBy.first_name ?? "—"} on {dateLong(o.created_at)}
          </span>
        ) : null}
      </div>

      {/* Find-in-order */}
      {rows.length > 3 ? (
        <form action="" className="mt-4">
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Find in this order"
            className="input"
          />
        </form>
      ) : null}

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="font-medium">
          {totalUnits} {totalUnits === 1 ? "unit" : "units"}
        </span>
        <span className="mono font-semibold">{money(o.total)}</span>
      </div>

      <div className="card mt-3 divide-y divide-black/5 overflow-hidden">
        {filteredRows.map((r) => (
          <LineItem
            key={r.id}
            data={{
              id: r.id,
              name: r.product.name,
              sku: r.pack_variant_sku ?? r.product.sku ?? null,
              variantLabel: r.pack_variant_key ?? null,
              packSize: r.product.pack_size,
              unit: r.product.unit,
              unitPrice: Number(r.unit_price),
              quantity: Number(r.quantity),
              lineTotal: Number(r.line_total),
              notes: r.notes,
            }}
            mode="history"
          />
        ))}
        {filteredRows.length === 0 ? (
          <div className="p-6 text-center text-sm text-ink-secondary">
            Nothing matches &ldquo;{qTerm}&rdquo;.
          </div>
        ) : null}
      </div>

      <div className="card mt-4 p-4 space-y-1 text-sm">
        <Row label="Subtotal" value={money(o.subtotal)} />
        {o.delivery_fee ? <Row label="Delivery fee" value={money(o.delivery_fee)} /> : null}
        {o.tax ? <Row label="Tax" value={money(o.tax)} /> : null}
        <Row label="Total" value={money(o.total)} strong />
        {o.customer_notes ? (
          <>
            <div className="divider" />
            <Row label="Your notes" value={o.customer_notes} />
          </>
        ) : null}
      </div>

      {/* Prominent Reorder CTA */}
      <form action={`/api/orders/reorder?orderId=${o.id}`} method="post" className="mt-5">
        <button
          type="submit"
          className="w-full bg-ink-primary text-white py-3.5 rounded-lg font-semibold hover:bg-black transition"
        >
          Reorder these items
        </button>
      </form>
      <p className="mt-2 text-[11px] text-center text-ink-tertiary">
        Copies every line into your cart — adjust qtys before submitting.
      </p>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "font-semibold text-base pt-1" : ""}`}>
      <span className={strong ? "" : "text-ink-secondary"}>{label}</span>
      <span className="mono">{value}</span>
    </div>
  );
}
