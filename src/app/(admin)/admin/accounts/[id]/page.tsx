import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Account, Activity, Order, Profile, StandingOrder } from "@/lib/supabase/types";
import { AccountForm } from "./AccountForm";
import { ActivityLogForm } from "./ActivityLogForm";
import { AddBuyerDialog } from "./AddBuyerDialog";
import { dateShort, money } from "@/lib/utils/format";
import { BUYER_TYPE_LABELS, GROUP_LABELS, type BuyerType, type ProductGroup } from "@/lib/constants";
import { StatusBadge } from "@/components/ui/Badge";

interface BuyerGuideStats {
  itemCount: number;
  groups: ProductGroup[];
}

export default async function AdminAccountDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await createClient();

  if (id === "new") {
    return (
      <div className="max-w-3xl">
        <h1 className="display text-3xl mb-4">New account</h1>
        <AccountForm account={null} />
      </div>
    );
  }

  const { data: account } = await db.from("accounts").select("*").eq("id", id).maybeSingle();
  if (!account) notFound();

  const [
    { data: buyers },
    { data: orders },
    { data: activities },
    { data: standing },
    overrideCount,
    { data: templatesRaw },
    { data: templateItemCountsRaw },
  ] = await Promise.all([
    db.from("profiles").select("*").eq("account_id", id),
    db.from("orders").select("*").eq("account_id", id).order("created_at", { ascending: false }).limit(25),
    db.from("activities").select("*").eq("account_id", id).order("created_at", { ascending: false }).limit(25),
    db.from("standing_orders").select("*").eq("account_id", id),
    db.from("account_pricing").select("id", { count: "exact", head: true }).eq("account_id", id),
    db.from("order_guide_templates").select("id, name, buyer_type").order("name"),
    db.from("order_guide_template_items").select("template_id"),
  ]);

  const itemCounts = new Map<string, number>();
  for (const r of ((templateItemCountsRaw as { template_id: string }[] | null) ?? [])) {
    itemCounts.set(r.template_id, (itemCounts.get(r.template_id) ?? 0) + 1);
  }
  const templateOptions = ((templatesRaw as { id: string; name: string; buyer_type: string | null }[] | null) ?? [])
    .map((t) => ({ ...t, itemCount: itemCounts.get(t.id) ?? 0 }));

  // Per-buyer guide stats — one batched query, aggregated in memory.
  const buyerStats: Record<string, BuyerGuideStats> = {};
  const buyerIds = ((buyers as Profile[] | null) ?? []).map((b) => b.id);
  if (buyerIds.length) {
    const { data: guideRows } = await db
      .from("order_guides")
      .select(`profile_id, order_guide_items(product:products(product_group))`)
      .in("profile_id", buyerIds)
      .eq("is_default", true);
    for (const g of ((guideRows as any[] | null) ?? [])) {
      const items = (g.order_guide_items as any[] | null) ?? [];
      const groupSet = new Set<ProductGroup>();
      for (const it of items) {
        const pg = it.product?.product_group as ProductGroup | null;
        if (pg) groupSet.add(pg);
      }
      buyerStats[g.profile_id as string] = {
        itemCount: items.length,
        groups: Array.from(groupSet),
      };
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="display text-3xl">{(account as Account).name}</h1>
          <p className="text-ink-secondary text-sm">{(account as Account).status}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/admin/accounts/${id}/pricing`} className="btn-ghost text-sm">
            Pricing ({overrideCount.count ?? 0})
          </Link>
        </div>
      </div>

      <AccountForm account={account as Account} />

      <section>
        <div className="flex items-center justify-between mb-2 gap-3">
          <div>
            <h2 className="display text-xl">Buyers</h2>
            <p className="text-xs text-ink-tertiary mt-0.5">
              Each buyer gets their own catalog scope and order guide
            </p>
          </div>
          <AddBuyerDialog
            accountId={id}
            accountBuyerType={(account as Account).buyer_type}
            templates={templateOptions}
          />
        </div>
        <div className="card divide-y divide-black/5">
          {((buyers as Profile[] | null) ?? []).map((b) => {
            const stats = buyerStats[b.id];
            const groupLabels = stats?.groups.map((g) => GROUP_LABELS[g]) ?? [];
            const effectiveType = (b.buyer_type ?? (account as Account).buyer_type) as BuyerType | null;
            const typeLabel = effectiveType ? BUYER_TYPE_LABELS[effectiveType] : null;
            const isOverride = !!b.buyer_type && b.buyer_type !== (account as Account).buyer_type;
            return (
              <div key={b.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate flex items-center gap-2 flex-wrap">
                    <span>
                      {b.first_name} {b.last_name}
                      {b.title ? <span className="text-ink-tertiary font-normal"> · {b.title}</span> : null}
                    </span>
                    {typeLabel ? (
                      <span
                        className={isOverride ? "badge-blue" : "badge-gray"}
                        title={isOverride ? "Per-buyer override of the account buyer type" : "Inherited from account"}
                      >
                        {typeLabel}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-ink-secondary truncate mt-0.5">
                    {b.email ?? b.phone}
                  </div>
                  <div className="text-xs text-ink-tertiary mt-1">
                    {stats && stats.itemCount > 0 ? (
                      <>
                        <span className="tabular font-medium text-ink-secondary">
                          {stats.itemCount}
                        </span>{" "}
                        {stats.itemCount === 1 ? "item" : "items"}
                        {groupLabels.length ? <> · {groupLabels.join(", ")}</> : null}
                      </>
                    ) : (
                      <span className="italic">Empty guide — click Edit guide to set it up</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Link href={`/admin/accounts/${id}/buyers/${b.id}`} className="btn-ghost text-sm">
                    Edit buyer
                  </Link>
                  <form action={`/api/admin/impersonate/start?profileId=${b.id}`} method="post">
                    <button className="btn-secondary text-sm">View as buyer</button>
                  </form>
                </div>
              </div>
            );
          })}
          {!(buyers as Profile[] | null)?.length ? (
            <div className="p-6 text-sm text-ink-secondary text-center">
              No buyers yet. Click <strong>Add buyer</strong> above to invite one.
            </div>
          ) : null}
        </div>
      </section>

      <section>
        <h2 className="display text-xl mb-2">Recent orders</h2>
        <div className="card divide-y divide-black/5 overflow-hidden">
          {((orders as Order[] | null) ?? []).map((o) => (
            <Link
              key={o.id}
              href={`/admin/orders/${o.id}`}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-bg-secondary transition"
            >
              <span className="tabular font-medium">{o.order_number}</span>
              <div className="min-w-0 flex items-center gap-2">
                <span className="truncate text-xs text-ink-secondary">{dateShort(o.created_at)}</span>
                <StatusBadge status={o.status} />
              </div>
              <span className="tabular font-semibold">{money(o.total)}</span>
            </Link>
          ))}
          {!((orders as Order[] | null) ?? []).length ? (
            <div className="p-4 text-sm text-ink-secondary">No orders yet.</div>
          ) : null}
        </div>
      </section>

      <section>
        <h2 className="display text-xl mb-2">Standing orders</h2>
        <div className="card">
          {((standing as StandingOrder[] | null) ?? []).map((s) => (
            <Link key={s.id} href={`/admin/standing/${s.id}`} className="p-3 text-sm flex justify-between hover:bg-bg-secondary">
              <span>
                {s.name ?? "Standing order"} · {s.frequency} · {s.days_of_week.join(", ")}
              </span>
              <span>{s.active ? "active" : "off"}</span>
            </Link>
          ))}
          {!(standing as StandingOrder[] | null)?.length ? (
            <div className="p-4 text-sm text-ink-secondary">No standing orders.</div>
          ) : null}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="display text-xl">Activity log</h2>
        </div>
        <ActivityLogForm accountId={id} />
        <div className="card divide-y divide-black/5 mt-2">
          {((activities as Activity[] | null) ?? []).map((a) => (
            <div key={a.id} className="p-3 text-sm">
              <div className="flex justify-between">
                <span>
                  <span className="badge-gray">{a.type}</span> {a.subject}
                </span>
                <span className="text-xs text-ink-secondary">{dateShort(a.created_at)}</span>
              </div>
              {a.body ? <div className="text-xs text-ink-secondary mt-1">{a.body}</div> : null}
              {a.follow_up_date ? (
                <div className="text-xs text-accent-gold mt-1">
                  follow up {dateShort(a.follow_up_date)}
                </div>
              ) : null}
            </div>
          ))}
          {!((activities as Activity[] | null) ?? []).length ? (
            <div className="p-4 text-sm text-ink-secondary">No activity logged.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
