import Link from "next/link";
import Image from "next/image";
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
  allowedCategoriesFor,
  allowedGroupsFor,
  type ProductGroup,
} from "@/lib/constants";
import { CatalogGrid } from "./CatalogGrid";
import { ScrollStrip } from "./ScrollStrip";
import { SortSheet, type SortKey } from "./SortSheet";
import { CatalogSearchInput } from "./CatalogSearchInput";
import { CategoryChips } from "./CategoryChips";
import { ProducerChips } from "./ProducerChips";
import { StockUpButton } from "./StockUpButton";
import { BackButton } from "@/components/layout/BackButton";
import { groupBySubCategory, subCategoryOf } from "@/lib/products/sub-category";
import { compareProducersByRank, rankProducers } from "@/lib/products/producer-rank";
import { getBuyerHistory } from "@/lib/products/buyer-history";
import { getCatalogSuggestions } from "@/lib/products/suggestions";

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
  searchParams: Promise<{
    group?: string;
    q?: string;
    sort?: string;
    producer?: string;
    subCategory?: string;
  }>;
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

  // Account-scoped pricing inputs (overrides + price-list rows), the
  // allow-list for any private products, the buyer's default
  // order-guide product IDs (B2B "In guide" badge), and the buyer's
  // aggregated order history. All four are independent — running them
  // in one Promise.all collapses four round-trips into one. buyerHistory
  // is cached in Vercel's data cache per-buyer (see lib/products/
  // buyer-history.ts), so this is usually a cheap memory lookup.
  const [pricingCtx, allowedPrivateIds, inGuideIds, buyerHistory] =
    await Promise.all([
      loadPricingContext(db, account, isB2B),
      getAllowedPrivateProductIds(db, account?.id ?? null),
      loadInGuideIds(db, profileId, isB2B),
      getBuyerHistory(profileId),
    ]);

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
  const subCategoryFilter = sp.subCategory?.trim() ?? "";
  const isSearching = q.length > 0 || producerFilter.length > 0;
  const isExplore = sp.group === "explore";
  const isBest = sp.group === "best";
  // Sub-category drill-in (e.g. /catalog?group=dairy&subCategory=Milk)
  // gates on a real group filter — without a parent group we can't be
  // sure which sub_category bucket the value belongs to.
  const isSubCategoryView = Boolean(groupFilter) && subCategoryFilter.length > 0;

  // =====================================================================
  // LANDING: scroll-strip layout (Pepper-style)
  // =====================================================================
  if (!groupFilter && !isSearching && !isExplore && !isBest) {
    // All buyer-facing strip queries share visibleProductsQuery so the
    // is_active / channel / buyer_type / private filter set can never drift.
    const baseOpts = { buyerType: effectiveBuyerType, isB2B, allowedPrivateIds };

    // ---- Tier A: 4 independent queries kicked off in parallel.
    // Suggestions are pulled from a cached helper (separate from this
    // tier) so the datalist content survives across navigations until
    // an admin product/allowlist write invalidates it.
    const [
      { data: weekRows },
      { data: producerRows },
      { data: counts },
      suggestions,
    ] = await Promise.all([
      // Strip 1: This week
      visibleProductsQuery(db, baseOpts)
        .eq("available_this_week", true)
        .order("sort_order", { ascending: true })
        .limit(12),
      // Strip 3 (first half): producer counts for featured-producer pick
      visibleProductsQuery(db, { ...baseOpts, select: "producer" }).not(
        "producer",
        "is",
        null,
      ),
      // Group counts for the fallback tile grid
      visibleProductsQuery(db, { ...baseOpts, select: "product_group" }),
      // Search autocomplete suggestions — Vercel data cache
      getCatalogSuggestions({
        buyerType: effectiveBuyerType,
        isB2B,
        allowedPrivateIds,
      }),
    ]);

    const thisWeek = priceProducts(weekRows as Product[] | null, pricingCtx);

    // Strip 2 derivation: top SKUs from buyer's cached, pre-aggregated
    // history. One row per (product, producer) — just project to a
    // product-id → qty map.
    const countByProduct = new Map<string, number>();
    for (const r of buyerHistory) {
      countByProduct.set(r.product_id, (countByProduct.get(r.product_id) ?? 0) + r.qty);
    }
    const topIds = Array.from(countByProduct.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id]) => id);

    // Strip 3 derivation: pick the producer with the most products
    const producerCounts = new Map<string, number>();
    for (const r of (producerRows as { producer: string | null }[] | null) ?? []) {
      if (r.producer) producerCounts.set(r.producer, (producerCounts.get(r.producer) ?? 0) + 1);
    }
    const topProducers = Array.from(producerCounts.entries())
      .filter(([, n]) => n >= 3)
      .sort((a, b) => b[1] - a[1])
      .map(([p]) => p);
    const featuredProducer = topProducers[0] ?? null;

    // ---- Tier B: 2 dependent fetches — also independent of each other.
    // history strip needs topIds; featured strip needs featuredProducer.
    const [
      { data: histProducts },
      { data: featRows },
    ] = await Promise.all([
      topIds.length > 0
        ? visibleProductsQuery(db, baseOpts).in("id", topIds)
        : Promise.resolve({ data: null }),
      featuredProducer
        ? visibleProductsQuery(db, baseOpts)
            .eq("producer", featuredProducer)
            .order("sort_order", { ascending: true })
            .limit(10)
        : Promise.resolve({ data: null }),
    ]);

    // Use visibleProductsQuery so previously-ordered products that have
    // since been hidden, moved out of buyer scope, or disabled don't
    // appear as ghosts in the "your history" strip.
    let history: (Product & { unitPrice: number | null })[] = [];
    if (histProducts) {
      history = priceProducts(histProducts as Product[] | null, pricingCtx);
      // preserve most-ordered order
      history.sort((a, b) => (countByProduct.get(b.id) ?? 0) - (countByProduct.get(a.id) ?? 0));
    }

    const featured: (Product & { unitPrice: number | null })[] = featRows
      ? priceProducts(featRows as Product[] | null, pricingCtx)
      : [];

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
            {/* M23: next/image with fill + priority — LCP candidate on the
                catalog landing, so eager-load + use the image optimizer. */}
            <Image
              src="/images/IMG_7794-scaled-3.jpg"
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover"
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
          href="/catalog?group=explore"
          subtitle="Fresh off the flyer — available for this delivery."
          products={thisWeek}
          inGuideIds={inGuideIds}
        />

        {history.length > 0 ? (
          <ScrollStrip
            title="Based on your order history"
            href="/orders"
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
  // When a search query is present we route through the catalog_search RPC
  // (migration 0038) so trigram similarity matches typos like "kefr" ->
  // "Kefir". The RPC mirrors visibleProductsQuery's visibility filters
  // (is_active, channel, private allow-list, buyer_type group/category
  // scope) plus the same group/producer narrow the ilike branch applied,
  // and orders by similarity desc. For non-search browses we keep the
  // PostgREST chain so the price/name sort options stay client-driven.
  let query: any;
  if (q) {
    query = db.rpc("catalog_search", {
      q,
      is_b2b: isB2B,
      allowed_private_ids: allowedPrivateIds,
      allowed_groups: allowedGroupsFor(effectiveBuyerType),
      allowed_categories: allowedCategoriesFor(effectiveBuyerType),
      group_filter: groupFilter,
      producer_filter: producerFilter || null,
    });
  } else {
    query = visibleProductsQuery(db, { buyerType: effectiveBuyerType, isB2B, allowedPrivateIds });
    // Group filter: match the primary product_group OR an entry in
    // additional_groups so cross-listed products (e.g. Hawthorne Valley
    // krauts listed in both produce + dairy) surface in either browse.
    if (groupFilter) query = query.or(`product_group.eq.${groupFilter},additional_groups.cs.{${groupFilter}}`);
    if (producerFilter) query = query.ilike("producer", producerFilter);

    if (isBest) query = query.order("sort_order", { ascending: true });
    else if (sort === "price_asc") query = query.order("wholesale_price", { ascending: true, nullsFirst: false });
    else if (sort === "price_desc") query = query.order("wholesale_price", { ascending: false, nullsFirst: false });
    else if (sort === "best") query = query.order("sort_order", { ascending: true });
    else if (sort === "name_desc") query = query.order("name", { ascending: false });
    else query = query.order("name", { ascending: true });
  }

  // Producer chips row — shown on category pages (?group=X) so loyalists
  // can one-tap narrow to a single producer. Stays visible when a producer
  // is already selected so the buyer can toggle it back off via the
  // selected chip. Skipped on search / explore / best / sub-category
  // drill-ins to keep those surfaces focused.
  const showProducerChips =
    Boolean(groupFilter) &&
    !q &&
    !isBest &&
    !isExplore &&
    !subCategoryFilter;

  // Main query, search-suggestions (cached), and producer-chip rows
  // are all independent — run them in parallel so they share one
  // round-trip tier. The producer-chip query is conditional and stubs
  // to a null payload when not needed.
  const [
    { data: products },
    suggestionsList,
    { data: producerRows },
  ] = await Promise.all([
    query,
    getCatalogSuggestions({
      buyerType: effectiveBuyerType,
      isB2B,
      allowedPrivateIds,
    }),
    showProducerChips
      ? visibleProductsQuery(db, {
          buyerType: effectiveBuyerType,
          isB2B,
          allowedPrivateIds,
          select: "producer",
        })
          .eq("product_group", groupFilter as ProductGroup)
          .not("producer", "is", null)
      : Promise.resolve({ data: null }),
  ]);

  const priced = priceProducts(products as Product[] | null, pricingCtx);

  let categoryProducers: string[] = [];
  if (showProducerChips && producerRows) {
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

  // When the user narrowed to a single category (and isn't also searching,
  // filtering by producer, or drilling into a sub-category), render
  // sub-category sections (Milk / Eggs / Yogurt within Dairy, Beef / Pork /
  // Chicken within Meat, etc.) so browsing-by-item-type leads. Drilling
  // into a producer (?producer=X) or a sub-category (?subCategory=Milk)
  // still goes to a flat grid.
  const showSubCategorySections =
    Boolean(groupFilter) &&
    !producerFilter &&
    !subCategoryFilter &&
    !q &&
    !isBest &&
    !isExplore;

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
    const pricedIdSet = new Set(pricedIds);
    // Buyer rank is read from the cached pre-aggregated buyerHistory
    // (no per-page order_items round-trip). Global rank still needs its
    // own query — there's no buyer-scoped cache that helps here.
    // M21: bound by created_at so the scan stays small as order_items
    // grows. 90 days is enough for "popular this season" catalog ranking
    // signals without dragging in years of stale history.
    // react-hooks/purity flags `Date.now()` in render — use the
    // `new Date().getTime()` form already established elsewhere in the
    // codebase.
    const catalogRankSinceIso = new Date(
      new Date().getTime() - 90 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { data: allItems } = await db
      .from("order_items")
      .select("product_id, quantity")
      .in("product_id", pricedIds)
      .gte("created_at", catalogRankSinceIso);
    for (const row of buyerHistory) {
      if (!pricedIdSet.has(row.product_id)) continue;
      buyerProductRank[row.product_id] =
        (buyerProductRank[row.product_id] ?? 0) + row.qty;
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
  let visibleProducts = isBest ? bestSellers : priced;

  // Sub-category drill-in: filter to the products whose computed
  // sub_category bucket matches the URL value. Match is exact (the URL
  // value mirrors the strip title from groupBySubCategory). The category
  // query has already constrained product_group, so this is purely a
  // client-side narrow against an already-bounded list.
  if (isSubCategoryView) {
    visibleProducts = visibleProducts.filter(
      (p) =>
        subCategoryOf(p.name, p.category, p.sub_category, p.sku) ===
        subCategoryFilter,
    );
  }

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

  // Producer + sub-category drill-ins both "slide in from the right"
  // with a back button — same pattern as /cart. Gives the buyer a clear
  // way back to where they were (the catalog landing, the order guide,
  // etc.). Category browse stays planted inside the catalog so the chip
  // tap doesn't read as a navigation away from the catalog surface.
  const isProducerView = Boolean(producerFilter);
  const isDetailView = isProducerView || isSubCategoryView;

  return (
    <div className={`max-w-screen-xl mx-auto pb-8 ${isDetailView ? "sm:animate-slide-in-right" : ""}`}>
      <div className="pt-3">
        {isDetailView ? <BackButton fallbackHref="/catalog" /> : null}
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
        ) : isSubCategoryView ? (
          /* Same editorial hero used for producer detail, repurposed for
             a sub-category drill-in (e.g. "ALL ITEMS IN / Milk"). Drives
             the guide → see-all flow into a focused shop-this surface. */
          <div className="text-center my-6 md:my-10">
            <p className="text-[11px] uppercase tracking-[0.2em] text-ink-tertiary mb-2">
              All items in
            </p>
            <h1 className="display text-3xl md:text-5xl tracking-tight leading-[1.05]">
              {subCategoryFilter}
            </h1>
            <p className="text-[13px] text-ink-secondary mt-3">
              {visibleProducts.length} {visibleProducts.length === 1 ? "item" : "items"}
              {groupFilter ? (
                <>
                  <span className="text-ink-tertiary"> · </span>
                  <Link
                    href={`/catalog?group=${groupFilter}`}
                    className="text-ink-secondary hover:text-ink-primary underline-offset-2 hover:underline"
                  >
                    All {GROUP_LABELS[groupFilter]}
                  </Link>
                </>
              ) : null}
            </p>
          </div>
        ) : (
          <h1 className="display text-xl mt-1 mb-1">{headerTitle}</h1>
        )}
        {!isDetailView ? (
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
        {!isSubCategoryView ? (
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
        ) : null}

        {!isBest && !showSubCategorySections && !isSubCategoryView ? (
          <div className="flex items-center gap-2 mb-4">
            <SortSheet current={sort} />
          </div>
        ) : null}
      </div>

      {/* Stock-up trigger — fires on producer- or sub-category-filtered
          views with enough assortment to be worth the multi-line flow.
          Single-product subjects would just be a "+1" with extra taps. */}
      {(producerFilter || isSubCategoryView) && visibleProducts.length >= 2 ? (
        <StockUpButton
          subject={producerFilter || subCategoryFilter}
          products={visibleProducts}
        />
      ) : null}

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
              href={`/catalog?group=${groupFilter}&subCategory=${encodeURIComponent(subCategory)}`}
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

