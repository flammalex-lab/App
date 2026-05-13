import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import type { Brand, Category, Product } from "@/lib/supabase/types";
import { BRAND_LABELS, CATEGORY_LABELS } from "@/lib/constants";
import { WithoutImagesClient } from "./WithoutImagesClient";

export const metadata = { title: "Admin — Products without images" };

export default async function ProductsWithoutImagesPage({
  searchParams,
}: {
  searchParams: Promise<{ producer?: string; category?: string; brand?: string }>;
}) {
  await requireAdmin();
  const db = createServiceClient();
  const sp = await searchParams;

  // Pull every active product missing an image. Filterable by producer,
  // category, brand so admin can chunk through one brand at a time
  // (matches the folder-by-brand workflow).
  let q = db
    .from("products")
    .select("id, sku, name, producer, pack_size, unit, brand, category, image_url, sort_order")
    .eq("is_active", true)
    .or("image_url.is.null,image_url.eq.");
  if (sp.producer) q = q.ilike("producer", `%${sp.producer}%`);
  if (sp.category) q = q.eq("category", sp.category);
  if (sp.brand) q = q.eq("brand", sp.brand);
  const { data } = await q.order("producer").order("name");
  const products = (data as Product[] | null) ?? [];

  // Distinct producers among the result set so the filter chips reflect
  // what's still missing an image (rather than the full catalog list).
  const { data: allMissing } = await db
    .from("products")
    .select("producer")
    .eq("is_active", true)
    .or("image_url.is.null,image_url.eq.");
  const producerCounts = new Map<string, number>();
  for (const r of (allMissing as { producer: string | null }[] | null) ?? []) {
    const k = r.producer?.trim() || "—";
    producerCounts.set(k, (producerCounts.get(k) ?? 0) + 1);
  }
  const producers = Array.from(producerCounts.entries()).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  return (
    <div className="max-w-screen-2xl">
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-3">
        <div>
          <h1 className="display text-3xl">Products without images</h1>
          <p className="text-sm text-ink-secondary mt-1">
            Drop an image onto any card to upload it as that product&rsquo;s
            photo. No matching, no Claude — manual + immediate. Cards
            disappear after upload completes.
          </p>
        </div>
        <Link href="/admin/image-triage" className="text-sm underline">
          Bulk match flow →
        </Link>
      </div>

      <ProducerChips producers={producers} active={sp.producer ?? null} sp={sp} />

      <p className="text-xs text-ink-tertiary mb-4">
        Showing {products.length}{sp.producer ? ` for "${sp.producer}"` : ""} ·{" "}
        {producerCounts.size > 0
          ? `${Array.from(producerCounts.values()).reduce((a, b) => a + b, 0)} total without images across ${producerCounts.size} producers`
          : "all products have images ✓"}
      </p>

      <WithoutImagesClient products={products} />
    </div>
  );
}

function ProducerChips({
  producers,
  active,
  sp,
}: {
  producers: [string, number][];
  active: string | null;
  sp: { producer?: string; category?: string; brand?: string };
}) {
  if (producers.length <= 1) return null;
  function href(prod: string | null): string {
    const params = new URLSearchParams();
    if (prod) params.set("producer", prod);
    if (sp.category) params.set("category", sp.category);
    if (sp.brand) params.set("brand", sp.brand);
    const s = params.toString();
    return s ? `/admin/products/without-images?${s}` : "/admin/products/without-images";
  }
  return (
    <div className="flex flex-wrap gap-1.5 mb-3">
      <Link
        href={href(null)}
        className={`px-3 py-1 rounded-full border text-xs ${
          !active
            ? "bg-brand-blue text-white border-brand-blue"
            : "bg-white border-black/10 hover:border-brand-blue/50"
        }`}
      >
        All
      </Link>
      {producers.map(([prod, n]) => (
        <Link
          key={prod}
          href={href(prod === "—" ? null : prod)}
          className={`px-3 py-1 rounded-full border text-xs ${
            active === prod
              ? "bg-brand-blue text-white border-brand-blue"
              : "bg-white border-black/10 hover:border-brand-blue/50"
          }`}
        >
          {prod} <span className="opacity-60 tabular">{n}</span>
        </Link>
      ))}
    </div>
  );
}
