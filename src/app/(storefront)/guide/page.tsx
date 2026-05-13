import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import type {
  Account,
  OrderGuide,
  OrderGuideItem,
  Product,
} from "@/lib/supabase/types";
import { GuideClient } from "./GuideClient";
import { ReorderLastCard } from "./ReorderLastCard";
import { loadPricingContext, priceForProduct } from "@/lib/utils/pricing";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "Order guide — Fingerlakes Farms" };

export default async function GuidePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const impersonating = session.profile.role === "admin" ? await getImpersonation() : null;
  const profileId = impersonating ?? session.userId;
  const db = impersonating ? createServiceClient() : await createClient();

  const { data: me } = await db.from("profiles").select("*").eq("id", profileId).maybeSingle();
  if (!me || me.role === "admin") redirect("/dashboard");
  if (me.role === "dtc_customer") redirect("/catalog");

  const { data: accountRow } = me.account_id
    ? await db.from("accounts").select("*").eq("id", me.account_id).maybeSingle()
    : { data: null as Account | null };
  const account = accountRow as Account | null;

  // Default order guide. Use limit(1) + order by created_at so legacy rows
  // with multiple defaults (pre-0010 dedupe) still resolve deterministically.
  const { data: guideRows } = await db
    .from("order_guides")
    .select("*")
    .eq("profile_id", profileId)
    .eq("is_default", true)
    .order("created_at", { ascending: true })
    .limit(1);
  const guide = ((guideRows as OrderGuide[] | null) ?? [])[0] ?? null;

  // Pricing context — used by both the guide-items mapping and the
  // "New from your producers" strip below. Load once.
  const pricingCtx = await loadPricingContext(db, account, true);

  let items: GuideRow[] = [];
  if (guide) {
    const { data: itemRows } = await db
      .from("order_guide_items")
      .select("*, product:products(*)")
      .eq("order_guide_id", guide.id)
      .order("sort_order", { ascending: true });

    // Last-ordered lookup — find the most recent order_items row for each product
    // by this buyer. Cheap for now, bounded by the size of the guide.
    const productIds = (itemRows as any[] | null ?? []).map((r) => r.product_id);
    const lastOrderedByProduct: Record<string, string> = {};
    if (productIds.length) {
      const { data: recentItems } = await db
        .from("order_items")
        .select("product_id, order:orders!inner(profile_id, created_at)")
        .eq("order.profile_id", profileId)
        .in("product_id", productIds);
      for (const row of ((recentItems as any[] | null) ?? [])) {
        const pid = row.product_id as string;
        const ts = row.order?.created_at as string;
        if (!ts) continue;
        if (!lastOrderedByProduct[pid] || ts > lastOrderedByProduct[pid]) {
          lastOrderedByProduct[pid] = ts;
        }
      }
    }

    items = (itemRows as any[] | null ?? []).map((row) => {
      const p = row.product as Product;
      const unitPrice = priceForProduct(p, pricingCtx);
      return {
        ...(row as OrderGuideItem),
        product: p,
        unitPrice,
        lastOrderedAt: lastOrderedByProduct[p.id] ?? null,
      };
    });
  }

  // Per-producer order frequency ranking. Sort the guide's producer
  // sections by:
  //   1. how often THIS buyer has ordered from each producer (sum of
  //      quantities across all their order_items for products of that
  //      producer);
  //   2. tie-break (and producers never ordered) by overall popularity
  //      across all customers.
  // Both maps are passed to GuideClient as sort hints.
  const buyerProducerRank: Record<string, number> = {};
  const globalProducerRank: Record<string, number> = {};
  if (items.length) {
    const guideProducers = Array.from(
      new Set(
        items
          .map((i) => i.product.producer?.trim())
          .filter((p): p is string => Boolean(p)),
      ),
    );
    if (guideProducers.length) {
      // Buyer's own order frequency per producer
      const { data: myItems } = await db
        .from("order_items")
        .select("quantity, product:products!inner(producer), orders!inner(profile_id)")
        .eq("orders.profile_id", profileId)
        .in("product.producer", guideProducers);
      for (const r of ((myItems as any[] | null) ?? [])) {
        const prod = r.product?.producer as string | undefined;
        if (!prod) continue;
        buyerProducerRank[prod] =
          (buyerProducerRank[prod] ?? 0) + Number(r.quantity ?? 0);
      }
      // Global popularity per producer (anyone, any time)
      const { data: allItems } = await db
        .from("order_items")
        .select("quantity, product:products!inner(producer)")
        .in("product.producer", guideProducers);
      for (const r of ((allItems as any[] | null) ?? [])) {
        const prod = r.product?.producer as string | undefined;
        if (!prod) continue;
        globalProducerRank[prod] =
          (globalProducerRank[prod] ?? 0) + Number(r.quantity ?? 0);
      }
    }
  }

  // Latest order to power "reorder last" card
  const { data: lastOrderRow } = await db
    .from("orders")
    .select("id, order_number, total, created_at, requested_delivery_date, pickup_date")
    .eq("profile_id", profileId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  let lastOrder: {
    id: string;
    order_number: string;
    total: number;
    item_count: number;
    deliveryLabel: string | null;
  } | null = null;
  if (lastOrderRow) {
    const row = lastOrderRow as {
      id: string;
      order_number: string;
      total: number;
      created_at: string;
      requested_delivery_date: string | null;
      pickup_date: string | null;
    };
    // Item count is no longer rendered in the subtitle (per the new
    // design — order # · delivered date · total), but keep the field
    // around in case future copy tweaks want it.
    const { count } = await db
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("order_id", row.id);
    lastOrder = {
      id: row.id,
      order_number: row.order_number,
      total: Number(row.total),
      item_count: count ?? 0,
      deliveryLabel: formatDeliveryLabel(
        row.requested_delivery_date ?? row.pickup_date,
      ),
    };
  }

  // ---- "New from your producers" -----------------------------------------
  // Discovery strip at the bottom of /guide. Surface products from
  // producers the buyer already orders from, but that they have never
  // ordered themselves. Bounded to ~12 for the horizontal strip; hidden
  // entirely when empty (no "no results" meta-state on discovery).
  let newFromProducers: PricedProductLite[] = [];
  {
    // Buyer's full order history — distinct producers and distinct
    // product_ids. One round-trip via inner joins on the orders table to
    // scope by profile_id.
    const { data: historyRows } = await db
      .from("order_items")
      .select("product_id, product:products!inner(producer), orders!inner(profile_id)")
      .eq("orders.profile_id", profileId);

    const orderedProducers = new Set<string>();
    const orderedProductIds = new Set<string>();
    for (const r of ((historyRows as any[] | null) ?? [])) {
      const pid = r.product_id as string | undefined;
      const producer = r.product?.producer as string | undefined;
      if (pid) orderedProductIds.add(pid);
      if (producer) orderedProducers.add(producer.trim());
    }

    if (orderedProducers.size) {
      let q = db
        .from("products")
        .select("*")
        .in("producer", Array.from(orderedProducers))
        .eq("is_active", true)
        .eq("available_b2b", true)
        .eq("available_this_week", true)
        .order("producer", { ascending: true })
        .order("name", { ascending: true })
        .limit(24); // small overfetch — we filter ordered-already in JS
      if (orderedProductIds.size) {
        // PostgREST "not in" needs a parenthesised list — using .not is
        // the supported builder path for that.
        q = q.not("id", "in", `(${Array.from(orderedProductIds).join(",")})`);
      }
      const { data: newRows } = await q;
      newFromProducers = ((newRows as Product[] | null) ?? [])
        .slice(0, 12)
        .map((p) => ({ ...p, unitPrice: priceForProduct(p, pricingCtx) }));
    }
  }

  // Time-of-day greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = me.first_name ?? "Chef";

  return (
    <div className="max-w-screen-xl mx-auto pb-8">
      {/* Personal greeting — single compact line */}
      <div className="pt-1 pb-2 text-xs text-ink-secondary">
        {greeting}, <span className="font-medium text-ink-primary">{firstName}</span>.
      </div>

      {/* Reorder-last card — brand-blue primary surface, client-side
          hidden when the cart has items (would conflict with active edit). */}
      {lastOrder ? <ReorderLastCard lastOrder={lastOrder} /> : null}

      {items.length === 0 ? (
        <EmptyState
          className="card md:mx-0"
          icon={<div className="text-5xl opacity-30">☰</div>}
          title="Nothing in your guide yet"
          body="Your rep will build this for you based on what you order. You can also browse the catalog and add items yourself."
          cta={{ href: "/catalog", label: "Browse the catalog" }}
        />
      ) : (
        <GuideClient
          items={items}
          buyerProducerRank={buyerProducerRank}
          globalProducerRank={globalProducerRank}
          newFromProducers={newFromProducers}
        />
      )}
    </div>
  );
}

/** Pre-formatted weekday + month + day for the Reorder card subtitle.
 *  Date-only strings (YYYY-MM-DD) are local-calendar dates — parse them
 *  the same way `lib/utils/format` does so a 2026-05-01 delivery shows
 *  as "Fri May 1" in upstate NY, not Thursday in a negative-offset TZ. */
function formatDeliveryLabel(d: string | null | undefined): string | null {
  if (!d) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.exec(d);
  const parsed = dateOnly
    ? (() => {
        const [y, m, day] = d.split("-").map(Number);
        return new Date(y, m - 1, day);
      })()
    : new Date(d);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Lite priced-product shape passed from the server fetch to the client
 *  strip. Matches `PricedProduct` from `components/products/ProductCard`. */
export type PricedProductLite = Product & { unitPrice: number | null };

export type GuideRow = OrderGuideItem & {
  product: Product;
  unitPrice: number | null;
  lastOrderedAt: string | null;
};
