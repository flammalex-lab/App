import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import type { Account, AccountPricing, Category, Product } from "@/lib/supabase/types";
import { resolvePrice } from "@/lib/utils/pricing";
import { CATEGORY_LABELS } from "@/lib/constants";
import { productImage } from "@/lib/utils/product-image";
import { ProductDetailClient } from "./ProductDetailClient";

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

  const { data: acctRow } = me.account_id
    ? await db.from("accounts").select("*").eq("id", me.account_id).maybeSingle()
    : { data: null as Account | null };
  const account = acctRow as Account | null;

  const { data: override } = account
    ? await db
        .from("account_pricing")
        .select("*")
        .eq("account_id", account.id)
        .eq("product_id", id)
        .maybeSingle()
    : { data: null as AccountPricing | null };

  const unitPrice = resolvePrice(product as Product, {
    account,
    customPrice: override as AccountPricing | null,
    isB2B: me.role === "b2b_buyer",
  });

  const p = product as Product;
  // Back link points to the category the user came from, falls back to main catalog
  const backHref = from
    ? `/catalog?category=${encodeURIComponent(from)}`
    : `/catalog?category=${encodeURIComponent(p.category)}`;
  const backLabel = from ? CATEGORY_LABELS[from as Category] ?? "Catalog" : CATEGORY_LABELS[p.category];

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-0 pt-4">
      <Link href={backHref} className="text-sm text-ink-secondary hover:underline">
        ← {backLabel}
      </Link>
      <div className="grid md:grid-cols-2 gap-6 mt-3">
        <div className="aspect-square bg-bg-secondary rounded-xl overflow-hidden">
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
          <div className="mt-4 text-2xl mono">
            {unitPrice != null ? (
              <>
                ${unitPrice.toFixed(2)}
                <span className="text-sm text-ink-secondary"> / {p.unit}</span>
              </>
            ) : (
              <span className="text-ink-secondary text-base">Price on request</span>
            )}
          </div>
          {unitPrice != null ? (
            <ProductDetailClient
              product={p}
              unitPrice={unitPrice}
              showAddToGuide={me.role === "b2b_buyer"}
            />
          ) : (
            <p className="mt-4 text-sm text-ink-secondary">
              Contact your rep for pricing on this item.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
