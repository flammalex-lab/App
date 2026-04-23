import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import type { OrderGuideTemplate, OrderGuideTemplateItem, Product } from "@/lib/supabase/types";
import { allowedCategoriesFor, allowedGroupsFor, BUYER_TYPE_LABELS, type BuyerType } from "@/lib/constants";
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

  // Scope the picker to the template's buyer_type (if set). Lets the admin
  // curate without wading through irrelevant categories. If no buyer_type,
  // show everything.
  const allowedCats = allowedCategoriesFor(t.buyer_type);
  const allowedGroups = allowedGroupsFor(t.buyer_type);
  const orExpr = [
    allowedCats.length ? `category.in.(${allowedCats.join(",")})` : null,
    allowedGroups.length ? `product_group.in.(${allowedGroups.join(",")})` : null,
  ]
    .filter(Boolean)
    .join(",");
  const baseQuery = svc.from("products").select("*").eq("is_active", true);
  const { data: productsRaw } = t.buyer_type
    ? await baseQuery.or(orExpr).order("sort_order")
    : await baseQuery.order("sort_order");

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
