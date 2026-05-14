import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import { resolveActiveAccount } from "@/lib/auth/active-account";
import type {
  Account,
  DeliveryZoneRow,
  OrderGuide,
  OrderGuideItem,
  Product,
} from "@/lib/supabase/types";
import { GuideClient } from "./GuideClient";
import { loadPricingContext, priceForProduct } from "@/lib/utils/pricing";
import { getBuyerHistory } from "@/lib/products/buyer-history";
import {
  getAllowedPrivateProductIds,
  visibleProductsQuery,
} from "@/lib/products/queries";
import { loadDraftRhythm, type RhythmLine } from "@/lib/products/draft-rhythm";
import {
  nextDeliveryForZone,
  upcomingDeliveriesForZone,
} from "@/lib/utils/cutoff";
import { effectiveOrderMinimum } from "@/lib/utils/order-minimum";
import { BUSINESS_TIMEZONE } from "@/lib/constants";
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

  // ---- Tier 1: launch every independent fetch in parallel.
  // account, default order guide, buyer history (cached), last-order
  // header row, and active-account resolution don't depend on each
  // other — running them serially stacked ~5 sequential round-trips on
  // the critical path. The shape change is purely about parallelism;
  // the queries are unchanged.
  const accountPromise = me.account_id
    ? db.from("accounts").select("*").eq("id", me.account_id).maybeSingle()
    : Promise.resolve({ data: null as Account | null });
  const guideRowsPromise = db
    .from("order_guides")
    .select("*")
    .eq("profile_id", profileId)
    .eq("is_default", true)
    // limit(1) + order by created_at so legacy rows with multiple defaults
    // (pre-0010 dedupe) still resolve deterministically.
    .order("created_at", { ascending: true })
    .limit(1);
  const buyerHistoryPromise = getBuyerHistory(profileId);
  const lastOrderRowPromise = db
    .from("orders")
    .select("id, order_number, total, created_at, requested_delivery_date, pickup_date")
    .eq("profile_id", profileId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  // Active account membership — used to scope SmartShop's "Recent buys"
  // strip so a multi-buyer account sees a joint feed (a sous chef sees
  // what the head chef ordered last week, and vice versa). Same helper
  // as /orders/page.tsx.
  const activeAccountPromise = resolveActiveAccount(profileId, me.account_id);

  const [
    { data: accountRow },
    { data: guideRows },
    buyerHistory,
    { data: lastOrderRow },
    { active },
  ] = await Promise.all([
    accountPromise,
    guideRowsPromise,
    buyerHistoryPromise,
    lastOrderRowPromise,
    activeAccountPromise,
  ]);
  const account = accountRow as Account | null;
  const guide = ((guideRows as OrderGuide[] | null) ?? [])[0] ?? null;

  // ---- Delivery zone — drives the rhythm target weekday + the
  // submit-sheet's date list. Cached one-row read.
  let zone: DeliveryZoneRow | null = null;
  if (account?.delivery_zone) {
    const svc = createServiceClient();
    const { data } = await svc
      .from("delivery_zones")
      .select("*")
      .eq("zone", account.delivery_zone)
      .maybeSingle();
    zone = data as DeliveryZoneRow | null;
  }
  const nextDel = zone
    ? nextDeliveryForZone(zone, new Date(), BUSINESS_TIMEZONE, account?.delivery_days)
    : null;
  const upcomingDeliveries = zone
    ? upcomingDeliveriesForZone(
        zone,
        new Date(),
        BUSINESS_TIMEZONE,
        4,
        account?.delivery_days,
      )
    : [];
  const targetDeliveryDate = nextDel
    ? toIsoDate(nextDel.deliveryDate)
    : null;
  const targetDeliveryDayName = nextDel?.deliveryDayName ?? null;
  const pastCutoff = nextDel?.pastCutoff ?? false;
  const accountMinimum = effectiveOrderMinimum(account, zone);
  const deliveryFee = zone?.delivery_fee ?? 0;

  // ---- Rhythm: last-4-occurrences average qty per product on this
  // delivery weekday. Empty if buyer has no history.
  const rhythm: RhythmLine[] = targetDeliveryDate
    ? await loadDraftRhythm(db, profileId, targetDeliveryDate)
    : [];

  // ---- Tier 2: anything that needed a Tier-1 result.
  // pricingCtx (needs account), guide items (needs guide.id), and the
  // last-order item count (needs lastOrderRow.id) are independent of
  // each other and run in parallel.
  const itemRowsPromise = guide
    ? db
        .from("order_guide_items")
        .select("*, product:products(*)")
        .eq("order_guide_id", guide.id)
        .order("sort_order", { ascending: true })
    : Promise.resolve({ data: null as any });
  const lastOrderCountPromise = lastOrderRow
    ? db
        .from("order_items")
        .select("id", { count: "exact", head: true })
        .eq("order_id", (lastOrderRow as { id: string }).id)
    : Promise.resolve({ count: 0 });

  const [pricingCtx, { data: itemRows }, { count: lastOrderCount }] =
    await Promise.all([
      loadPricingContext(db, account, true),
      itemRowsPromise,
      lastOrderCountPromise,
    ]);

  // ---- Derivations from cached buyer history (no more queries needed).
  // buyerHistory is already aggregated server-side: one row per
  // (product, producer), with qty summed and lastOrderedAt = max(created_at).
  const lastOrderedByProduct: Record<string, string> = {};
  for (const row of buyerHistory) {
    if (!row.lastOrderedAt) continue;
    const existing = lastOrderedByProduct[row.product_id];
    if (!existing || row.lastOrderedAt > existing) {
      lastOrderedByProduct[row.product_id] = row.lastOrderedAt;
    }
  }

  const items: GuideRow[] = (itemRows as any[] | null ?? []).map((row) => {
    const p = row.product as Product;
    const unitPrice = priceForProduct(p, pricingCtx);
    return {
      ...(row as OrderGuideItem),
      product: p,
      unitPrice,
      lastOrderedAt: lastOrderedByProduct[p.id] ?? null,
    };
  });

  // ---- Rhythm hydration -------------------------------------------------
  // Some rhythm products may not appear in the buyer's default order_guide
  // (the buyer ordered them ad-hoc and never pinned them). Fetch those
  // products so the draft can render the row + qty. We trust the rhythm
  // sample — they ordered it within the last few weeks, so it's a real
  // product they care about, not noise.
  const rhythmProductIds = rhythm.map((r) => r.productId);
  const itemProductIds = new Set(items.map((it) => it.product.id));
  const missingRhythmIds = rhythmProductIds.filter((id) => !itemProductIds.has(id));
  if (missingRhythmIds.length) {
    const { data: extraProducts } = await db
      .from("products")
      .select("*")
      .in("id", missingRhythmIds);
    for (const p of (extraProducts as Product[] | null) ?? []) {
      items.push({
        id: `rhythm:${p.id}`,
        order_guide_id: guide?.id ?? "",
        product_id: p.id,
        suggested_qty: null,
        par_levels: null,
        sort_order: 9999,
        product: p,
        unitPrice: priceForProduct(p, pricingCtx),
        lastOrderedAt: lastOrderedByProduct[p.id] ?? null,
      });
    }
  }

  // Quick lookup of rhythm signal per product so the client can render
  // "Usually 3" without re-deriving from cart store.
  const rhythmByProduct: Record<
    string,
    { averageQty: number; mostRecentQty: number; occurrenceCount: number }
  > = {};
  for (const r of rhythm) {
    rhythmByProduct[r.productId] = {
      averageQty: r.averageQty,
      mostRecentQty: r.mostRecentQty,
      occurrenceCount: r.occurrenceCount,
    };
  }

  // ---- Active standing orders (locked-in card above the draft) ----------
  // Render a separate "Already on for {day}" card per the brief. Scope to
  // active+unpaused standing orders matching the target weekday. Hidden
  // when none exist.
  let activeStanding: {
    id: string;
    name: string | null;
    summary: string;
  }[] = [];
  if (targetDeliveryDayName) {
    const dayKey = targetDeliveryDayName; // "Friday", "Tuesday", etc.
    // Resolve "now" once per render so we don't re-read the clock inside
    // the filter loop (the react-hooks/purity rule flags Date.now()
    // inside server-component body code).
    const nowTime = new Date().getTime();
    const svc = createServiceClient();
    const { data: stRows } = await svc
      .from("standing_orders")
      .select("id, name, days_of_week, active, pause_until")
      .eq("profile_id", profileId)
      .eq("active", true);
    const matchingIds: string[] = [];
    for (const r of (stRows as {
      id: string;
      name: string | null;
      days_of_week: string[];
      active: boolean;
      pause_until: string | null;
    }[] | null) ?? []) {
      if (r.pause_until && new Date(r.pause_until).getTime() > nowTime) continue;
      if (!r.days_of_week?.includes(dayKey)) continue;
      matchingIds.push(r.id);
    }
    if (matchingIds.length) {
      const { data: itemsRows } = await svc
        .from("standing_order_items")
        .select("standing_order_id, quantity, product:products(name, unit)")
        .in("standing_order_id", matchingIds);
      const totalByStanding: Record<string, { qty: number; firstName: string }> = {};
      for (const it of (itemsRows as any[] | null) ?? []) {
        const cur = totalByStanding[it.standing_order_id] ?? {
          qty: 0,
          firstName: "",
        };
        cur.qty += Number(it.quantity ?? 0);
        if (!cur.firstName && it.product?.name) cur.firstName = it.product.name;
        totalByStanding[it.standing_order_id] = cur;
      }
      activeStanding = (stRows as { id: string; name: string | null }[]).map(
        (r) => {
          const agg = totalByStanding[r.id];
          if (!agg) return null;
          const unitLabel = agg.qty === 1 ? "unit" : "units";
          const friendly = `${agg.qty} ${unitLabel}${agg.firstName ? ` of ${shortName(agg.firstName)}` : ""}`;
          return {
            id: r.id,
            name: r.name,
            summary: friendly,
          };
        },
      )
      .filter((x): x is { id: string; name: string | null; summary: string } => x !== null);
    }
  }

  const guideProducers = Array.from(
    new Set(
      items
        .map((i) => i.product.producer?.trim())
        .filter((p): p is string => Boolean(p)),
    ),
  );

  const orderedProducers = new Set<string>();
  const orderedProductIds = new Set<string>();
  for (const r of buyerHistory) {
    if (r.product_id) orderedProductIds.add(r.product_id);
    const producer = r.producer?.trim();
    if (producer) orderedProducers.add(producer);
  }

  // ---- Tier 3: globalRank scan (needs guideProducers), the
  // discovery-strip product fetch (needs orderedProducers), and the
  // SmartShop 21-day order-items scan (needs active.id / profileId)
  // are independent of each other — run them together. Plus the
  // private-product allow-list, which we'll need to hydrate the
  // SmartShop strip through visibleProductsQuery.
  // M21: bound the global-rank scan to the last 90 days. We're computing
  // a "popular this season" signal, not all-time history — letting this
  // scan grow unbounded as order_items piles up made it the slowest
  // query on /guide. 90 days covers a full quarter of buying rhythm.
  // Use new Date().getTime() to mirror the existing twentyOneDaysAgo
  // pattern below (react-hooks/purity flags `Date.now()` in render).
  const ninetyDaysAgoIso = new Date(
    new Date().getTime() - 90 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const globalRankPromise = guideProducers.length
    ? db
        .from("order_items")
        .select("quantity, product:products!inner(producer)")
        .in("product.producer", guideProducers)
        .gte("created_at", ninetyDaysAgoIso)
    : Promise.resolve({ data: null as any });

  let newProductsPromise: Promise<{ data: any }>;
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
    newProductsPromise = q as unknown as Promise<{ data: any }>;
  } else {
    newProductsPromise = Promise.resolve({ data: null });
  }

  // SmartShop "Recent buys": distinct products the buyer's active
  // account committed to in the last 21 days. Excludes draft +
  // cancelled — we want what the buyer actually committed to, not
  // abandoned carts. Account-scoped when available; falls back to
  // profile_id for legacy buyers without a profile_accounts link
  // (same pattern as /orders/page.tsx).
  const twentyOneDaysAgo = new Date(
    new Date().getTime() - 21 * 24 * 60 * 60 * 1000,
  ).toISOString();
  let recentItemsQ = db
    .from("order_items")
    .select(
      "product_id, order_id, orders!inner(account_id, profile_id, status, created_at)",
    )
    .in("orders.status", [
      "confirmed",
      "processing",
      "ready",
      "shipped",
      "delivered",
    ])
    .gte("orders.created_at", twentyOneDaysAgo);
  recentItemsQ = active
    ? recentItemsQ.eq("orders.account_id", active.id)
    : recentItemsQ.eq("orders.profile_id", profileId);
  const recentItemsPromise = recentItemsQ;

  const allowedPrivateIdsPromise = getAllowedPrivateProductIds(
    db,
    active?.id ?? account?.id ?? null,
  );

  const [
    { data: allItems },
    { data: newRows },
    { data: recentItemRows },
    allowedPrivateIds,
  ] = await Promise.all([
    globalRankPromise,
    newProductsPromise,
    recentItemsPromise,
    allowedPrivateIdsPromise,
  ]);

  // SmartShop ranking: count of DISTINCT orders a SKU appeared in
  // (NOT total quantity — one bulk order shouldn't drown the rest of
  // the rhythm). Dedupe on (product_id, order_id) so two line items
  // in the same order don't double-count.
  const seenOrderProduct = new Set<string>();
  const ordersPerProduct = new Map<string, number>();
  for (const r of (recentItemRows as
    | { product_id: string; order_id: string }[]
    | null) ?? []) {
    const key = `${r.product_id}::${r.order_id}`;
    if (seenOrderProduct.has(key)) continue;
    seenOrderProduct.add(key);
    ordersPerProduct.set(
      r.product_id,
      (ordersPerProduct.get(r.product_id) ?? 0) + 1,
    );
  }

  // ---- Tier 4: hydrate the SmartShop product IDs through
  // visibleProductsQuery so paused / out-of-scope / disabled SKUs
  // disappear even if they sit in recent history. This must run after
  // Tier 3 because it needs the product IDs.
  let recentBuys: PricedProductLite[] = [];
  const recentIds = Array.from(ordersPerProduct.keys());
  if (recentIds.length) {
    const effectiveBuyerType = me.buyer_type ?? account?.buyer_type ?? null;
    const { data: prodRows } = await visibleProductsQuery(db, {
      buyerType: effectiveBuyerType,
      isB2B: true,
      allowedPrivateIds,
    }).in("id", recentIds);
    const visible = (prodRows as Product[] | null) ?? [];
    // Sort by order-count desc, then name asc (stable). Cap at 12.
    visible.sort((a, b) => {
      const diff =
        (ordersPerProduct.get(b.id) ?? 0) -
        (ordersPerProduct.get(a.id) ?? 0);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name);
    });
    recentBuys = visible.slice(0, 12).map((p) => ({
      ...p,
      unitPrice: priceForProduct(p, pricingCtx),
    }));
  }

  // Product IDs in the buyer's default guide — drives the gold
  // "In guide" badge on discovery + SmartShop strip cards. Derived
  // from the already-loaded guide items, so no extra query.
  const inGuideIds = items.map((r) => r.product.id);

  // ---- Final assembly.
  const buyerProducerRank: Record<string, number> = {};
  const globalProducerRank: Record<string, number> = {};
  if (guideProducers.length) {
    const guideProducerSet = new Set(guideProducers);
    for (const row of buyerHistory) {
      const prod = row.producer?.trim();
      if (!prod || !guideProducerSet.has(prod)) continue;
      buyerProducerRank[prod] =
        (buyerProducerRank[prod] ?? 0) + row.qty;
    }
    for (const r of ((allItems as any[] | null) ?? [])) {
      const prod = r.product?.producer as string | undefined;
      if (!prod) continue;
      globalProducerRank[prod] =
        (globalProducerRank[prod] ?? 0) + Number(r.quantity ?? 0);
    }
  }

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
    lastOrder = {
      id: row.id,
      order_number: row.order_number,
      total: Number(row.total),
      // Item count is no longer rendered in the subtitle (per the new
      // design — order # · delivered date · total), but keep the field
      // around in case future copy tweaks want it.
      item_count: lastOrderCount ?? 0,
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
  const newFromProducers: PricedProductLite[] = ((newRows as Product[] | null) ?? [])
    .slice(0, 12)
    .map((p) => ({ ...p, unitPrice: priceForProduct(p, pricingCtx) }));

  // Time-of-day greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = me.first_name ?? "Chef";

  const accountPaused = account?.status === "inactive" || account?.status === "churned";

  // Buyer-count map for substitute ranking. Buyer's own order count (qty
  // sum) per product — used by DraftLine's `pickSubstitutes` to prefer
  // products the buyer already trusts. Capped at the buyer's history;
  // globalCounts comes from the existing globalRank scan below.
  const buyerProductCounts: Record<string, number> = {};
  for (const row of buyerHistory) {
    if (!row.product_id) continue;
    buyerProductCounts[row.product_id] =
      (buyerProductCounts[row.product_id] ?? 0) + row.qty;
  }

  // No-history empty state: a buyer who's never ordered hits an empty
  // rhythm + empty guide. Show "Let's start your guide" copy.
  const isNoHistoryBuyer = items.length === 0 && rhythm.length === 0;

  return (
    <div className="max-w-screen-xl mx-auto pb-8">
      {/* Personal greeting — single compact line */}
      <div className="pt-1 pb-2 text-xs text-ink-secondary">
        {greeting}, <span className="font-medium text-ink-primary">{firstName}</span>.
      </div>

      {accountPaused ? (
        <div className="mb-3 rounded-lg bg-accent-rust/10 text-[#7a3b1f] px-4 py-3 border border-accent-rust/20">
          <div className="text-[14px] font-medium">Account paused — message Alex</div>
          <p className="text-[12px] text-ink-secondary leading-snug mt-0.5">
            We&apos;ll get you back on rhythm. Lines below are read-only while paused.
          </p>
        </div>
      ) : null}

      {isNoHistoryBuyer ? (
        <EmptyState
          className="card md:mx-0"
          icon={<div className="text-5xl opacity-30">☰</div>}
          title="Let's start your guide"
          body="Browse the catalog and add the items you order each week. After your first order, this page becomes a one-tap draft for next time."
          cta={{ href: "/catalog", label: "Browse the catalog" }}
        />
      ) : (
        <GuideClient
          items={items}
          buyerProducerRank={buyerProducerRank}
          globalProducerRank={globalProducerRank}
          newFromProducers={newFromProducers}
          recentBuys={recentBuys}
          inGuideIds={inGuideIds}
          rhythmByProduct={rhythmByProduct}
          targetDeliveryDate={targetDeliveryDate}
          targetDeliveryDayName={targetDeliveryDayName}
          activeStanding={activeStanding}
          buyerProductCounts={buyerProductCounts}
          accountMinimum={accountMinimum}
          deliveryFee={deliveryFee}
          upcomingDeliveries={upcomingDeliveries}
          lastOrder={lastOrder}
          accountPaused={accountPaused}
          pastCutoff={pastCutoff}
        />
      )}
    </div>
  );
}

/** Convert a Date to a YYYY-MM-DD string in local calendar time. Used for
 *  the rhythm target date — server-side date math always anchors here so
 *  the same wall-clock date the buyer sees is what gets queried. */
function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Truncate a product name for use in a one-line standing-order summary
 *  card. Two-word max keeps the card scannable. */
function shortName(name: string): string {
  const trimmed = name.trim();
  const words = trimmed.split(/\s+/);
  return words.slice(0, 2).join(" ");
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
