import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { BUYER_TYPE_LABELS, type BuyerType } from "@/lib/constants";
import { dateShort } from "@/lib/utils/format";

export const metadata = { title: "Admin — Order guide templates" };

type TemplateRow = {
  id: string;
  name: string;
  buyer_type: string | null;
  description: string | null;
  updated_at: string;
};

export default async function TemplatesListPage() {
  await requireAdmin();
  const svc = createServiceClient();

  const { data: templatesRaw } = await svc
    .from("order_guide_templates")
    .select("id, name, buyer_type, description, updated_at")
    .order("name", { ascending: true });
  const templates = (templatesRaw as TemplateRow[] | null) ?? [];

  // Counts — items per template + buyers seeded from each template.
  const { data: itemCountsRaw } = await svc
    .from("order_guide_template_items")
    .select("template_id");
  const itemCounts = new Map<string, number>();
  for (const r of ((itemCountsRaw as { template_id: string }[] | null) ?? [])) {
    itemCounts.set(r.template_id, (itemCounts.get(r.template_id) ?? 0) + 1);
  }

  const { data: usageRaw } = await svc
    .from("order_guide_seed_sources")
    .select("template_id");
  const usage = new Map<string, number>();
  for (const r of ((usageRaw as { template_id: string }[] | null) ?? [])) {
    usage.set(r.template_id, (usage.get(r.template_id) ?? 0) + 1);
  }

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/admin/order-guides"
            className="text-sm text-ink-secondary hover:underline"
          >
            ← Order guides
          </Link>
          <h1 className="display text-3xl mt-1">Templates</h1>
          <p className="text-sm text-ink-secondary mt-1">
            Admin-curated starter lists. Pick one (or combine several) when
            adding a buyer; they start with those items and curate from there.
          </p>
        </div>
        <Link href="/admin/order-guides/templates/new" className="btn-primary text-sm">
          New template
        </Link>
      </div>

      {templates.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-ink-secondary">
            No templates yet. Create one to prepopulate new buyers&rsquo; guides.
          </p>
        </div>
      ) : (
        <div className="card divide-y divide-black/5 overflow-hidden">
          {templates.map((t) => {
            const itemCount = itemCounts.get(t.id) ?? 0;
            const usedBy = usage.get(t.id) ?? 0;
            const bt = t.buyer_type as BuyerType | null;
            return (
              <Link
                key={t.id}
                href={`/admin/order-guides/templates/${t.id}`}
                className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-4 py-3 hover:bg-bg-secondary transition"
              >
                <div className="min-w-0">
                  <div className="font-medium flex items-center gap-2 flex-wrap">
                    <span>{t.name}</span>
                    {bt ? <span className="badge-gray">{BUYER_TYPE_LABELS[bt]}</span> : null}
                  </div>
                  {t.description ? (
                    <div className="text-xs text-ink-secondary truncate mt-0.5">{t.description}</div>
                  ) : null}
                </div>
                <div className="text-right min-w-[72px]">
                  <div className="tabular text-sm font-semibold">{itemCount}</div>
                  <div className="text-[11px] text-ink-tertiary">items</div>
                </div>
                <div className="text-right min-w-[72px]">
                  <div className="tabular text-sm font-semibold">{usedBy}</div>
                  <div className="text-[11px] text-ink-tertiary">
                    {usedBy === 1 ? "buyer" : "buyers"}
                  </div>
                </div>
                <div className="text-[11px] text-ink-tertiary">{dateShort(t.updated_at)}</div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
