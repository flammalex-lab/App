import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import type { Brand, Category, Product } from "@/lib/supabase/types";
import { money } from "@/lib/utils/format";
import { BRAND_LABELS, CATEGORY_LABELS } from "@/lib/constants";

export const metadata = { title: "Admin — Products" };

const PAGE_SIZE = 50;
const BRANDS = Object.keys(BRAND_LABELS) as Brand[];
const CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[];

interface SP {
  q?: string;
  category?: string;
  brand?: string;
  state?: string;
  page?: string;
}

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  await requireAdmin();
  // Service client so admin can see every row regardless of RLS.
  const db = createServiceClient();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const category = (sp.category ?? "") as Category | "";
  const brand = (sp.brand ?? "") as Brand | "";
  const state = sp.state ?? "active";
  const pageNum = Math.max(1, Number(sp.page) || 1);
  const from = (pageNum - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = db.from("products").select("*", { count: "exact" });
  if (q) {
    // Search name, sku, producer in one OR. Postgrest's `or` wants
    // dot-separated filter strings.
    const like = `%${q.replace(/[%,]/g, "")}%`;
    query = query.or(
      `name.ilike.${like},sku.ilike.${like},producer.ilike.${like}`,
    );
  }
  if (category) query = query.eq("category", category);
  if (brand) query = query.eq("brand", brand);
  if (state === "active") query = query.eq("is_active", true);
  else if (state === "inactive") query = query.eq("is_active", false);
  // state === "all" → no filter
  query = query.order("sort_order").range(from, to);

  const { data, count } = await query;
  const products = (data as Product[] | null) ?? [];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Naming-review badge is a global count, not paged.
  const { count: pendingNamingReview } = await db
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("needs_naming_review", true)
    .eq("is_active", true);

  const params = (overrides: Partial<SP>) => {
    const merged: SP = { q, category, brand, state, page: String(pageNum), ...overrides };
    const qs = new URLSearchParams();
    if (merged.q) qs.set("q", merged.q);
    if (merged.category) qs.set("category", merged.category);
    if (merged.brand) qs.set("brand", merged.brand);
    if (merged.state && merged.state !== "active") qs.set("state", merged.state);
    if (merged.page && merged.page !== "1") qs.set("page", merged.page);
    const s = qs.toString();
    return s ? `/admin/products?${s}` : "/admin/products";
  };
  const hasFilters = Boolean(q || category || brand || state !== "active");

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl">Products</h1>
        <div className="flex items-center gap-3">
          <Link href="/admin/products/name-review" className="text-sm underline">
            Name review
            {(pendingNamingReview ?? 0) > 0 ? (
              <span className="ml-1 badge-gray">{pendingNamingReview}</span>
            ) : null}
          </Link>
          <Link href="/admin/products/new" className="btn-primary text-sm">New product</Link>
        </div>
      </div>

      <form action="/admin/products" className="flex flex-wrap items-end gap-2 mb-4">
        <div className="flex-1 min-w-[220px]">
          <label className="label">Search</label>
          <input
            name="q"
            defaultValue={q}
            placeholder="Name, SKU, or producer"
            className="input"
            type="search"
          />
        </div>
        <div>
          <label className="label">Category</label>
          <select name="category" defaultValue={category} className="input">
            <option value="">All</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Brand</label>
          <select name="brand" defaultValue={brand} className="input">
            <option value="">All</option>
            {BRANDS.map((b) => (
              <option key={b} value={b}>{BRAND_LABELS[b]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">State</label>
          <select name="state" defaultValue={state} className="input">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All</option>
          </select>
        </div>
        <button className="btn-secondary text-sm">Filter</button>
        {hasFilters ? (
          <Link href="/admin/products" className="btn-ghost text-sm">Clear</Link>
        ) : null}
      </form>

      <div className="text-xs text-ink-secondary mb-2">
        {total === 0 ? "No products match." : (
          <>
            {from + 1}&ndash;{Math.min(to + 1, total)} of {total}
            {hasFilters ? <span className="ml-1">(filtered)</span> : null}
          </>
        )}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-ink-secondary border-b border-black/5">
            <tr>
              <th className="p-3">SKU</th>
              <th className="p-3">Name</th>
              <th className="p-3">Producer</th>
              <th className="p-3">Category</th>
              <th className="p-3">Wholesale</th>
              <th className="p-3">Retail</th>
              <th className="p-3">Avail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-bg-secondary">
                <td className="p-3 mono text-xs">{p.sku ?? "—"}</td>
                <td className="p-3">
                  <Link href={`/admin/products/${p.id}`} className="underline">{p.name}</Link>
                  {p.pack_size ? <div className="text-xs text-ink-secondary">{p.pack_size}</div> : null}
                </td>
                <td className="p-3 text-xs">{p.producer ?? "—"}</td>
                <td className="p-3">{CATEGORY_LABELS[p.category]}</td>
                <td className="p-3 mono">{money(p.wholesale_price)}</td>
                <td className="p-3 mono">{money(p.retail_price)}</td>
                <td className="p-3 text-xs">
                  {p.is_active ? <span className="badge-green">active</span> : <span className="badge-gray">off</span>}
                  {!p.available_this_week ? <span className="badge-gray ml-1">week off</span> : null}
                </td>
              </tr>
            ))}
            {products.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-sm text-ink-secondary">
                  {hasFilters
                    ? "No products match. Try clearing filters."
                    : "No products in the catalog yet."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between mt-3 text-sm">
          <div className="text-ink-secondary">
            Page {pageNum} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            {pageNum > 1 ? (
              <Link href={params({ page: String(pageNum - 1) })} className="btn-ghost text-sm">
                ← Prev
              </Link>
            ) : (
              <span className="btn-ghost text-sm opacity-40 cursor-not-allowed">← Prev</span>
            )}
            {pageNum < totalPages ? (
              <Link href={params({ page: String(pageNum + 1) })} className="btn-ghost text-sm">
                Next →
              </Link>
            ) : (
              <span className="btn-ghost text-sm opacity-40 cursor-not-allowed">Next →</span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
