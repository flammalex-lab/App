import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { NewTemplateForm, type TemplateSourceOption } from "./NewTemplateForm";

export const metadata = { title: "Admin — New template" };

export default async function NewTemplatePage() {
  await requireAdmin();
  const svc = createServiceClient();

  const [{ data: templatesRaw }, { data: itemCountsRaw }] = await Promise.all([
    svc.from("order_guide_templates").select("id, name, buyer_type").order("name"),
    svc.from("order_guide_template_items").select("template_id"),
  ]);
  const itemCounts = new Map<string, number>();
  for (const r of ((itemCountsRaw as { template_id: string }[] | null) ?? [])) {
    itemCounts.set(r.template_id, (itemCounts.get(r.template_id) ?? 0) + 1);
  }
  const sourceOptions: TemplateSourceOption[] = ((templatesRaw as { id: string; name: string; buyer_type: string | null }[] | null) ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    buyer_type: t.buyer_type,
    itemCount: itemCounts.get(t.id) ?? 0,
  }));

  return (
    <div className="max-w-2xl space-y-4">
      <Link
        href="/admin/order-guides/templates"
        className="text-sm text-ink-secondary hover:underline"
      >
        ← Templates
      </Link>
      <h1 className="display text-3xl">New template</h1>
      <p className="text-sm text-ink-secondary">
        Give it a name like <em>Produce</em> or <em>Lincoln Market Dairy</em>.
        Optionally seed it from an existing template and then edit from there.
      </p>
      <NewTemplateForm sources={sourceOptions} />
    </div>
  );
}
