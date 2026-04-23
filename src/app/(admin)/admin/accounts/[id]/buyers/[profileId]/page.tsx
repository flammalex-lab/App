import { notFound } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import type { Account, Order, Profile } from "@/lib/supabase/types";
import { BUYER_TYPE_LABELS, GROUP_LABELS, type BuyerType, type ProductGroup } from "@/lib/constants";
import { StatusBadge } from "@/components/ui/Badge";
import { dateShort, money } from "@/lib/utils/format";
import { BuyerForm } from "./BuyerForm";
import { DeleteBuyerButton } from "./DeleteBuyerButton";
import { TemplateSyncPanel, type TemplateLite } from "./TemplateSyncPanel";
import { computeGuideDrift } from "@/lib/order-guides/templates";

export default async function BuyerEditPage({
  params,
}: {
  params: Promise<{ id: string; profileId: string }>;
}) {
  await requireAdmin();
  const { id: accountId, profileId } = await params;
  const svc = createServiceClient();

  const [
    { data: account },
    { data: profile },
    { data: guide },
    { data: orders },
    { data: allTemplatesRaw },
    { data: templateItemCountsRaw },
  ] = await Promise.all([
    svc.from("accounts").select("*").eq("id", accountId).maybeSingle(),
    svc.from("profiles").select("*").eq("id", profileId).maybeSingle(),
    svc
      .from("order_guides")
      .select("id, order_guide_items(product:products(product_group))")
      .eq("profile_id", profileId)
      .eq("is_default", true)
      .order("created_at", { ascending: true })
      .limit(1),
    svc
      .from("orders")
      .select("*")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(5),
    svc
      .from("order_guide_templates")
      .select("id, name, buyer_type")
      .order("name"),
    svc.from("order_guide_template_items").select("template_id"),
  ]);

  if (!account || !profile) notFound();
  const a = account as Account;
  const p = profile as Profile;

  const guideRow = ((guide as any[] | null) ?? [])[0] ?? null;
  const guideItems = ((guideRow?.order_guide_items ?? []) as { product: { product_group: string | null } | null }[]);
  const guideCount = guideItems.length;
  const guideGroups = Array.from(
    new Set(guideItems.map((g) => g.product?.product_group).filter((g): g is ProductGroup => !!g)),
  );
  const effectiveType = (p.buyer_type ?? a.buyer_type) as BuyerType | null;
  const orderCount = ((orders as Order[] | null) ?? []).length;

  // Template item counts map
  const itemCounts = new Map<string, number>();
  for (const r of ((templateItemCountsRaw as { template_id: string }[] | null) ?? [])) {
    itemCounts.set(r.template_id, (itemCounts.get(r.template_id) ?? 0) + 1);
  }
  const allTemplates: TemplateLite[] = ((allTemplatesRaw as { id: string; name: string; buyer_type: string | null }[] | null) ?? []).map(
    (t) => ({ ...t, itemCount: itemCounts.get(t.id) ?? 0 }),
  );

  // Source templates currently attached to this buyer's guide.
  let sourceTemplates: TemplateLite[] = [];
  let drift = { addedByBuyer: 0, removedFromTemplates: 0, pendingSync: 0 };
  if (guideRow?.id) {
    const { data: sourcesRaw } = await svc
      .from("order_guide_seed_sources")
      .select("template_id")
      .eq("guide_id", guideRow.id);
    const sourceIds = new Set(((sourcesRaw as { template_id: string }[] | null) ?? []).map((s) => s.template_id));
    sourceTemplates = allTemplates.filter((t) => sourceIds.has(t.id));
    const d = await computeGuideDrift(svc, profileId, guideRow.id);
    drift = {
      addedByBuyer: d.addedByBuyer,
      removedFromTemplates: d.removedFromTemplates,
      pendingSync: d.pendingSync,
    };
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="text-sm text-ink-secondary">
        <Link href={`/admin/accounts/${accountId}`} className="hover:underline">
          ← {a.name}
        </Link>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="display text-3xl">
            {p.first_name} {p.last_name}
          </h1>
          <p className="text-ink-secondary text-sm mt-1">
            {p.title ? <>{p.title} · </> : null}
            {p.email ?? p.phone}
          </p>
        </div>
        <form action={`/api/admin/impersonate/start?profileId=${p.id}`} method="post">
          <button className="btn-secondary text-sm">View as buyer</button>
        </form>
      </div>

      <BuyerForm profile={p} accountBuyerType={a.buyer_type} />

      <section>
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="display text-xl">Order guide</h2>
          <Link
            href={`/admin/accounts/${accountId}/guide/${p.id}`}
            className="text-sm text-brand-blue hover:underline"
          >
            Open editor →
          </Link>
        </div>
        <div className="card p-4 mb-3">
          <div className="text-sm">
            {guideCount > 0 ? (
              <>
                <span className="tabular font-semibold">{guideCount}</span>{" "}
                {guideCount === 1 ? "item" : "items"}
                {guideGroups.length ? (
                  <span className="text-ink-secondary">
                    {" "}· {guideGroups.map((g) => GROUP_LABELS[g]).join(", ")}
                  </span>
                ) : null}
                {effectiveType ? (
                  <span className="text-ink-tertiary">
                    {" "}· buyer type: {BUYER_TYPE_LABELS[effectiveType]}
                  </span>
                ) : null}
              </>
            ) : (
              <span className="text-ink-secondary italic">
                Empty — attach a template below to seed starter items, or open
                the editor to curate manually.
              </span>
            )}
          </div>
        </div>
        <TemplateSyncPanel
          profileId={p.id}
          sourceTemplates={sourceTemplates}
          availableTemplates={allTemplates}
          drift={drift}
        />
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
          {orderCount === 0 ? (
            <div className="p-4 text-sm text-ink-secondary">No orders yet.</div>
          ) : null}
        </div>
      </section>

      <section className="border border-feedback-error/20 rounded-xl p-5 bg-feedback-error/[0.03]">
        <h2 className="display text-xl mb-1 text-feedback-error">Danger zone</h2>
        <p className="text-sm text-ink-secondary mb-3">
          Deleting this buyer removes their login and order guide. Their past
          orders stay on the account for the record — if they have any, the
          delete is blocked so history isn&rsquo;t lost.
        </p>
        <DeleteBuyerButton profileId={p.id} accountId={accountId} hasOrders={orderCount > 0} />
      </section>
    </div>
  );
}
