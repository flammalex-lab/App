import type { PackOption, Product } from "@/lib/supabase/types";

export interface PackRow {
  /** null for the product's built-in default variant */
  variantKey: string | null;
  label: string;
  unit: string;
  packSize: string | null;
  sku: string | null;
  unitPrice: number;
}

export function defaultPackRow(product: Product, unitPrice: number): PackRow {
  return {
    variantKey: null,
    label:
      titleCase(product.unit) + (product.pack_size ? ` — ${product.pack_size}` : ""),
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
