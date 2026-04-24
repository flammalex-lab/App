import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import type { OrderGuideTemplate, OrderGuideTemplateItem, Product } from "@/lib/supabase/types";
import { BUYER_TYPE_LABELS, type BuyerType } from "@/lib/constants";
import { adminPickerProductsQuery } from "@/lib/products/queries";
import { TemplateEditor } from "./TemplateEditor";

type TemplateItemWithProduct = OrderGuideTemplateItem & { product: Product };

export default async function TemplateEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const svc = createServiceClient();

  const [{ data: template }, { data: itemsRaw }] = await Promise.all([
    svc.from("order_guide_templates").select("*").eq("id", id).maybeSingle(),
    svc
      .from("order_guide_template_items")
      .select("*, product:products(*)")
      .eq("template_id", id)
      .order("sort_order", { ascending: true }),
  ]);
  if (!template) notFound();
  const t = template as OrderGuideTemplate;
  const items = (itemsRaw as TemplateItemWithProduct[] | null) ?? [];

  // Scope the picker to the template's buyer_type so admins don't wade
  // through irrelevant categories. available_b2b not required — admins
  // curate templates ahead of go-live; TemplateEditor surfaces a
  // "Not live" badge on products that would be hidden from buyers.
  const { data: productsRaw } = await adminPickerProductsQuery(svc, {
    buyerType: t.buyer_type,
  }).order("sort_order");

  return (
    <div className="max-w-3xl space-y-4">
      <Link
        href="/admin/order-guides/templates"
        className="text-sm text-ink-secondary hover:underline"
      >
        ← Templates
      </Link>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="display text-3xl">{t.name}</h1>
          <p className="text-sm text-ink-secondary mt-1">
            {t.buyer_type ? (
              <>For: <strong>{BUYER_TYPE_LABELS[t.buyer_type as BuyerType]}</strong>. </>
            ) : null}
            {t.description}
          </p>
        </div>
      </div>

      <TemplateEditor
        template={t}
        initialItems={items}
        allProducts={(productsRaw as Product[] | null) ?? []}
      />
    </div>
  );
}
