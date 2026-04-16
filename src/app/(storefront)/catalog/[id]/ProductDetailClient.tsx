"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PackOption, Product } from "@/lib/supabase/types";
import { useCart } from "@/lib/cart/store";
import { money } from "@/lib/utils/format";

export interface PackRow {
  /** null for the product's built-in default variant */
  variantKey: string | null;
  label: string;      // "Case" / "Each" / "Half case"
  unit: string;       // "case" / "each"
  packSize: string | null;
  sku: string | null; // variant SKU or product SKU
  unitPrice: number;
}

export function ProductDetailClient({
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
  const add = useCart((s) => s.add);
  const setQty = useCart((s) => s.setQty);
  const lines = useCart((s) => s.lines);
  const [guideState, setGuideState] = useState<"idle" | "saving" | "saved">(
    inGuideInitial ? "saved" : "idle",
  );

  function qtyFor(variantKey: string | null): number {
    return lines.find((l) => l.productId === product.id && (l.variantKey ?? null) === variantKey)
      ?.quantity ?? 0;
  }

  function addOne(p: PackRow) {
    add({
      productId: product.id,
      variantKey: p.variantKey,
      variantSku: p.variantKey ? p.sku : null,
      sku: product.sku,
      name: product.name,
      packSize: p.packSize,
      unit: p.unit,
      unitPrice: p.unitPrice,
      priceByWeight: Boolean(product.price_by_weight),
      quantity: 1,
    });
  }
  function sub(p: PackRow) {
    setQty(product.id, Math.max(0, qtyFor(p.variantKey) - 1), p.variantKey);
  }

  async function star() {
    if (guideState !== "idle") return;
    setGuideState("saving");
    const res = await fetch("/api/my-guide/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: product.id }),
    });
    setGuideState(res.ok ? "saved" : "idle");
  }

  const saved = guideState === "saved";

  return (
    <div className="mt-5 space-y-3">
      <ul className="card divide-y divide-black/5 overflow-hidden">
        {packs.map((p) => {
          const qty = qtyFor(p.variantKey);
          return (
            <li key={p.variantKey ?? "default"} className="p-3 flex items-center gap-3">
              {showAddToGuide ? (
                <button
                  onClick={star}
                  aria-label={saved ? "Added to your guide" : "Add to your guide"}
                  className={`h-7 w-7 shrink-0 inline-flex items-center justify-center transition ${
                    saved ? "text-accent-gold" : "text-ink-tertiary hover:text-accent-gold"
                  }`}
                  disabled={guideState === "saving"}
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                    <path d="M12 2l3 7h7l-5.7 4.3L18 21l-6-4-6 4 1.7-7.7L2 9h7l3-7z" />
                  </svg>
                </button>
              ) : (
                <div className="h-7 w-7 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{p.label}</div>
                <div className="text-xs text-ink-secondary mono">
                  {p.sku ? `${p.sku} · ` : ""}
                  {money(p.unitPrice)}
                  <span className="text-ink-tertiary"> / {p.unit}</span>
                  {product.price_by_weight ? (
                    <span className="ml-1 text-accent-gold">· est.</span>
                  ) : null}
                </div>
              </div>
              {qty > 0 ? (
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => sub(p)}
                    className="h-8 w-8 rounded-full border border-black/10 flex items-center justify-center text-sm hover:bg-bg-secondary"
                    aria-label="Remove one"
                  >
                    {qty === 1 ? "🗑" : "−"}
                  </button>
                  <span className="mono font-semibold w-6 text-center text-sm">{qty}</span>
                  <button
                    onClick={() => addOne(p)}
                    className="h-8 w-8 rounded-full bg-brand-green text-white flex items-center justify-center hover:bg-brand-green-dark transition"
                    aria-label="Add one"
                  >
                    +
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => addOne(p)}
                  className="h-9 w-9 rounded-full bg-brand-green text-white text-lg flex items-center justify-center hover:bg-brand-green-dark transition shrink-0"
                  aria-label="Add to cart"
                >
                  +
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {product.price_by_weight ? (
        <p className="text-xs text-ink-tertiary px-1">
          Weight-priced — final line total is confirmed by the distributor at fulfillment.
        </p>
      ) : null}

      <button
        onClick={() => router.push("/cart")}
        className="btn-ghost text-sm w-full"
      >
        Go to cart →
      </button>
    </div>
  );
}

export function defaultPackRow(product: Product, unitPrice: number): PackRow {
  return {
    variantKey: null,
    label: titleCase(product.unit) + (product.pack_size ? ` — ${product.pack_size}` : ""),
    unit: product.unit,
    packSize: product.pack_size,
    sku: product.sku,
    unitPrice,
  };
}

export function optionPackRow(product: Product, opt: PackOption, unitPrice: number): PackRow {
  return {
    variantKey: opt.key,
    label: opt.label,
    unit: opt.unit,
    packSize: opt.pack_size,
    sku: opt.sku ?? product.sku,
    unitPrice,
  };
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
