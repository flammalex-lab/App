"use client";

import type { PackOption, Product } from "@/lib/supabase/types";
import { useCart } from "@/lib/cart/store";
import { BottomSheet } from "@/components/ui/BottomSheet";
import {
  ProductStepper,
  PriceLine,
  haptic,
} from "@/components/products/primitives";
import { track } from "@/lib/analytics/track";

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
 * etc.). Each variant gets its own ProductStepper so the buyer can
 * quickly dial in "3 cases" without 48 + taps. Changes apply to the
 * cart immediately — the sheet stays open until dismissed.
 *
 * Color: brand-blue, matching every other stepper in the app. An older
 * version of this sheet used green; reverted as part of the card-system
 * standardization pass — green is reserved for the commit step (Place
 * order, Confirm) and shouldn't appear on per-row qty controls.
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
      // First time this variant is picked for this product — separate
      // from `add_to_cart` (fired by store) because variant_picked
      // captures the *choice between packs* signal: e.g. half-case vs.
      // case is the kind of insight we'd lose if we only saw add_to_cart.
      track("variant_picked", {
        product_id: product.id,
        variant_key: row.variantKey,
        variant_label: row.label,
        variant_sku: row.variantSku,
        unit_price: row.unitPrice,
      });
      add({
        productId: product.id,
        variantKey: row.variantKey,
        variantSku: row.variantSku,
        variantLabel: row.variantKey ? row.label : null,
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
    <BottomSheet open={open} onClose={onClose} title={product.name}>
      <div className="px-2 pt-1 pb-3">
        {product.producer ? (
          <div className="display text-[13px] font-medium text-ink-primary mb-2 px-3">
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
              const showPackChip = row.packSize && row.packSize !== row.label;
              return (
                <li
                  key={row.variantKey ?? "default"}
                  className="flex items-center gap-3 px-3 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-medium leading-snug">{row.label}</div>
                    <div className="mt-0.5">
                      <PriceLine
                        price={row.unitPrice}
                        unit={row.unit}
                        format="unit"
                        weight="medium"
                        textSize="sm"
                      />
                      {showPackChip ? (
                        <span className="text-ink-tertiary text-[13px] tabular"> · {row.packSize}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="shrink-0">
                    <ProductStepper
                      available
                      cartQty={qty}
                      onAdd={() => commit(row, qty + 1)}
                      onSub={() => commit(row, Math.max(0, qty - 1))}
                      onSet={(n) => commit(row, n)}
                      ariaProductName={`${product.name} ${row.label}`}
                      alwaysExpanded
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-[12px] text-ink-tertiary text-center px-5 mt-3">
          Tap the number to type any quantity.
        </p>
      </div>
    </BottomSheet>
  );
}
