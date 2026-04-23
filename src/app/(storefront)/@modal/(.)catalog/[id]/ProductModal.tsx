"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/supabase/types";
import { ProductDetailClient, type PackRow } from "@/app/(storefront)/catalog/[id]/ProductDetailClient";
import { productImage } from "@/lib/utils/product-image";
import { BRAND_LABELS } from "@/lib/constants";

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
  const panelRef = useRef<HTMLDivElement>(null);

  function close() {
    router.back();
  }

  // Close on ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lock body scroll while the modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function onBackdropClick(e: React.MouseEvent) {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) close();
  }

  const brandLabel = BRAND_LABELS[product.brand];
  const producerOrBrand = product.producer ?? brandLabel;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
      onMouseDown={onBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/50 animate-fade-in"
    >
      <div
        ref={panelRef}
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto animate-slide-up"
      >
        <button
          onClick={close}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 h-9 w-9 rounded-full bg-white/80 backdrop-blur hover:bg-white flex items-center justify-center text-xl text-ink-secondary hover:text-ink-primary transition shadow-sm"
        >
          ×
        </button>

        <div className="relative aspect-[4/3] sm:aspect-[16/10] bg-bg-secondary">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={productImage(product)}
            alt=""
            className="absolute inset-0 w-full h-full object-contain p-8"
          />
        </div>

        <div className="px-5 md:px-7 pb-6 pt-4">
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
            {product.description ? (
              <>
                {" "}
                | {product.description}
              </>
            ) : null}
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
            <section className="mt-6 pt-6 border-t border-black/5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-tertiary mb-2">
                About
              </h2>
              <p className="text-sm text-ink-primary leading-relaxed">{product.description}</p>
            </section>
          ) : null}

          <div className="mt-6 pt-4 border-t border-black/5 flex items-center justify-between text-xs text-ink-tertiary">
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
    </div>
  );
}
