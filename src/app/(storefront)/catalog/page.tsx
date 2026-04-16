import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import type { Account, AccountPricing, Category, Product } from "@/lib/supabase/types";
import { resolvePrice } from "@/lib/utils/pricing";
import { CATEGORY_LABELS } from "@/lib/constants";
import { categoryTileImage } from "@/lib/utils/product-image";
import { CatalogGrid } from "./CatalogGrid";

export const metadata = { title: "Catalog — Fingerlakes Farms" };

type Sort = "name" | "price_asc" | "price_desc" | "best";

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; sort?: string; producer?: string }>;
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

  const enabled: Category[] =
    (account?.enabled_categories as Category[]) ?? ["beef", "pork", "lamb", "eggs", "dairy", "produce", "pantry", "beverages"];
  const sp = await searchParams;
  const catFilter =
    sp.category && enabled.includes(sp.category as Category) ? (sp.category as Category) : null;
  const q = sp.q?.trim() ?? "";
  const sort: Sort = (["name", "price_asc", "price_desc", "best"].includes(sp.sort ?? "")
    ? (sp.sort as Sort)
    : "name");
  const producerFilter = sp.producer?.trim() ?? "";
  const isSearching = q.length > 0 || producerFilter.length > 0;

  // Category landing: show tiles with counts
  if (!catFilter && !isSearching) {
    const { data: counts } = await db
      .from("products")
      .select("category")
      .eq("is_active", true)
      .eq(isB2B ? "available_b2b" : "available_dtc", true)
      .in("category", enabled);

    const categoryCounts = enabled.map((c) => ({
      category: c,
      count: ((counts as any[]) ?? []).filter((p) => p.category === c).length,
    })).filter(c => c.count > 0);

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
              placeholder="Search by name, brand, or farm…"
              className="input"
            />
          </form>
        </div>

        <div className="grid grid-cols-2 gap-3 px-4 md:px-0">
          {categoryCounts.map(({ category, count }) => (
            <Link
              key={category}
              href={`/catalog?category=${category}`}
              className="group relative aspect-square rounded-xl overflow-hidden shadow-card hover:shadow-lg transition"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={categoryTileImage(category)}
                alt={CATEGORY_LABELS[category]}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                <div className="display text-2xl tracking-tight leading-none">
                  {CATEGORY_LABELS[category]}
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

  // Category or search results view
  let query = db.from("products").select("*").eq("is_active", true);
  if (isB2B) query = query.eq("available_b2b", true);
  else query = query.eq("available_dtc", true);
  query = query.in("category", catFilter ? [catFilter] : enabled);
  if (q) {
    // search name OR producer
    query = query.or(`name.ilike.%${q}%,producer.ilike.%${q}%`);
  }
  if (producerFilter) query = query.eq("producer", producerFilter);

  // Sort
  if (sort === "price_asc") query = query.order("wholesale_price", { ascending: true, nullsFirst: false });
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
    : catFilter
    ? CATEGORY_LABELS[catFilter]
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
          {catFilter ? <input type="hidden" name="category" value={catFilter} /> : null}
          <button className="btn-secondary text-sm">Search</button>
        </form>

        {/* Sort */}
        <div className="flex items-center gap-2 mb-4 text-xs">
          <span className="text-ink-secondary uppercase tracking-wide">Sort</span>
          <SortLink sp={sp} sort="name"       label="A–Z" active={sort === "name"} />
          <SortLink sp={sp} sort="price_asc"  label="Price ↑" active={sort === "price_asc"} />
          <SortLink sp={sp} sort="price_desc" label="Price ↓" active={sort === "price_desc"} />
          <SortLink sp={sp} sort="best"       label="Popular" active={sort === "best"} />
        </div>
      </div>

      {priced.length === 0 ? (
        <p className="text-ink-secondary px-4 md:px-0">No products match.</p>
      ) : (
        <CatalogGrid products={priced} fromCategory={catFilter} />
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
  sp: { category?: string; q?: string; producer?: string };
  sort: string;
  label: string;
  active: boolean;
}) {
  const params = new URLSearchParams();
  if (sp.category) params.set("category", sp.category);
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
