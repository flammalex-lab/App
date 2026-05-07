"use client";

import Link from "next/link";
import type { Product } from "@/lib/supabase/types";
import { productImage } from "@/lib/utils/product-image";
import { BRAND_LABELS } from "@/lib/constants";
import { ProductDetailClient, type PackRow } from "./ProductDetailClient";

/**
 * Shared 2-column product detail body. Used by:
 *   - the parallel-route modal (BottomSheet on mobile, centered modal on md+)
 *   - the full /catalog/[id] page
 *
 * Both pass the same product/packs/isB2B/inGuide props; the modal also
 * wires onClose so its inner links can dismiss the modal before
 * navigating.
 */
export function ProductDetailContent({
  product,
  packs,
  isB2B,
  inGuide,
  onClose,
}: {
  product: Product;
  packs: PackRow[];
  isB2B: boolean;
  inGuide: boolean;
  onClose?: () => void;
}) {
  const brandLabel = BRAND_LABELS[product.brand];
  const producerOrBrand = product.producer ?? brandLabel;

  return (
    <div className="md:grid md:grid-cols-2 md:gap-0">
      <div className="relative aspect-[4/3] md:aspect-auto md:min-h-[480px] bg-white border-b md:border-b-0 md:border-r border-black/[0.06] bg-gradient-radial-soft">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={productImage(product)}
          alt=""
          className="absolute inset-0 w-full h-full object-contain p-6 md:p-12 mix-blend-multiply"
        />
      </div>

      <div className="px-5 md:px-8 pb-6 pt-4 md:py-10">
        {producerOrBrand ? (
          <Link
            href={
              product.producer
                ? `/catalog?producer=${encodeURIComponent(product.producer)}`
                : "/catalog"
            }
            onClick={onClose}
            className="inline-flex items-center gap-2 text-sm text-ink-secondary hover:text-ink-primary transition-colors duration-150"
          >
            <span
              aria-hidden
              className="inline-block h-5 w-5 rounded bg-brand-green/15 text-brand-green flex items-center justify-center text-[10px] font-bold"
            >
              {producerOrBrand.slice(0, 1).toUpperCase()}
            </span>
            <span>
              Find more from <span className="underline font-medium">{producerOrBrand}</span>
            </span>
          </Link>
        ) : null}

        <h1 className="display text-2xl md:text-3xl tracking-tight mt-2">{product.name}</h1>

        <p className="text-sm text-ink-secondary mt-2">
          {product.pack_size ? <>Pack: {product.pack_size}</> : null}
          {product.pack_size && product.case_pack ? <> · </> : null}
          {product.case_pack ? <>Case: {product.case_pack}</> : null}
          {(product.pack_size || product.case_pack) && brandLabel ? <> · </> : null}
          {brandLabel ? <>Brand: {brandLabel.toUpperCase()}</> : null}
        </p>

        {packs.length > 0 ? (
          <ProductDetailClient
            product={product}
            packs={packs}
            showAddToGuide={isB2B}
            inGuideInitial={inGuide}
          />
        ) : (
          <p className="mt-4 text-sm text-ink-secondary">
            Contact your rep for pricing on this item.
          </p>
        )}

        {product.description ? (
          <section className="mt-6 pt-6 border-t border-black/[0.06]">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-tertiary mb-2">
              About
            </h2>
            <p className="text-sm text-ink-primary leading-relaxed">{product.description}</p>
          </section>
        ) : null}

        {product.sku || product.avg_weight_lbs || product.primal ? (
          <section className="mt-6 pt-6 border-t border-black/[0.06]">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-tertiary mb-2">
              Details
            </h2>
            <dl className="grid grid-cols-2 gap-y-1 gap-x-4 text-sm">
              {product.sku ? (
                <>
                  <dt className="text-ink-secondary">SKU</dt>
                  <dd className="tabular">{product.sku}</dd>
                </>
              ) : null}
              {product.avg_weight_lbs ? (
                <>
                  <dt className="text-ink-secondary">Avg weight</dt>
                  <dd>{product.avg_weight_lbs} lb</dd>
                </>
              ) : null}
              {product.primal ? (
                <>
                  <dt className="text-ink-secondary">Primal</dt>
                  <dd>{product.primal}</dd>
                </>
              ) : null}
            </dl>
          </section>
        ) : null}
      </div>
    </div>
  );
}
