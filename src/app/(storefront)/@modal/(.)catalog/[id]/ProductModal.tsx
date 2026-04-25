"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/supabase/types";
import { ProductDetailClient, type PackRow } from "@/app/(storefront)/catalog/[id]/ProductDetailClient";
import { productImage } from "@/lib/utils/product-image";
import { BRAND_LABELS } from "@/lib/constants";
import { BottomSheet } from "@/components/ui/BottomSheet";

export function ProductModal({
  product,
  packs,
  showAddToGuide,
  inGuideInitial,
}: {
  product: Product;
  packs: PackRow[];
  showAddToGuide: boolean;
  inGuideInitial: boolean;
}) {
  const router = useRouter();

  function close() {
    router.back();
  }

  const brandLabel = BRAND_LABELS[product.brand];
  const producerOrBrand = product.producer ?? brandLabel;

  return (
    <BottomSheet
      open
      onClose={close}
      ariaLabel={product.name}
      desktopMaxWidth="64rem"
    >
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
              onClick={close}
              className="inline-flex items-center gap-2 text-sm text-ink-secondary hover:text-ink-primary"
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
            {product.pack_size ? <>Pack Size: {product.pack_size}</> : null}
            {product.pack_size && brandLabel ? <> · </> : null}
            {brandLabel ? <>Brand: {brandLabel.toUpperCase()}</> : null}
          </p>

          {packs.length > 0 ? (
            <ProductDetailClient
              product={product}
              packs={packs}
              showAddToGuide={showAddToGuide}
              inGuideInitial={inGuideInitial}
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

          <div className="mt-6 pt-4 border-t border-black/[0.06] flex items-center justify-between text-xs text-ink-tertiary">
            <Link
              href={`/catalog/${product.id}`}
              onClick={close}
              className="hover:text-ink-secondary hover:underline"
            >
              Open full page →
            </Link>
            {product.sku ? <span className="tabular">SKU {product.sku}</span> : null}
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
