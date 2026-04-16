import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import type { Account, AccountPricing, Category, Product } from "@/lib/supabase/types";
import { resolvePrice } from "@/lib/utils/pricing";
import { CATEGORY_LABELS } from "@/lib/constants";
import { categoryTileImage, productImage } from "@/lib/utils/product-image";
import { money } from "@/lib/utils/format";

export const metadata = { title: "Catalog — Fingerlakes Farms" };

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
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
    (account?.enabled_categories as Category[]) ?? ["beef", "pork", "eggs", "dairy", "produce"];
  const sp = await searchParams;
  const catFilter =
    sp.category && enabled.includes(sp.category as Category) ? (sp.category as Category) : null;
  const q = sp.q?.trim() ?? "";
  const isSearching = q.length > 0;

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
    }));

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
              placeholder="Search by name, SKU, brand…"
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
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
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
  let query = db.from("products").select("*").eq("is_active", true).order("sort_order");
  if (isB2B) query = query.eq("available_b2b", true);
  else query = query.eq("available_dtc", true);
  query = query.in("category", catFilter ? [catFilter] : enabled);
  if (q) query = query.ilike("name", `%${q}%`);
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

  return (
    <div className="max-w-3xl mx-auto pb-8">
      <div className="px-4 md:px-0 pt-4">
        <Link href="/catalog" className="text-sm text-ink-secondary hover:underline">
          ← Catalog
        </Link>
        <h1 className="display text-3xl sm:text-4xl mt-1 mb-3">
          {catFilter ? CATEGORY_LABELS[catFilter] : `Search “${q}”`}
        </h1>
        <form action="/catalog" className="mb-4 flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search catalog"
            className="input flex-1"
          />
          {catFilter ? <input type="hidden" name="category" value={catFilter} /> : null}
          <button className="btn-secondary text-sm">Search</button>
        </form>
      </div>

      {priced.length === 0 ? (
        <p className="text-ink-secondary px-4 md:px-0">No products match.</p>
      ) : (
        <ul className="divide-y divide-black/5 border-y border-black/5 bg-white md:border md:rounded-xl md:shadow-card md:border-black/5">
          {priced.map((p) => (
            <li key={p.id}>
              <Link
                href={`/catalog/${p.id}`}
                className="p-3 flex items-center gap-3 hover:bg-bg-secondary/60 transition"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={productImage(p)}
                  alt={p.name}
                  className="h-16 w-16 rounded-md object-cover bg-bg-secondary shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm leading-tight">{p.name}</div>
                  <div className="text-xs text-ink-secondary mt-0.5">
                    {p.pack_size ?? p.cut_type ?? ""}
                  </div>
                  {!p.available_this_week ? (
                    <span className="badge-gray mt-1 inline-block">limited this week</span>
                  ) : null}
                </div>
                <div className="text-right shrink-0">
                  <div className="mono text-sm font-semibold">
                    {p.unitPrice != null ? money(p.unitPrice) : "—"}
                  </div>
                  <div className="text-[10px] text-ink-secondary uppercase">/ {p.unit}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
