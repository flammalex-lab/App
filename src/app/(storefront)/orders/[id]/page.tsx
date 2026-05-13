import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import type {
  Account,
  DeliveryZoneRow,
  Order,
  OrderItem,
  Product,
  Profile,
} from "@/lib/supabase/types";
import { StatusBadge } from "@/components/ui/Badge";
import { dateShort, dateLong, money } from "@/lib/utils/format";
import { LineItem } from "@/components/products/LineItem";
import Link from "next/link";
import { OrderPlacedHero } from "./OrderPlacedHero";
import { AmendOrderSheet, type AmendCandidate } from "./AmendOrderSheet";
import { nextDeliveryForZone } from "@/lib/utils/cutoff";
import { BUSINESS_TIMEZONE } from "@/lib/constants";
import { loadPricingContext, priceForProduct } from "@/lib/utils/pricing";
import {
  getAllowedPrivateProductIds,
  visibleProductsQuery,
} from "@/lib/products/queries";

export const metadata = { title: "Order — Fingerlakes Farms" };

export default async function OrderDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ placed?: string; q?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const impersonating = session.profile.role === "admin" ? await getImpersonation() : null;
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

  // ─── Amendability check ─────────────────────────────────────────────
  // Append-only edits are allowed only while the order is still pending
  // AND the cutoff for its delivery/pickup date hasn't fired. Mirrors
  // the server gate in /api/orders/[id]/amend so the buyer never sees
  // a CTA that the server would reject.
  const isPending = o.status === "pending";
  let amendable = false;
  let cutoffAtIso: string | null = null;
  let amendCandidates: AmendCandidate[] = [];
  if (isPending && deliveryIso) {
    const { data: buyerRow } = await db
      .from("profiles")
      .select("*")
      .eq("id", o.profile_id)
      .maybeSingle();
    const buyer = (buyerRow as Profile | null) ?? null;
    let account: Account | null = null;
    if (buyer?.account_id) {
      const { data: acctRow } = await db
        .from("accounts")
        .select("*")
        .eq("id", buyer.account_id)
        .maybeSingle();
      account = (acctRow as Account | null) ?? null;
    }
    let zone: DeliveryZoneRow | null = null;
    if (account?.delivery_zone) {
      const { data: z } = await db
        .from("delivery_zones")
        .select("*")
        .eq("zone", account.delivery_zone)
        .maybeSingle();
      zone = (z as DeliveryZoneRow | null) ?? null;
    }
    let withinCutoff = true;
    if (zone) {
      const now = new Date();
      const nextDel = nextDeliveryForZone(
        zone,
        now,
        BUSINESS_TIMEZONE,
        account?.delivery_days,
      );
      if (!nextDel) {
        withinCutoff = false;
      } else {
        const nextDelIso = isoDateInTz(nextDel.deliveryDate, BUSINESS_TIMEZONE);
        if (nextDelIso > deliveryIso) {
          withinCutoff = false;
        } else if (nextDelIso === deliveryIso) {
          cutoffAtIso = nextDel.cutoffAt.toISOString();
          if (nextDel.cutoffAt.getTime() <= now.getTime()) {
            withinCutoff = false;
          }
        }
      }
    }
    amendable = withinCutoff;

    // Build the sheet's candidate list: the buyer's recent buys (last
    // 21 days), de-duped to one row per product, freshly priced. Same
    // visibility filters as the catalog so a buyer can't try to add a
    // pulled-from-shelves SKU.
    if (amendable && buyer) {
      const isB2B = o.order_type === "b2b";
      const since = new Date();
      since.setDate(since.getDate() - 21);
      const { data: histRows } = await db
        .from("order_items")
        .select("product_id, orders!inner(profile_id, created_at)")
        .eq("orders.profile_id", o.profile_id)
        .gte("orders.created_at", since.toISOString())
        .limit(200);
      const recentIds = Array.from(
        new Set(((histRows as { product_id: string }[] | null) ?? []).map((r) => r.product_id)),
      );
      if (recentIds.length > 0) {
        const allowedPrivateIds = await getAllowedPrivateProductIds(
          db,
          buyer.account_id ?? null,
        );
        const buyerType = buyer.buyer_type ?? account?.buyer_type ?? null;
        const { data: prods } = await visibleProductsQuery(db, {
          buyerType,
          isB2B,
          allowedPrivateIds,
        })
          .in("id", recentIds)
          .eq("available_this_week", true);
        const pricingCtx = await loadPricingContext(db, account, isB2B);
        amendCandidates = ((prods as Product[] | null) ?? [])
          .map((p) => {
            const unitPrice = priceForProduct(p, pricingCtx);
            if (unitPrice == null) return null;
            return {
              productId: p.id,
              name: p.name,
              sku: p.sku ?? null,
              packSize: p.pack_size,
              unit: p.unit,
              unitPrice,
              priceByWeight: Boolean(p.price_by_weight),
            } satisfies AmendCandidate;
          })
          .filter((x): x is AmendCandidate => x !== null)
          .sort((a, b) => a.name.localeCompare(b.name));
      }
    }
  }

  return (
    <div className="max-w-3xl mx-auto pt-3 pb-24">
      {/* Receipt-style top bar — back link */}
      <div className="mb-3">
        <Link
          href="/orders"
          className="inline-flex items-center gap-1 text-[13px] text-ink-secondary hover:text-ink-primary transition-colors duration-150"
        >
          <span aria-hidden>←</span> Orders
        </Link>
      </div>

      {/* Receipt header: order number is the identity, delivery date is the eyebrow.
          Buyers refer to orders by their number ("FLF-2026-0003"); the date is
          context, not identity. */}
      <p className="text-[11px] uppercase tracking-[0.18em] text-ink-tertiary mb-1">
        {o.pickup_date ? "Pickup" : "Delivery"} ·{" "}
        {deliveryIso ? dateShort(deliveryIso) : "—"}
      </p>
      <h1 className="display text-[28px] md:text-[34px] leading-[1.1] tracking-tight text-ink-primary tabular">
        {o.order_number}
      </h1>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
        <StatusBadge status={o.status} />
        {placedBy ? (
          <span className="text-ink-secondary">
            Placed by {placedBy.first_name ?? "—"} · {dateLong(o.created_at)}
          </span>
        ) : null}
      </div>

      {/* Find-in-order */}
      {rows.length > 3 ? (
        <form action="" className="mt-5">
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Find in this order"
            className="input"
          />
        </form>
      ) : null}

      {/* Items header — receipt bookend */}
      <div className="mt-6 mb-1.5 flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-[0.18em] text-ink-tertiary">
          {totalUnits} {totalUnits === 1 ? "unit" : "units"}
        </span>
        <span className="text-[11px] uppercase tracking-[0.18em] text-ink-tertiary">
          Line total
        </span>
      </div>

      <div className="card divide-y divide-black/[0.06] overflow-hidden">
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

      {/* Totals — receipt feel: dotted divider before grand total */}
      <div className="mt-5 px-2 space-y-1.5 text-[14px]">
        <Row label="Subtotal" value={money(o.subtotal)} />
        {o.delivery_fee ? <Row label="Delivery fee" value={money(o.delivery_fee)} /> : null}
        {o.tax ? <Row label="Tax" value={money(o.tax)} /> : null}
        <div className="border-t border-dashed border-black/15 my-2" />
        <Row label="Total" value={money(o.total)} strong />
        {o.customer_notes ? (
          <div className="mt-3 pt-3 border-t border-black/[0.06]">
            <div className="text-[11px] uppercase tracking-wider text-ink-tertiary mb-1">
              Your notes
            </div>
            <p className="text-[13px] text-ink-primary leading-relaxed">
              {o.customer_notes}
            </p>
          </div>
        ) : null}
      </div>

      {/* Append-only amendment CTA — only visible while the order is still
          editable (pending + pre-cutoff). The Reorder action below stays
          available regardless; the two jobs are different. */}
      {amendable ? (
        <div className="mt-5">
          <AmendOrderSheet
            orderId={o.id}
            orderNumber={o.order_number}
            cutoffAtIso={cutoffAtIso}
            candidates={amendCandidates}
          />
        </div>
      ) : null}

      {/* Prominent Reorder CTA — brand-blue per design-system primary token. */}
      <form action={`/api/orders/reorder?orderId=${o.id}`} method="post" className="mt-5">
        <button
          type="submit"
          className="w-full btn-primary py-3.5 text-base font-semibold"
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

/**
 * Render a Date as YYYY-MM-DD in the given IANA timezone. Mirrors the
 * format `orders.requested_delivery_date` / `pickup_date` are stored in
 * so string comparison against `deliveryIso` is safe. Duplicated here
 * (and in /api/orders/[id]/amend) on purpose — the server gate has to
 * use the same shape as the page-side gate, but the page is an RSC and
 * pulling a shared util adds an import-graph risk without paying for
 * itself yet.
 */
function isoDateInTz(d: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "font-semibold text-base pt-1" : ""}`}>
      <span className={strong ? "" : "text-ink-secondary"}>{label}</span>
      <span className="mono">{value}</span>
    </div>
  );
}
