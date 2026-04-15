import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import type { Account, AccountPricing, Category, Product } from "@/lib/supabase/types";
import { resolvePrice } from "@/lib/utils/pricing";
import { CATEGORY_LABELS } from "@/lib/constants";
import Link from "next/link";
import { money } from "@/lib/utils/format";

export const metadata = { title: "Catalog — Fingerlakes Farms" };

export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ category?: string; q?: string }> }) {
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

  const enabled: Category[] = (account?.enabled_categories as Category[]) ?? ["beef", "pork", "eggs", "dairy", "produce"];
  const sp = await searchParams;
  const catFilter = sp.category && enabled.includes(sp.category as Category) ? (sp.category as Category) : null;
  const q = sp.q?.trim() ?? "";

  let query = db.from("products").select("*").eq("is_active", true).order("sort_order");
  if (isB2B) query = query.eq("available_b2b", true);
  else query = query.eq("available_dtc", true);
  query = query.in("category", catFilter ? [catFilter] : enabled);
  if (q) query = query.ilike("name", `%${q}%`);

  const { data: products } = await query;

  const { data: overrides } = account
    ? await db.from("account_pricing").select("*").eq("account_id", account.id)
    : { data: [] as AccountPricing[] };

  const priced = (products as Product[] | null ?? []).map((p) => {
    const override = (overrides as AccountPricing[] | null)?.find((o) => o.product_id === p.id) ?? null;
    return {
      ...p,
      unitPrice: resolvePrice(p, { account, customPrice: override, isB2B }),
    };
  });

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-end justify-between mb-4">
        <h1 className="text-3xl">Catalog</h1>
        <form className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search"
            className="input max-w-xs"
          />
          <input type="hidden" name="category" value={catFilter ?? ""} />
          <button className="btn-secondary text-sm">Search</button>
        </form>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        <CatLink active={!catFilter} href={`/catalog${q ? `?q=${encodeURIComponent(q)}` : ""}`}>All</CatLink>
        {enabled.map((c) => (
          <CatLink key={c} active={catFilter === c} href={`/catalog?category=${c}${q ? `&q=${encodeURIComponent(q)}` : ""}`}>
            {CATEGORY_LABELS[c]}
          </CatLink>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {priced.map((p) => (
          <Link key={p.id} href={`/catalog/${p.id}`} className="card p-4 hover:shadow-lg transition">
            <div className="aspect-[4/3] bg-bg-secondary rounded mb-3 overflow-hidden flex items-center justify-center text-ink-secondary text-sm">
              {p.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
              ) : (
                <span>{CATEGORY_LABELS[p.category]}</span>
              )}
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <div className="font-medium truncate">{p.name}</div>
              <div className="mono text-sm whitespace-nowrap">
                {p.unitPrice != null ? `${money(p.unitPrice)}/${p.unit}` : "—"}
              </div>
            </div>
            <div className="text-xs text-ink-secondary mt-1">
              {p.pack_size ?? p.cut_type ?? ""}
              {!p.available_this_week ? <span className="ml-2 badge-gray">limited</span> : null}
            </div>
          </Link>
        ))}
      </div>
      {priced.length === 0 ? <p className="text-ink-secondary">No products match.</p> : null}
    </div>
  );
}

function CatLink({ active, href, children }: { active: boolean; href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 text-sm rounded-full border ${
        active ? "bg-brand-green text-white border-brand-green" : "bg-white border-black/10 hover:bg-bg-secondary"
      }`}
    >
      {children}
    </Link>
  );
}
