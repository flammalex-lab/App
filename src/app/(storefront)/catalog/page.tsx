import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import type { Account, AccountPricing, Product } from "@/lib/supabase/types";
import { resolvePrice } from "@/lib/utils/pricing";
import {
  GROUP_LABELS,
  allowedGroupsFor,
  type ProductGroup,
  ALL_GROUPS,
} from "@/lib/constants";
import { CatalogGrid } from "./CatalogGrid";

export const metadata = { title: "Catalog — Fingerlakes Farms" };

type Sort = "name" | "price_asc" | "price_desc" | "best";

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
  const { data: acctRow } = me.account_id
    ? await db.from("accounts").select("*").eq("id", me.account_id).maybeSingle()
    : { data: null as Account | null };
  const account = acctRow as Account | null;

  const allowed = allowedGroupsFor(account?.buyer_type);
  const sp = await searchParams;
  const groupFilter =
    sp.group && allowed.includes(sp.group as ProductGroup) ? (sp.group as ProductGroup) : null;
  const q = sp.q?.trim() ?? "";
  const sort: Sort = (["name", "price_asc", "price_desc", "best"].includes(sp.sort ?? "")
    ? (sp.sort as Sort)
    : "name");
  const producerFilter = sp.producer?.trim() ?? "";
  const isSearching = q.length > 0 || producerFilter.length > 0;
  const isExplore = sp.group === "explore";
  const isBest = sp.group === "best";

  // Landing: show tiles for groups this buyer can see
  if (!groupFilter && !isSearching && !isExplore && !isBest) {
    const { data: counts } = await db
      .from("products")
      .select("product_group")
      .eq("is_active", true)
      .eq(isB2B ? "available_b2b" : "available_dtc", true)
      .in("product_group", allowed);

    const groupCounts = allowed
      .map((g) => ({
        group: g,
        count: ((counts as any[]) ?? []).filter((p) => p.product_group === g).length,
      }))
      .filter((g) => g.count > 0);

    return (
      <div className="max-w-3xl mx-auto pb-8">
        <div className="px-4 md:px-0 pt-4">
          <h1 className="display text-3xl sm:text-4xl mb-1">Catalog</h1>
          <p className="text-sm text-ink-secondary mb-4">
            {account ? `Available for ${account.name}` : "Shop the full product list"}
          </p>
          <form action="/catalog" className="mb-5">
            <input
              type="search"
              name="q"
              placeholder="Search by name or farm…"
              className="input"
            />
          </form>
        </div>

        {/* Explore / Best Sellers strip — always shown above the group tiles */}
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

        {/* Group tiles */}
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

  // Build list query
  let query = db.from("products").select("*").eq("is_active", true);
  if (isB2B) query = query.eq("available_b2b", true);
  else query = query.eq("available_dtc", true);
  // Restrict to allowed groups regardless of filter
  query = query.in("product_group", allowed);
  // Apply group filter (unless Explore/Best — which span all allowed groups)
  if (groupFilter) query = query.eq("product_group", groupFilter);
  if (q) query = query.or(`name.ilike.%${q}%,producer.ilike.%${q}%`);
  if (producerFilter) query = query.eq("producer", producerFilter);

  if (isBest) query = query.order("sort_order", { ascending: true });
  else if (sort === "price_asc") query = query.order("wholesale_price", { ascending: true, nullsFirst: false });
  else if (sort === "price_desc") query = query.order("wholesale_price", { ascending: false, nullsFirst: false });
  else if (sort === "best") query = query.order("sort_order", { ascending: true });
  else query = query.order("name", { ascending: true });

  const { data: products } = await query;

  const { data: overrides } = account
    ? await db.from("account_pricing").select("*").eq("account_id", account.id)
    : { data: [] as AccountPricing[] };

  const priced = ((products as Product[] | null) ?? []).map((p) => {
    const override = (overrides as AccountPricing[] | null)?.find((o) => o.product_id === p.id) ?? null;
    return {
      ...p,
      unitPrice: resolvePrice(p, { account, customPrice: override, isB2B }),
    };
  });

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
      <div className="px-4 md:px-0 pt-4">
        <Link href="/catalog" className="text-sm text-ink-secondary hover:underline">
          ← Catalog
        </Link>
        <h1 className="display text-3xl sm:text-4xl mt-1 mb-3">{headerTitle}</h1>
        {producerFilter ? (
          <p className="text-sm text-ink-secondary mb-3">All items from {producerFilter}</p>
        ) : null}
        <form action="/catalog" className="mb-3 flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search name or farm"
            className="input flex-1"
          />
          {groupFilter ? <input type="hidden" name="group" value={groupFilter} /> : null}
          <button className="btn-secondary text-sm">Search</button>
        </form>

        {!isBest ? (
          <div className="flex items-center gap-2 mb-4 text-xs">
            <span className="text-ink-secondary uppercase tracking-wide">Sort</span>
            <SortLink sp={sp} sort="name"       label="A–Z"      active={sort === "name"} />
            <SortLink sp={sp} sort="price_asc"  label="Price ↑"  active={sort === "price_asc"} />
            <SortLink sp={sp} sort="price_desc" label="Price ↓"  active={sort === "price_desc"} />
            <SortLink sp={sp} sort="best"       label="Popular"  active={sort === "best"} />
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

function SortLink({
  sp,
  sort,
  label,
  active,
}: {
  sp: { group?: string; q?: string; producer?: string };
  sort: string;
  label: string;
  active: boolean;
}) {
  const params = new URLSearchParams();
  if (sp.group) params.set("group", sp.group);
  if (sp.q) params.set("q", sp.q);
  if (sp.producer) params.set("producer", sp.producer);
  params.set("sort", sort);
  return (
    <Link
      href={`/catalog?${params.toString()}`}
      className={`px-2.5 py-1 rounded-full border ${
        active
          ? "bg-brand-blue text-white border-brand-blue"
          : "bg-white border-black/10 hover:bg-bg-secondary"
      }`}
    >
      {label}
    </Link>
  );
}
