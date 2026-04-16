"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartLine {
  productId: string;
  /** null = default pack (unit/price on product row). Non-null keys come
   *  from product.pack_options[].key — e.g. "each", "half_case". */
  variantKey: string | null;
  /** Variant-specific SKU. Falls back to product.sku when variantKey is null. */
  variantSku: string | null;
  sku: string | null;
  name: string;
  packSize: string | null;
  unit: string;
  unitPrice: number;
  /** Catch-weight items show a "Final price confirmed by distributor" note. */
  priceByWeight: boolean;
  quantity: number;
  notes?: string;
}

function sameLine(l: CartLine, productId: string, variantKey: string | null): boolean {
  return l.productId === productId && (l.variantKey ?? null) === (variantKey ?? null);
}

interface CartState {
  lines: CartLine[];
  deliveryDate: string | null;
  pickupDate: string | null;
  pickupLocationId: string | null;
  orderNote: string;
  add: (line: CartLine) => void;
  setQty: (productId: string, qty: number, variantKey?: string | null) => void;
  setNotes: (productId: string, notes: string, variantKey?: string | null) => void;
  remove: (productId: string, variantKey?: string | null) => void;
  clear: () => void;
  bulkSet: (lines: CartLine[]) => void;
  setDeliveryDate: (d: string | null) => void;
  setPickup: (date: string | null, locationId: string | null) => void;
  setOrderNote: (note: string) => void;
  count: () => number;
  subtotal: () => number;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      deliveryDate: null,
      pickupDate: null,
      pickupLocationId: null,
      orderNote: "",
      add: (line) =>
        set((state) => {
          const vk = line.variantKey ?? null;
          const existing = state.lines.find((l) => sameLine(l, line.productId, vk));
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                sameLine(l, line.productId, vk)
                  ? { ...l, quantity: l.quantity + line.quantity }
                  : l,
              ),
            };
          }
          return { lines: [...state.lines, { ...line, variantKey: vk }] };
        }),
      setQty: (productId, qty, variantKey = null) =>
        set((state) => ({
          lines:
            qty <= 0
              ? state.lines.filter((l) => !sameLine(l, productId, variantKey))
              : state.lines.map((l) =>
                  sameLine(l, productId, variantKey) ? { ...l, quantity: qty } : l,
                ),
        })),
      setNotes: (productId, notes, variantKey = null) =>
        set((state) => ({
          lines: state.lines.map((l) =>
            sameLine(l, productId, variantKey) ? { ...l, notes } : l,
          ),
        })),
      remove: (productId, variantKey = null) =>
        set((state) => ({
          lines: state.lines.filter((l) => !sameLine(l, productId, variantKey)),
        })),
      clear: () =>
        set({
          lines: [],
          deliveryDate: null,
          pickupDate: null,
          pickupLocationId: null,
          orderNote: "",
        }),
      bulkSet: (lines) =>
        set({
          lines: lines.map((l) => ({
            ...l,
            variantKey: l.variantKey ?? null,
            variantSku: l.variantSku ?? null,
            priceByWeight: l.priceByWeight ?? false,
          })),
        }),
      setDeliveryDate: (d) => set({ deliveryDate: d }),
      setPickup: (date, locationId) => set({ pickupDate: date, pickupLocationId: locationId }),
      setOrderNote: (note) => set({ orderNote: note }),
      count: () => get().lines.reduce((s, l) => s + (l.quantity > 0 ? 1 : 0), 0),
      subtotal: () => get().lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0),
    }),
    {
      name: "flf-cart",
      version: 2,
      // If an older persisted cart is missing the new fields, backfill so
      // the app doesn't blow up on hydrate.
      migrate: (persisted: any) => {
        if (!persisted) return persisted;
        if (Array.isArray(persisted.lines)) {
          persisted.lines = persisted.lines.map((l: any) => ({
            ...l,
            variantKey: l.variantKey ?? null,
            variantSku: l.variantSku ?? null,
            priceByWeight: l.priceByWeight ?? false,
          }));
        }
        return persisted;
      },
    },
  ),
);
