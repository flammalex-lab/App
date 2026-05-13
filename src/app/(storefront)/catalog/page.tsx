import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import { resolveActiveAccount } from "@/lib/auth/active-account";
import type { Product } from "@/lib/supabase/types";
import { loadPricingContext, priceForProduct, type PricingContext } from "@/lib/utils/pricing";
import { getAllowedPrivateProductIds, visibleProductsQuery } from "@/lib/products/queries";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  GROUP_LABELS,
  allowedGroupsFor,
  type ProductGroup,
} from "@/lib/constants";
import { CatalogGrid } from "./CatalogGrid";
import { ScrollStrip } from "./ScrollStrip";
import { SortSheet, type SortKey } from "./SortSheet";
import { CatalogSearchInput } from "./CatalogSearchInput";
import { CategoryChips } from "./CategoryChips";
import { ProducerChips } from "./ProducerChips";
import { BackButton } from "@/components/layout/BackButton";
import { groupBySubCategory } from "@/lib/products/sub-category";
import { compareProducersByRank, rankProducers } from "@/lib/products/producer-rank";

export const metadata = { title: "Catalog — Fingerlakes Farms" };

function priceProducts(
  rows: Product[] | null | undefined,
  ctx: PricingContext,
): (Product & { unitPrice: number | null })[] {
  return (rows ?? []).map((p) => ({ ...p, unitPrice: priceForProduct(p, ctx) }));
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; q?: string; sort?: string; producer?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const impersonating = session.profile.role === "admin" ? await getImpersonation() : null;
  const db = impersonating ? createServiceClient() : await createClient();

  const profileId = impersonating ?? session.userId;
  const { data: me } = await db.from("profiles").select("*").eq("id", profileId).maybeSingle();
  if (!me) redirect("/login");

  const isB2B = me.role === "b2b_buyer";
  const { active } = await resolveActiveAccount(profileId, me.account_id);
  const account = active;

  // Account-scoped pricing inputs (overrides + price-list rows) and the
  // allow-list for any private products. Loaded once and reused across every
  // strip/list query so each render is bounded to a small number of round-trips.
  const [pricingCtx, allowedPrivateIds] = await Promise.all([
    loadPricingContext(db, account, isB2B),
    getAllowedPrivateProductIds(db, account?.id ?? null),
  ]);

  // Buyer's default order-guide product IDs. Used to flag matching cards
  // with the gold "In guide" badge. B2B only — DTC customers don't have
  // a guide. Two cheap round-trips; the second skips entirely when the
  // buyer has no guide row yet.
  const inGuideIds = await loadInGuideIds(db, profileId, isB2B);

  // Per-buyer buyer_type overrides the account's (see migration 0009).
  const effectiveBuyerType = me.buyer_type ?? account?.buyer_type ?? null;
  const allowed = allowedGroupsFor(effectiveBuyerType);
  const sp = await searchParams;
  const groupFilter =
    sp.group && allowed.includes(sp.group as ProductGroup) ? (sp.group as ProductGroup) : null;
  const q = sp.q?.trim() ?? "";
  const sort: SortKey = (["name", "name_desc", "price_asc", "price_desc", "best"].includes(sp.sort ?? "")
    ? (sp.sort as SortKey)
    : "name");
  const producerFilter = sp.producer?.trim() ?? "";
  const isSearching = q.length > 0 || producerFilter.length > 0;
  const isExplore = sp.group === "explore";
  const isBest = sp.group === "best";

  // =====================================================================
  // LANDING: scroll-strip layout (Pepper-style)
  // =====================================================================
  if (!groupFilter && !isSearching && !isExplore && !isBest) {
    // All buyer-facing strip queries share visibleProductsQuery so the
    // is_active / channel / buyer_type / private filter set can never drift.
    const baseOpts = { buyerType: effectiveBuyerType, isB2B, allowedPrivateIds };

    // Strip 1: This week — available_this_week = true
    const { data: weekRows } = await visibleProductsQuery(db, baseOpts)
      .eq("available_this_week", true)
      .order("sort_order", { ascending: true })
      .limit(12);
    const thisWeek = priceProducts(weekRows as Product[] | null, pricingCtx);

    // Strip 2: Based on your order history — top 8 SKUs ordered by this profile
    const { data: historyRows } = await db
      .from("order_items")
      .select("product_id, quantity, orders!inner(profile_id)")
      .eq("orders.profile_id", profileId)
      .limit(200);
    const countByProduct = new Map<string, number>();
    for (const r of (historyRows as any[] | null) ?? []) {
      countByProduct.set(r.product_id, (countByProduct.get(r.product_id) ?? 0) + Number(r.quantity));
    }
    const topIds = Array.from(countByProduct.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id]) => id);
    let history: (Product & { unitPrice: number | null })[] = [];
    if (topIds.length > 0) {
      // Use visibleProductsQuery so previously-ordered products that have
      // since been hidden, moved out of buyer scope, or disabled don't
      // appear as ghosts in the "your history" strip.
      const { data: histProducts } = await visibleProductsQuery(db, baseOpts).in("id", topIds);
      history = priceProducts(histProducts as Product[] | null, pricingCtx);
      // preserve most-ordered order
      history.sort((a, b) => (countByProduct.get(b.id) ?? 0) - (countByProduct.get(a.id) ?? 0));
    }

    // Strip 3: Featured producer — pick the producer with the most products
    const { data: producerRows } = await visibleProductsQuery(db, {
      ...baseOpts,
      select: "producer",
    }).not("producer", "is", null);
    const producerCounts = new Map<string, number>();
    for (const r of (producerRows as { producer: string | null }[] | null) ?? []) {
      if (r.producer) producerCounts.set(r.producer, (producerCounts.get(r.producer) ?? 0) + 1);
    }
    const topProducers = Array.from(producerCounts.entries())
      .filter(([, n]) => n >= 3)
      .sort((a, b) => b[1] - a[1])
      .map(([p]) => p);
    const featuredProducer = topProducers[0] ?? null;
    let featured: (Product & { unitPrice: number | null })[] = [];
    if (featuredProducer) {
      const { data: featRows } = await visibleProductsQuery(db, baseOpts)
        .eq("producer", featuredProducer)
        .order("sort_order", { ascending: true })
        .limit(10);
      featured = priceProducts(featRows as Product[] | null, pricingCtx);
    }

    // Product-name + producer suggestions for the search autocomplete
    const { data: suggestRows } = await visibleProductsQuery(db, {
      ...baseOpts,
      select: "name, producer",
    }).order("name", { ascending: true });
    const suggestions = buildSuggestions(suggestRows);

    // Group counts for the fallback tile grid
    const { data: counts } = await visibleProductsQuery(db, {
      ...baseOpts,
      select: "product_group",
    });

    const groupCounts = allowed
      .map((g) => ({
        group: g,
        count: ((counts as { product_group: string | null }[]) ?? []).filter((p) => p.product_group === g).length,
      }))
      .filter((g) => g.count > 0);

    return (
      <div className="max-w-screen-xl mx-auto pb-8">
        {/* Editorial hero — kept compact for now since it isn't
            interactive. Single full-bleed photo with restrained overlay
            text; will get its own click-through treatment later. */}
        <section className="relative overflow-hidden md:rounded-2xl mb-4 mx-0 md:mx-0">
          <div className="relative aspect-[16/4] md:aspect-[24/5]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/IMG_7794-scaled-3.jpg"
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/30 to-black/10" />
            <div className="absolute inset-x-0 bottom-0 p-3 md:p-5 text-white">
              <p className="display text-lg md:text-2xl tracking-tight leading-tight drop-shadow">
                This week from Fingerlakes Farms
              </p>
              <p className="text-[11px] md:text-sm text-white/85 mt-0.5 drop-shadow">
                Trust our process. Trust your food.
              </p>
            </div>
          </div>
        </section>

        <form action="/catalog" className="mb-3">
          <CatalogSearchInput datalistId="catalog-suggest" />
          <datalist id="catalog-suggest">
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </form>

        <CategoryChips
          groups={groupCounts}
          active={null}
          className="mb-4 "
        />

        <ScrollStrip
          title="This week"
          emoji="🌱"
          subtitle="Fresh off the flyer — available for this delivery."
          products={thisWeek}
          inGuideIds={inGuideIds}
        />

        {history.length > 0 ? (
          <ScrollStrip
            title="Based on your order history"
            products={history}
            inGuideIds={inGuideIds}
          />
        ) : null}

        {featured.length > 0 && featuredProducer ? (
          <ScrollStrip
            title={featuredProducer}
            href={`/catalog?producer=${encodeURIComponent(featuredProducer)}`}
            subtitle="Featured producer"
            products={featured}
            inGuideIds={inGuideIds}
          />
        ) : null}
      </div>
    );
  }

  // =====================================================================
  // LIST VIEW (group / search / producer / explore / best)
  // =====================================================================
  let query = visibleProductsQuery(db, { buyerType: effectiveBuyerType, isB2B, allowedPrivateIds });
  // Group filter: match the primary product_group OR an entry in
  // additional_groups so cross-listed products (e.g. Hawthorne Valley
  // krauts listed in both produce + dairy) surface in either browse.
  if (groupFilter) query = query.or(`product_group.eq.${groupFilter},additional_groups.cs.{${groupFilter}}`);
  if (q) query = query.or(`name.ilike.%${q}%,producer.ilike.%${q}%`);
  if (producerFilter) query = query.ilike("producer", producerFilter);

  if (isBest) query = query.order("sort_order", { ascending: true });
  else if (sort === "price_asc") query = query.order("wholesale_price", { ascending: true, nullsFirst: false });
  else if (sort === "price_desc") query = query.order("wholesale_price", { ascending: false, nullsFirst: false });
  else if (sort === "best") query = query.order("sort_order", { ascending: true });
  else if (sort === "name_desc") query = query.order("name", { ascending: false });
  else query = query.order("name", { ascending: true });

  const { data: products } = await query;

  // Suggestions for the list-view search (same pool the user sees below)
  const { data: suggestRowsList } = await visibleProductsQuery(db, {
    buyerType: effectiveBuyerType,
    isB2B,
    allowedPrivateIds,
    select: "name, producer",
  }).order("name", { ascending: true });
  const suggestionsList = buildSuggestions(suggestRowsList);

  const priced = priceProducts(products as Product[] | null, pricingCtx);

  // Producer chips row — shown on category pages (?group=X) so loyalists
  // can one-tap narrow to a single producer. Stays visible when a producer
  // is already selected so the buyer can toggle it back off via the
  // selected chip. Skipped on search / explore / best to keep those
  // surfaces focused.
  const showProducerChips = Boolean(groupFilter) && !q && !isBest && !isExplore;
  let categoryProducers: string[] = [];
  if (showProducerChips) {
    const { data: producerRows } = await visibleProductsQuery(db, {
      buyerType: effectiveBuyerType,
      isB2B,
      allowedPrivateIds,
      select: "producer",
    })
      .eq("product_group", groupFilter as ProductGroup)
      .not("producer", "is", null);
    const seen = new Set<string>();
    for (const r of (producerRows as { producer: string | null }[] | null) ?? []) {
      const name = r.producer?.trim();
      if (name) seen.add(name);
    }
    const allProducers = Array.from(seen);
    if (allProducers.length > 1) {
      const { buyerRank: pbRank, globalRank: pgRank } = await rankProducers(db, {
        profileId,
        producers: allProducers,
      });
      categoryProducers = allProducers.sort((a, b) =>
        compareProducersByRank(a, b, pbRank, pgRank),
      );
    } else {
      // 0 or 1 producer — ProducerChips will render nothing in this case,
      // but pass the list through anyway for shape consistency.
      categoryProducers = allProducers;
    }
  }

  const headerTitle = producerFilter
    ? producerFilter
    : isExplore
    ? "Explore"
    : isBest
    ? "Best sellers"
    : groupFilter
    ? GROUP_LABELS[groupFilter]
    : `Search “${q}”`;

  // When the user narrowed to a single category (and isn't also searching
  // or filtering by producer), render sub-category sections (Milk / Eggs /
  // Yogurt within Dairy, Beef / Pork / Chicken within Meat, etc.) so
  // browsing-by-item-type leads. Drilling into a producer (?producer=X)
  // still goes to a flat grid via producerFilter.
  const showSubCategorySections =
    Boolean(groupFilter) && !producerFilter && !q && !isBest && !isExplore;

  // Order frequency ranking — applied to every catalog list view (group
  // filter, producer detail, search, explore, best sellers). Sort by:
  //   1. how often THIS buyer has ordered the product (or producer);
  //   2. tie-break by global popularity across all customers;
  //   3. final tie-break alphabetical.
  // Scoped to the products actually returned by the visibility query so
  // the rank lookup stays bounded.
  const buyerProductRank: Record<string, number> = {};
  const globalProductRank: Record<string, number> = {};
  const buyerProducerRank: Record<string, number> = {};
  const globalProducerRank: Record<string, number> = {};
  if (priced.length) {
    const pricedIds = priced.map((p) => p.id);
    const [{ data: myItems }, { data: allItems }] = await Promise.all([
      db
        .from("order_items")
        .select("product_id, quantity, orders!inner(profile_id)")
        .eq("orders.profile_id", profileId)
        .in("product_id", pricedIds),
      db
        .from("order_items")
        .select("product_id, quantity")
        .in("product_id", pricedIds),
    ]);
    for (const r of ((myItems as any[] | null) ?? [])) {
      const pid = r.product_id as string;
      buyerProductRank[pid] = (buyerProductRank[pid] ?? 0) + Number(r.quantity ?? 0);
    }
    for (const r of ((allItems as any[] | null) ?? [])) {
      const pid = r.product_id as string;
      globalProductRank[pid] = (globalProductRank[pid] ?? 0) + Number(r.quantity ?? 0);
    }
    for (const p of priced) {
      const prod = p.producer?.trim();
      if (!prod) continue;
      buyerProducerRank[prod] =
        (buyerProducerRank[prod] ?? 0) + (buyerProductRank[p.id] ?? 0);
      globalProducerRank[prod] =
        (globalProducerRank[prod] ?? 0) + (globalProductRank[p.id] ?? 0);
    }
  }

  function rankProductSort(
    a: { id: string; name: string },
    b: { id: string; name: string },
  ): number {
    const aMine = buyerProductRank[a.id] ?? 0;
    const bMine = buyerProductRank[b.id] ?? 0;
    if (aMine !== bMine) return bMine - aMine;
    const aGlobal = globalProductRank[a.id] ?? 0;
    const bGlobal = globalProductRank[b.id] ?? 0;
    if (aGlobal !== bGlobal) return bGlobal - aGlobal;
    return a.name.localeCompare(b.name);
  }

  // Apply ranking as the default sort. Explicit sort choices (price asc /
  // desc, name desc) still win over ranking when the user has picked them.
  const useRanking = sort === "name" || sort === "best" || isBest;
  if (useRanking) priced.sort(rankProductSort);

  // "Best sellers" should be a curated subset — anything that has actually
  // been ordered at least once (by anyone). Without this filter, the page
  // returns the entire catalog sorted by popularity, which is identical
  // to Explore and the marketing copy ("Most ordered this season") lies.
  const bestSellers = isBest
    ? priced.filter((p) => (globalProductRank[p.id] ?? 0) > 0).slice(0, 60)
    : priced;
  const visibleProducts = isBest ? bestSellers : priced;

  const subCategorySections = showSubCategorySections
    ? groupBySubCategory(visibleProducts)
    : [];
  if (showSubCategorySections) {
    // Sort sections by total buyer-frequency of their contents
    // (most-ordered sub-category first), then global popularity, then
    // alphabetical. Fallback "Other …" buckets are already pinned to the
    // tail by groupBySubCategory itself, so they ride that order.
    function sectionRank(items: { id: string }[]): [number, number] {
      let mine = 0;
      let global = 0;
      for (const it of items) {
        mine += buyerProductRank[it.id] ?? 0;
        global += globalProductRank[it.id] ?? 0;
      }
      return [mine, global];
    }
    subCategorySections.sort((a, b) => {
      const [am, ag] = sectionRank(a.items);
      const [bm, bg] = sectionRank(b.items);
      if (am !== bm) return bm - am;
      if (ag !== bg) return bg - ag;
      return a.subCategory.localeCompare(b.subCategory);
    });
    for (const section of subCategorySections) {
      section.items.sort(rankProductSort);
    }
  }
  const fromGroupLabel = groupFilter ?? (isExplore ? "explore" : isBest ? "best" : null);

  // Producer detail "slides in from the right" with a back button — same
  // pattern as /cart, gives the buyer a clear way back to where they were.
  const isProducerView = Boolean(producerFilter);

  return (
    <div className={`max-w-screen-xl mx-auto pb-8 ${isProducerView ? "animate-slide-in-right" : ""}`}>
      <div className="pt-3">
        {isProducerView ? (
          <BackButton fallbackHref="/catalog" />
        ) : (
          <Link href="/catalog" className="text-xs text-ink-secondary hover:underline">
            ← Catalog
          </Link>
        )}
        {isProducerView ? (
          /* Editorial centered hero — Baldor-style "IN SEASON NOW / From X"
             treatment. Uppercase eyebrow above, big display name, count
             below. The back button stays at the top-left for navigation. */
          <div className="text-center my-6 md:my-10">
            <p className="text-[11px] uppercase tracking-[0.2em] text-ink-tertiary mb-2">
              All items from
            </p>
            <h1 className="display text-3xl md:text-5xl tracking-tight leading-[1.05]">
              {producerFilter}
            </h1>
            <p className="text-[13px] text-ink-secondary mt-3">
              {visibleProducts.length} {visibleProducts.length === 1 ? "item" : "items"}
            </p>
          </div>
        ) : (
          <h1 className="display text-xl mt-1 mb-1">{headerTitle}</h1>
        )}
        {!producerFilter ? (
          <CategoryChips
            groups={allowed.map((g) => ({ group: g }))}
            active={(groupFilter as ProductGroup | null) ?? (isExplore ? "explore" : isBest ? "best" : null)}
            className="mb-3"
          />
        ) : null}
        {showProducerChips && groupFilter ? (
          <ProducerChips
            group={groupFilter}
            producers={categoryProducers}
            selected={producerFilter || null}
            className="mb-3"
          />
        ) : null}
        <form action="/catalog" className="mb-3 flex gap-2">
          <CatalogSearchInput
            defaultValue={q}
            placeholder="Search name or farm"
            datalistId="catalog-suggest-list"
          />
          <datalist id="catalog-suggest-list">
            {suggestionsList.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          {groupFilter ? <input type="hidden" name="group" value={groupFilter} /> : null}
          <button className="btn-secondary text-sm">Search</button>
        </form>

        {!isBest && !showSubCategorySections ? (
          <div className="flex items-center gap-2 mb-4">
            <SortSheet current={sort} />
          </div>
        ) : null}
      </div>

      {visibleProducts.length === 0 ? (
        <EmptyState
          title={isBest ? "No best sellers yet" : "No products match"}
          body={isBest ? "Order history is still building — check back in a few weeks." : "Try a different search or clear filters."}
        />
      ) : showSubCategorySections ? (
        <div className="md:px-0 space-y-1">
          {subCategorySections.map(({ subCategory, items }) => (
            <ScrollStrip
              key={subCategory}
              title={subCategory}
              products={items}
              inGuideIds={inGuideIds}
            />
          ))}
        </div>
      ) : (
        <CatalogGrid
          products={visibleProducts}
          fromGroup={fromGroupLabel}
          inGuideIds={inGuideIds}
        />
      )}
    </div>
  );
}

