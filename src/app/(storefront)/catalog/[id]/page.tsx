import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import type { Account, AccountPricing, PackOption, Product } from "@/lib/supabase/types";
import { resolvePrice } from "@/lib/utils/pricing";
import { CATEGORY_LABELS, GROUP_LABELS, type ProductGroup } from "@/lib/constants";
import { productImage } from "@/lib/utils/product-image";
import { dateShort, money } from "@/lib/utils/format";
import { ProductDetailClient } from "./ProductDetailClient";
import { defaultPackRow, optionPackRow, type PackRow } from "./packs";

export default async function ProductDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const impersonating = session.profile.role === "admin" ? getImpersonation() : null;
  const db = impersonating ? createServiceClient() : await createClient();

  const profileId = impersonating ?? session.userId;
  const { data: me } = await db.from("profiles").select("*").eq("id", profileId).maybeSingle();
  if (!me) redirect("/login");

  const { id } = await params;
  const { from } = await searchParams;
  const { data: product } = await db.from("products").select("*").eq("id", id).maybeSingle();
  if (!product) notFound();
  const p = product as Product;

  const { data: acctRow } = me.account_id
    ? await db.from("accounts").select("*").eq("id", me.account_id).maybeSingle()
    : { data: null as Account | null };
  const account = acctRow as Account | null;
  const isB2B = me.role === "b2b_buyer";

  const { data: override } = account
    ? await db
        .from("account_pricing")
        .select("*")
        .eq("account_id", account.id)
        .eq("product_id", id)
        .maybeSingle()
    : { data: null as AccountPricing | null };
  const customPrice = override as AccountPricing | null;

  const defaultPrice = resolvePrice(p, { account, customPrice, isB2B });

  // Build the packs list: default option first, then any pack_options the
  // product defines. Each option is priced using the same tier/override
  // logic as the default.
  const packs: PackRow[] = [];
  if (defaultPrice != null) packs.push(defaultPackRow(p, defaultPrice));
  const options = (p.pack_options as PackOption[] | null) ?? [];
  for (const opt of options) {
    const price = resolvePrice(
      { wholesale_price: opt.wholesale_price, retail_price: opt.retail_price },
      { account, customPrice, isB2B },
    );
    if (price != null) packs.push(optionPackRow(p, opt, price));
  }

  // Is this product already saved to the buyer's order guide?
  let inGuide = false;
  if (isB2B) {
    const { data: guideRows } = await db
      .from("order_guides")
      .select("id")
      .eq("profile_id", profileId)
      .eq("is_default", true);
    const guideId = (guideRows as { id: string }[] | null)?.[0]?.id;
    if (guideId) {
      const { data: existing } = await db
        .from("order_guide_items")
        .select("id")
        .eq("order_guide_id", guideId)
        .eq("product_id", id)
        .maybeSingle();
      inGuide = Boolean(existing);
    }
  }

  // Fulfillment history — this buyer's past orders containing this product
  const { data: historyRaw } = await db
    .from("order_items")
    .select(
      "id, quantity, unit_price, line_total, orders!inner(id, order_number, created_at, requested_delivery_date, pickup_date, status, profile_id)",
    )
    .eq("product_id", id)
    .eq("orders.profile_id", profileId)
    .order("created_at", { ascending: false, referencedTable: "orders" })
    .limit(10);
  const history = ((historyRaw as any[]) ?? []).map((r) => ({
    id: r.id as string,
    orderId: r.orders?.id as string,
    orderNumber: r.orders?.order_number as string,
    date: (r.orders?.requested_delivery_date ?? r.orders?.pickup_date ?? r.orders?.created_at) as string,
    qty: Number(r.quantity),
    unitPrice: Number(r.unit_price),
    total: Number(r.line_total),
  }));

  const fromIsSpecial = from === "explore" || from === "best";
  const backHref = from
    ? fromIsSpecial
      ? `/catalog?group=${from}`
      : `/catalog?group=${encodeURIComponent(from)}`
    : p.product_group
    ? `/catalog?group=${p.product_group}`
    : "/catalog";
  const backLabel = from
    ? from === "explore"
      ? "Explore"
      : from === "best"
      ? "Best sellers"
      : GROUP_LABELS[from as ProductGroup] ?? "Catalog"
    : p.product_group
    ? GROUP_LABELS[p.product_group as ProductGroup] ?? "Catalog"
    : "Catalog";

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-0 pt-4">
      <Link href={backHref} className="text-sm text-ink-secondary hover:underline">
        ← {backLabel}
      </Link>
      <div className="grid md:grid-cols-2 gap-6 mt-3">
        <div className="relative aspect-square bg-bg-secondary rounded-xl overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={productImage(p)} alt={p.name} className="w-full h-full object-cover" />
        </div>
        <div>
          <div className="text-sm text-ink-secondary">{CATEGORY_LABELS[p.category]}</div>
          <h1 className="display text-3xl mt-1 tracking-tight">{p.name}</h1>
          {p.producer ? (
            <Link
              href={`/catalog?producer=${encodeURIComponent(p.producer)}`}
              className="inline-block mt-1 text-sm text-brand-blue hover:underline"
            >
              More from {p.producer} →
            </Link>
          ) : null}
          {p.description ? <p className="text-ink-secondary mt-3">{p.description}</p> : null}
          <dl className="grid grid-cols-2 gap-y-1 gap-x-4 mt-4 text-sm">
            {p.sku ? (
              <>
                <dt className="text-ink-secondary">SKU</dt>
                <dd className="mono">{p.sku}</dd>
              </>
            ) : null}
            {p.pack_size ? (
              <>
                <dt className="text-ink-secondary">Pack</dt>
                <dd>{p.pack_size}</dd>
              </>
            ) : null}
            {p.case_pack ? (
              <>
                <dt className="text-ink-secondary">Case</dt>
                <dd>{p.case_pack}</dd>
              </>
            ) : null}
            {p.avg_weight_lbs ? (
              <>
                <dt className="text-ink-secondary">Avg weight</dt>
                <dd>{p.avg_weight_lbs} lb</dd>
              </>
            ) : null}
            {p.primal ? (
              <>
                <dt className="text-ink-secondary">Primal</dt>
                <dd>{p.primal}</dd>
              </>
            ) : null}
          </dl>

          {packs.length > 0 ? (
            <ProductDetailClient
              product={p}
              packs={packs}
              showAddToGuide={isB2B}
              inGuideInitial={inGuide}
            />
          ) : (
            <p className="mt-4 text-sm text-ink-secondary">
              Contact your rep for pricing on this item.
            </p>
          )}
        </div>
      </div>

      {history.length > 0 ? (
        <section className="mt-8">
          <h2 className="display text-xl mb-2">Your order history</h2>
          <div className="card divide-y divide-black/5 overflow-hidden">
            {history.map((h) => (
              <Link
                key={h.id}
                href={`/orders/${h.orderId}`}
                className="flex items-center px-4 py-3 hover:bg-bg-secondary"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{dateShort(h.date)}</div>
                  <div className="text-xs text-ink-secondary mono">
                    {h.orderNumber} · {h.qty} × {money(h.unitPrice)}
                  </div>
                </div>
                <div className="mono text-sm">{money(h.total)}</div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
