import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import { resolveActiveAccount } from "@/lib/auth/active-account";
import type { Account, AccountPricing, Product } from "@/lib/supabase/types";
import { resolvePrice } from "@/lib/utils/pricing";
import {
  GROUP_LABELS,
  allowedGroupsFor,
  type ProductGroup,
} from "@/lib/constants";
import { CatalogGrid } from "./CatalogGrid";
import { ScrollStrip } from "./ScrollStrip";
import { SortSheet, type SortKey } from "./SortSheet";
import { CatalogSearchInput } from "./CatalogSearchInput";

export const metadata = { title: "Catalog — Fingerlakes Farms" };

const GROUP_COLORS: Record<ProductGroup, { from: string; to: string }> = {
  meat:    { from: "#9D3123", to: "#5E1A13" },
  grocery: { from: "#C4962C", to: "#7A5A12" },
  produce: { from: "#7BB26B", to: "#355E2A" },
  dairy:   { from: "#B1C1D6", to: "#4A6B8A" },
  cheese:  { from: "#E9C96B", to: "#A37C17" },
};

function groupTileImage(group: ProductGroup): string {
  const { from, to } = GROUP_COLORS[group];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="120" height="90" fill="url(#g)"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function priceProducts(
  rows: Product[] | null | undefined,
  overrides: AccountPricing[] | null | undefined,
  account: Account | null,
  isB2B: boolean,
): (Product & { unitPrice: number | null })[] {
  return (rows ?? []).map((p) => {
    const override = (overrides ?? []).find((o) => o.product_id === p.id) ?? null;
    return { ...p, unitPrice: resolvePrice(p, { account, customPrice: override, isB2B }) };
  });
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; q?: string; sort?: string; producer?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const impersonating = session.profile.role === "admin" ? getImpersonation() : null;
  const db = impersonating ? createServiceClient() : await createClient();

  const profileId = impersonating ?? session.userId;
  const { data: me } = await db.from("profiles").select("*").eq("id", profileId).maybeSingle();
  if (!me) redirect("/login");

  const isB2B = me.role === "b2b_buyer";
  const { active } = await resolveActiveAccount(profileId, me.account_id);
  const account = active;

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
    const { data: overridesRaw } = account
      ? await db.from("account_pricing").select("*").eq("account_id", account.id)
      : { data: [] as AccountPricing[] };
    const overrides = overridesRaw as AccountPricing[] | null;

    // Strip 1: This week — available_this_week = true
    const { data: weekRows } = await db
      .from("products")
      .select("*")
      .eq("is_active", true)
      .eq(isB2B ? "available_b2b" : "available_dtc", true)
      .in("product_group", allowed)
      .eq("available_this_week", true)
      .order("sort_order", { ascending: true })
      .limit(12);
    const thisWeek = priceProducts(weekRows as Product[] | null, overrides, account, isB2B);

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
      const { data: histProducts } = await db
        .from("products")
        .select("*")
        .in("id", topIds)
        .eq("is_active", true);
      history = priceProducts(histProducts as Product[] | null, overrides, account, isB2B);
      // preserve most-ordered order
      history.sort((a, b) => (countByProduct.get(b.id) ?? 0) - (countByProduct.get(a.id) ?? 0));
    }

    // Strip 3: Featured producer — pick the producer with the most products in allowed groups
    const { data: producerRows } = await db
      .from("products")
      .select("producer")
      .eq("is_active", true)
      .eq(isB2B ? "available_b2b" : "available_dtc", true)
      .in("product_group", allowed)
      .not("producer", "is", null);
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
      const { data: featRows } = await db
        .from("products")
        .select("*")
        .eq("is_active", true)
        .eq(isB2B ? "available_b2b" : "available_dtc", true)
        .eq("producer", featuredProducer)
        .in("product_group", allowed)
        .order("sort_order", { ascending: true })
        .limit(10);
      featured = priceProducts(featRows as Product[] | null, overrides, account, isB2B);
    }

    // Product-name + producer suggestions for the search autocomplete
    const { data: suggestRows } = await db
      .from("products")
      .select("name, producer")
      .eq("is_active", true)
      .eq(isB2B ? "available_b2b" : "available_dtc", true)
      .in("product_group", allowed)
      .order("name", { ascending: true });
    const suggestions = buildSuggestions(suggestRows);

    // Group counts for the fallback tile grid
    const { data: counts } = await db
      .from("products")
      .select("product_group")
      .eq("is_active", true)
      .eq(isB2B ? "available_b2b" : "available_dtc", true)
      .in("product_group", allowed);

    const groupCounts = allowed
      .map((g) => ({
        group: g,
        count: ((counts as { product_group: string | null }[]) ?? []).filter((p) => p.product_group === g).length,
      }))
      .filter((g) => g.count > 0);

    return (
      <div className="max-w-3xl mx-auto pb-8">
        <form action="/catalog" className="px-4 md:px-0 mb-3">
          <CatalogSearchInput datalistId="catalog-suggest" />
          <datalist id="catalog-suggest">
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </form>

        <ScrollStrip
          title="This week"
          emoji="🌱"
          subtitle="Fresh off the flyer — available for this delivery."
          products={thisWeek}
        />

        {history.length > 0 ? (
          <ScrollStrip
            title="Based on your order history"
            products={history}
          />
        ) : null}

        {featured.length > 0 && featuredProducer ? (
          <ScrollStrip
            title={featuredProducer}
            href={`/catalog?producer=${encodeURIComponent(featuredProducer)}`}
            subtitle="Featured producer"
            products={featured}
          />
        ) : null}

        {/* Explore / Best Sellers + Group tiles — kept as a fallback grid below strips */}
        {allowed.length > 1 ? (
          <div className="grid grid-cols-2 gap-3 px-4 md:px-0 mb-3">
            <Link
              href="/catalog?group=explore"
              className="relative rounded-xl overflow-hidden shadow-card hover:shadow-lg transition aspect-[3/1] flex items-center justify-center text-white bg-gradient-to-br from-brand-blue to-brand-blue-dark"
            >
              <div className="text-center">
                <div className="display text-lg tracking-tight">Explore</div>
                <div className="text-[11px] opacity-80">Everything available to you</div>
              </div>
            </Link>
            <Link
              href="/catalog?group=best"
              className="relative rounded-xl overflow-hidden shadow-card hover:shadow-lg transition aspect-[3/1] flex items-center justify-center text-white bg-gradient-to-br from-accent-rust to-[#6b3820]"
            >
              <div className="text-center">
                <div className="display text-lg tracking-tight">Best sellers</div>
                <div className="text-[11px] opacity-80">Most ordered this season</div>
              </div>
            </Link>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 px-4 md:px-0">
          {groupCounts.map(({ group, count }) => (
            <Link
              key={group}
              href={`/catalog?group=${group}`}
              className="group relative aspect-square rounded-xl overflow-hidden shadow-card hover:shadow-lg transition"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={groupTileImage(group)}
                alt={GROUP_LABELS[group]}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                <div className="display text-2xl tracking-tight leading-none">
                  {GROUP_LABELS[group]}
                </div>
                <div className="text-xs opacity-80 mt-1">
                  {count} {count === 1 ? "item" : "items"}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  // =====================================================================
  // LIST VIEW (group / search / producer / explore / best)
  // =====================================================================
  let query = db.from("products").select("*").eq("is_active", true);
  if (isB2B) query = query.eq("available_b2b", true);
  else query = query.eq("available_dtc", true);
  query = query.in("product_group", allowed);
  if (groupFilter) query = query.eq("product_group", groupFilter);
  if (q) query = query.or(`name.ilike.%${q}%,producer.ilike.%${q}%`);
  if (producerFilter) query = query.eq("producer", producerFilter);

  if (isBest) query = query.order("sort_order", { ascending: true });
  else if (sort === "price_asc") query = query.order("wholesale_price", { ascending: true, nullsFirst: false });
  else if (sort === "price_desc") query = query.order("wholesale_price", { ascending: false, nullsFirst: false });
  else if (sort === "best") query = query.order("sort_order", { ascending: true });
  else if (sort === "name_desc") query = query.order("name", { ascending: false });
  else query = query.order("name", { ascending: true });

  const { data: products } = await query;

  // Suggestions for the list-view search (same pool the user sees below)
  const { data: suggestRowsList } = await db
    .from("products")
    .select("name, producer")
    .eq("is_active", true)
    .eq(isB2B ? "available_b2b" : "available_dtc", true)
    .in("product_group", allowed)
    .order("name", { ascending: true });
  const suggestionsList = buildSuggestions(suggestRowsList);

  const { data: overrides } = account
    ? await db.from("account_pricing").select("*").eq("account_id", account.id)
    : { data: [] as AccountPricing[] };

  const priced = priceProducts(
    products as Product[] | null,
    overrides as AccountPricing[] | null,
    account,
    isB2B,
  );

  const headerTitle = producerFilter
    ? producerFilter
    : isExplore
    ? "Explore"
    : isBest
    ? "Best sellers"
    : groupFilter
    ? GROUP_LABELS[groupFilter]
    : `Search “${q}”`;

  return (
    <div className="max-w-3xl mx-auto pb-8">
      <div className="px-4 md:px-0 pt-1">
        <Link href="/catalog" className="text-xs text-ink-secondary hover:underline">
          ← Catalog
        </Link>
        <h1 className="display text-xl mt-0.5 mb-1">{headerTitle}</h1>
        {producerFilter ? (
          <p className="text-xs text-ink-secondary mb-2">All items from {producerFilter}</p>
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

        {!isBest ? (
          <div className="flex items-center gap-2 mb-4">
            <SortSheet current={sort} />
          </div>
        ) : null}
      </div>

      {priced.length === 0 ? (
        <p className="text-ink-secondary px-4 md:px-0">No products match.</p>
      ) : (
        <CatalogGrid
          products={priced}
          fromGroup={groupFilter ?? (isExplore ? "explore" : isBest ? "best" : null)}
        />
      )}
    </div>
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