/**
 * Returns the set of product IDs in the active buyer's default order
 * guide. Empty set for DTC customers (no guide concept) or any buyer
 * who hasn't been onboarded with a guide yet.
 */
async function loadInGuideIds(
  db: Awaited<ReturnType<typeof createClient>>,
  profileId: string,
  isB2B: boolean,
): Promise<ReadonlySet<string>> {
  if (!isB2B) return new Set();
  const { data: guideRows } = await db
    .from("order_guides")
    .select("id")
    .eq("profile_id", profileId)
    .eq("is_default", true)
    .order("created_at", { ascending: true })
    .limit(1);
  const guideId = ((guideRows as { id: string }[] | null) ?? [])[0]?.id;
  if (!guideId) return new Set();
  const { data: items } = await db
    .from("order_guide_items")
    .select("product_id")
    .eq("order_guide_id", guideId);
  return new Set(
    ((items as { product_id: string }[] | null) ?? []).map((i) => i.product_id),
  );
}

/**
 * Dedupe product names + producer names for datalist autocomplete.
 * Keeps the list under ~500 entries so the rendered datalist stays snappy.
 */
function buildSuggestions(
  rows: { name: string | null; producer: string | null }[] | null,
): string[] {
  const set = new Set<string>();
  for (const r of rows ?? []) {
    if (r.name) set.add(r.name);
    if (r.producer) set.add(r.producer);
  }
  return Array.from(set).slice(0, 500);
}
