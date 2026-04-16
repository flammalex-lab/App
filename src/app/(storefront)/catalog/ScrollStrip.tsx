import Link from "next/link";
import type { Product } from "@/lib/supabase/types";
import { productImage } from "@/lib/utils/product-image";
import { money } from "@/lib/utils/format";

type PricedProduct = Product & { unitPrice: number | null };

const NEW_DAYS = 60;
function isRecent(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && Date.now() - t < NEW_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Horizontal-scroll strip of product cards. Tap a card → product detail.
 * Keeps card chrome minimal so multiple strips can stack on the landing
 * without becoming visually noisy.
 */
export function ScrollStrip({
  title,
  href,
  subtitle,
  products,
  emoji,
}: {
  title: string;
  href?: string;
  subtitle?: string;
  products: PricedProduct[];
  emoji?: string;
}) {
  if (products.length === 0) return null;
  return (
    <section className="mb-6">
      <div className="flex items-baseline justify-between px-4 md:px-0 mb-2">
        <h2 className="display text-lg tracking-tight">
          {emoji ? <span className="mr-1">{emoji}</span> : null}
          {title}
        </h2>
        {href ? (
          <Link href={href} className="text-xs text-brand-blue hover:underline">
            See all →
          </Link>
        ) : null}
      </div>
      {subtitle ? (
        <p className="text-xs text-ink-secondary px-4 md:px-0 mb-2">{subtitle}</p>
      ) : null}
      <div className="flex gap-3 overflow-x-auto px-4 md:px-0 pb-2 snap-x -mx-0">
        {products.map((p) => (
          <StripCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}

function StripCard({ product }: { product: PricedProduct }) {
  return (
    <Link
      href={`/catalog/${product.id}`}
      className="shrink-0 w-[150px] snap-start card overflow-hidden hover:shadow-lg transition"
    >
      <div className="relative aspect-square bg-bg-secondary">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={productImage(product)}
          alt={product.name}
          className="absolute inset-0 w-full h-full object-cover"
        />
        {!product.available_this_week ? (
          <span className="absolute top-1.5 right-1.5 badge-gray text-[9px] bg-white/90">
            limited
          </span>
        ) : null}
        {isRecent(product.created_at) ? (
          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide rounded bg-accent-gold text-white shadow-sm">
            New
          </span>
        ) : null}
      </div>
      <div className="p-2">
        <div className="text-[12px] font-medium leading-tight line-clamp-2">{product.name}</div>
        {product.producer ? (
          <div className="text-[10px] text-ink-tertiary line-clamp-1 mt-0.5">
            {product.producer}
          </div>
        ) : null}
        <div className="mono text-[12px] mt-1">
          {product.unitPrice != null ? money(product.unitPrice) : "—"}
          <span className="text-ink-tertiary text-[10px]"> / {product.unit}</span>
        </div>
      </div>
    </Link>
  );
}
