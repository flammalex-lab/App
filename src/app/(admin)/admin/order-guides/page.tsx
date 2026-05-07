import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { BUYER_TYPE_LABELS, GROUP_LABELS, type BuyerType, type ProductGroup } from "@/lib/constants";

export const metadata = { title: "Admin — Order guides" };

type BuyerRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  buyer_type: string | null;
  account_id: string | null;
  account: { name: string; buyer_type: string | null } | null;
};

type GuideRow = {
  id: string;
  profile_id: string;
  order_guide_items: { product: { product_group: string | null } | null }[] | null;
};

export default async function AdminOrderGuidesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string }>;
}) {
  await requireAdmin();
  const db = await createClient();
  const sp = await searchParams;
  const typeFilter = sp.type ?? "";
  const q = sp.q?.trim() ?? "";

  // All B2B buyer profiles + their default guide + item counts (batched).
  const { data: buyersRaw } = await db
    .from("profiles")
    .select(
      "id, first_name, last_name, buyer_type, account_id, account:accounts(name, buyer_type)",
    )
    .eq("role", "b2b_buyer")
    .order("first_name");

  let buyers = (buyersRaw as unknown as BuyerRow[] | null) ?? [];
  if (typeFilter) {
    buyers = buyers.filter((b) => {
      const effective = b.buyer_type ?? b.account?.buyer_type ?? null;
      return effective === typeFilter;
    });
  }
  if (q) {
    const needle = q.toLowerCase();
    buyers = buyers.filter((b) => {
      const name = `${b.first_name ?? ""} ${b.last_name ?? ""}`.toLowerCase();
      const account = (b.account?.name ?? "").toLowerCase();
      return name.includes(needle) || account.includes(needle);
    });
  }

  const buyerIds = buyers.map((b) => b.id);
  const guideStats: Record<string, { items: number; groups: ProductGroup[] }> = {};
  if (buyerIds.length) {
    const { data: guides } = await db
      .from("order_guides")
      .select("id, profile_id, order_guide_items(product:products(product_group))")
      .in("profile_id", buyerIds)
      .eq("is_default", true);
    for (const g of ((guides as unknown as GuideRow[] | null) ?? [])) {
      const items = g.order_guide_items ?? [];
      const groups = new Set<ProductGroup>();
      for (const it of items) {
        const pg = it.product?.product_group as ProductGroup | null;
        if (pg) groups.add(pg);
      }
      guideStats[g.profile_id] = { items: items.length, groups: Array.from(groups) };
    }
  }

  const totalGuides = buyers.length;
  const emptyCount = buyers.filter((b) => (guideStats[b.id]?.items ?? 0) === 0).length;

  const buyerTypes: BuyerType[] = [
    "gm_restaurant",
    "gm_retail",
    "meat_buyer",
    "produce_buyer",
    "dairy_buyer",
    "cheese_buyer",
    "grocery_buyer",
  ];

  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <h1 className="display text-3xl">Order guides</h1>
        <p className="text-sm text-ink-secondary mt-1">
          Every buyer&rsquo;s landing-page order guide. Click a row to curate items, par levels, or
          seed from the buyer-type defaults.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Buyers" value={totalGuides} />
        <Stat
          label="Empty guides"
          value={emptyCount}
          tone={emptyCount > 0 ? "rust" : undefined}
        />
        <Stat label="Populated" value={totalGuides - emptyCount} tone="green" />
      </div>

      <form action="/admin/order-guides" className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="label">Search</label>
          <input
            name="q"
            defaultValue={q}
            placeholder="Buyer or account name"
            className="input"
          />
        </div>
        <div>
          <label className="label">Buyer type</label>
          <select name="type" defaultValue={typeFilter} className="input">
            <option value="">All types</option>
            {buyerTypes.map((t) => (
              <option key={t} value={t}>
                {BUYER_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-secondary text-sm">Filter</button>
        {typeFilter || q ? (
          <Link href="/admin/order-guides" className="btn-ghost text-sm">
            Clear
          </Link>
        ) : null}
      </form>

      <div className="card divide-y divide-black/5 overflow-hidden">
        {buyers.length === 0 ? (
          <div className="p-6 text-sm text-ink-secondary text-center">No buyers match.</div>
        ) : (
          buyers.map((b) => {
            const stats = guideStats[b.id];
            const itemCount = stats?.items ?? 0;
            const groups = stats?.groups ?? [];
            const effective = (b.buyer_type ?? b.account?.buyer_type) as BuyerType | null;
            const isOverride = !!b.buyer_type && b.buyer_type !== b.account?.buyer_type;
            return (
              <Link
                key={b.id}
                href={
                  b.account_id
                    ? `/admin/accounts/${b.account_id}/buyers/${b.id}`
                    : `/admin/accounts`
                }
                className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-4 py-3 hover:bg-bg-secondary transition"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate flex items-center gap-2 flex-wrap">
                    <span>
                      {b.first_name} {b.last_name}
                    </span>
                    {effective ? (
                      <span
                        className={isOverride ? "badge-blue" : "badge-gray"}
                        title={isOverride ? "Per-buyer override" : "Inherited from account"}
                      >
                        {BUYER_TYPE_LABELS[effective]}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-ink-secondary truncate mt-0.5">
                    {b.account?.name ?? "— no account —"}
                  </div>
                </div>
                <div className="text-right min-w-[110px]">
                  <div className="text-sm tabular font-semibold">
                    {itemCount > 0 ? itemCount : <span className="text-feedback-error">empty</span>}
                  </div>
                  <div className="text-[11px] text-ink-tertiary">
                    {groups.map((g) => GROUP_LABELS[g]).join(", ") || "—"}
                  </div>
                </div>
                <span className="text-ink-tertiary">→</span>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "green" | "rust";
}) {
  const color =
    tone === "green" ? "text-brand-green-dark" : tone === "rust" ? "text-[#7a3b1f]" : "text-ink-primary";
  return (
    <div className="card p-4">
      <div className={`display tabular text-3xl font-bold tracking-tight ${color}`}>{value}</div>
      <div className="text-xs text-ink-secondary mt-1 uppercase tracking-wide">{label}</div>
    </div>
  );
}
