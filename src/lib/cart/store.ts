"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartLine {
  productId: string;
  sku: string | null;
  name: string;
  packSize: string | null;
  unit: string;
  unitPrice: number;
  quantity: number;
  notes?: string;
}

interface CartState {
  lines: CartLine[];
  // Checkout state — persisted so /cart → /cart/review can share it
  deliveryDate: string | null;
  pickupDate: string | null;
  pickupLocationId: string | null;
  orderNote: string;
  // Mutators
  add: (line: CartLine) => void;
  setQty: (productId: string, qty: number) => void;
  setNotes: (productId: string, notes: string) => void;
  remove: (productId: string) => void;
  clear: () => void;
  bulkSet: (lines: CartLine[]) => void;
  setDeliveryDate: (d: string | null) => void;
  setPickup: (date: string | null, locationId: string | null) => void;
  setOrderNote: (note: string) => void;
  // Selectors
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
          const existing = state.lines.find((l) => l.productId === line.productId);
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                l.productId === line.productId ? { ...l, quantity: l.quantity + line.quantity } : l,
              ),
            };
          }
          return { lines: [...state.lines, line] };
        }),
      setQty: (productId, qty) =>
        set((state) => ({
          lines:
            qty <= 0
              ? state.lines.filter((l) => l.productId !== productId)
              : state.lines.map((l) => (l.productId === productId ? { ...l, quantity: qty } : l)),
        })),
      setNotes: (productId, notes) =>
        set((state) => ({
          lines: state.lines.map((l) => (l.productId === productId ? { ...l, notes } : l)),
        })),
      remove: (productId) =>
        set((state) => ({ lines: state.lines.filter((l) => l.productId !== productId) })),
      clear: () =>
        set({
          lines: [],
          deliveryDate: null,
          pickupDate: null,
          pickupLocationId: null,
          orderNote: "",
        }),
      bulkSet: (lines) => set({ lines }),
      setDeliveryDate: (d) => set({ deliveryDate: d }),
      setPickup: (date, locationId) => set({ pickupDate: date, pickupLocationId: locationId }),
      setOrderNote: (note) => set({ orderNote: note }),
      count: () => get().lines.reduce((s, l) => s + (l.quantity > 0 ? 1 : 0), 0),
      subtotal: () => get().lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0),
    }),
    { name: "flf-cart" },
  ),
);
