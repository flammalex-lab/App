"use client";

import { useState } from "react";
import type { PackOption, Product } from "@/lib/supabase/types";
import { useCart } from "@/lib/cart/store";
import { money } from "@/lib/utils/format";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { NumpadSheet } from "@/components/ui/NumpadSheet";

interface VariantRow {
  variantKey: string | null;
  label: string;
  unit: string;
  packSize: string | null;
  unitPrice: number;
  sku: string | null;
  variantSku: string | null;
  priceByWeight: boolean;
}

/**
 * Bottom sheet for products with multiple pack options (case vs unit,
 * etc.). Each variant gets its own stepper + tappable qty digit so the
 * buyer can quickly say "3 cases" without 48 + taps. Changes apply
 * to the cart immediately — sheet just stays open until dismissed.
 */
export function VariantPickerSheet({
  open,
  onClose,
  product,
  defaultUnitPrice,
  defaultVariantPrices,
}: {
  open: boolean;
  onClose: () => void;
  product: Product;
  /** Resolved price for the default (no-variant) pack. null → not orderable. */
  defaultUnitPrice: number | null;
  /** Resolved price per pack_option key. Falls back to wholesale_price/retail_price. */
  defaultVariantPrices: Record<string, number | null>;
}) {
  const lines = useCart((s) => s.lines);
  const add = useCart((s) => s.add);
  const setQty = useCart((s) => s.setQty);
  const [numpad, setNumpad] = useState<{ variantKey: string | null; current: number; row: VariantRow } | null>(null);

  // Build the variant rows: default first, then each pack_option that has
  // a resolvable price.
  const rows: VariantRow[] = [];
  if (defaultUnitPrice != null) {
    rows.push({
      variantKey: null,
      label: product.pack_size ?? "Each",
      unit: product.unit,
      packSize: product.pack_size,
      unitPrice: defaultUnitPrice,
      sku: product.sku,
      variantSku: null,
      priceByWeight: Boolean(product.price_by_weight),
    });
  }
  for (const opt of (product.pack_options as PackOption[] | null) ?? []) {
    const price = defaultVariantPrices[opt.key];
    if (price == null) continue;
    rows.push({
      variantKey: opt.key,
      label: opt.label,
      unit: opt.unit,
      packSize: opt.pack_size,
      unitPrice: price,
      sku: product.sku,
      variantSku: opt.sku,
      priceByWeight: false,
    });
  }

  function qtyFor(variantKey: string | null): number {
    return (
      lines.find((l) => l.productId === product.id && (l.variantKey ?? null) === variantKey)
        ?.quantity ?? 0
    );
  }

  function commit(row: VariantRow, next: number) {
    haptic(next > qtyFor(row.variantKey) ? 8 : 6);
    if (next === 0) {
      setQty(product.id, 0, row.variantKey);
      return;
    }
    const cur = qtyFor(row.variantKey);
    if (cur === 0) {
      add({
        productId: product.id,
        variantKey: row.variantKey,
        variantSku: row.variantSku,
        sku: row.sku,
        name: product.name,
        packSize: row.packSize,
        unit: row.unit,
        unitPrice: row.unitPrice,
        priceByWeight: row.priceByWeight,
        quantity: next,
      });
    } else {
      setQty(product.id, next, row.variantKey);
    }
  }

  return (
    <>
      <BottomSheet open={open} onClose={onClose} title={product.name}>
        <div className="px-2 pt-1 pb-3">
          {product.producer ? (
            <div className="text-[11px] uppercase tracking-wider font-medium text-brand-green-dark mb-2 px-3">
              {product.producer}
            </div>
          ) : null}

          {rows.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-ink-secondary">
              Contact your rep for pricing on this item.
            </p>
          ) : (
            <ul className="divide-y divide-black/[0.06]">
              {rows.map((row) => {
                const qty = qtyFor(row.variantKey);
                return (
                  <li key={row.variantKey ?? "default"} className="flex items-center gap-3 px-3 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-[15px] font-medium leading-snug">{row.label}</div>
                      <div className="text-[13px] text-ink-secondary tabular mt-0.5">
                        {money(row.unitPrice)} / {row.unit}
                        {row.packSize && row.packSize !== row.label ? (
                          <span className="text-ink-tertiary"> · {row.packSize}</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center bg-bg-secondary rounded-full">
                      <button
                        onClick={() => commit(row, Math.max(0, qty - 1))}
                        className="h-12 w-12 flex items-center justify-center rounded-full text-brand-green-dark hover:bg-brand-green-tint focus:outline-none focus:ring-2 focus:ring-brand-green/40 transition-colors duration-150 disabled:opacity-30"
                        aria-label="Decrease"
                        disabled={qty === 0}
                      >
                        <span className="text-xl leading-none">−</span>
                      </button>
                      <button
                        onClick={() => setNumpad({ variantKey: row.variantKey, current: qty, row })}
                        className="tabular text-[16px] font-semibold w-10 text-center select-none focus:outline-none focus:ring-2 focus:ring-brand-blue/40 rounded-md py-1.5"
                        aria-label="Type quantity"
                      >
                        {qty}
                      </button>
                      <button
                        onClick={() => commit(row, qty + 1)}
                        className="h-12 w-12 flex items-center justify-center rounded-full bg-brand-green-dark text-white hover:bg-brand-green-dark/90 focus:outline-none focus:ring-2 focus:ring-brand-green/40 transition-colors duration-150"
                        aria-label="Add one"
                      >
                        <span className="text-xl leading-none">+</span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="text-[12px] text-ink-tertiary text-center px-5 mt-3">
            Tap the number to type a quantity directly.
          </p>
        </div>
      </BottomSheet>

      {numpad ? (
        <NumpadSheet
          open
          onClose={() => setNumpad(null)}
          initial={numpad.current}
          unitHint={numpad.row.unit}
          productName={product.name}
          packLabel={numpad.row.label}
          onSet={(n) => commit(numpad.row, n)}
        />
      ) : null}
    </>
  );
}

function haptic(ms: number) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      (navigator as Navigator & { vibrate: (p: number | number[]) => boolean }).vibrate(ms);
    } catch {
      /* ignore */
    }
  }
}
