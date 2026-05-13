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
  /** Human-readable variant name ("Case of 16") — only set when
   *  variantKey is non-null. Rendered as a chip on the cart line so
   *  buyers see which pack of a multi-variant product they picked. */
  variantLabel?: string | null;
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

/**
 * Draft mode (repeat-buyer order loop v2).
 *
 * The /guide draft pre-fills lines from the buyer's rhythm. Distinguishing
 * "the system suggested this" from "the buyer adjusted it" lets the UI
 * tell at a glance which lines are still on autopilot.
 *
 * `adjustedKeys` holds productId:variantKey pairs the buyer touched.
 * `rhythmQtyByKey` holds the original rhythm-suggested qty so a "skip"
 * (qty = 0) can be undone via the "Add back" pill. `skippedKeys` is the
 * set of rhythm products explicitly set to 0 — those rows stay rendered
 * (dimmed) instead of disappearing, so the buyer can put them back.
 */
function lineKey(productId: string, variantKey: string | null): string {
  return `${productId}::${variantKey ?? ""}`;
}

interface CartState {
  lines: CartLine[];
  deliveryDate: string | null;
  pickupDate: string | null;
  pickupLocationId: string | null;
  orderNote: string;
  adjustedKeys: string[];
  rhythmQtyByKey: Record<string, number>;
  skippedKeys: string[];
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
  // Draft-mode helpers — null-safe so legacy callers can ignore them.
  seedRhythm: (lines: CartLine[]) => void;
  markAdjusted: (productId: string, variantKey?: string | null) => void;
  skipLine: (productId: string, variantKey?: string | null) => void;
  addBackLine: (productId: string, variantKey?: string | null) => void;
  isAdjusted: (productId: string, variantKey?: string | null) => boolean;
  isSkipped: (productId: string, variantKey?: string | null) => boolean;
  rhythmQtyFor: (productId: string, variantKey?: string | null) => number | null;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      deliveryDate: null,
      pickupDate: null,
      pickupLocationId: null,
      orderNote: "",
      adjustedKeys: [],
      rhythmQtyByKey: {},
      skippedKeys: [],
      add: (line) =>
        set((state) => {
          const vk = line.variantKey ?? null;
          const key = lineKey(line.productId, vk);
          // Adding ANY quantity to a line counts as a buyer adjustment —
          // distinguishes "I touched this" from "the system suggested this."
          // Adding also clears a prior skip — you can't be both adjusting
          // and skipping the same line.
          const adjustedKeys = state.adjustedKeys.includes(key)
            ? state.adjustedKeys
            : [...state.adjustedKeys, key];
          const skippedKeys = state.skippedKeys.filter((k) => k !== key);
          const existing = state.lines.find((l) => sameLine(l, line.productId, vk));
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                sameLine(l, line.productId, vk)
                  ? { ...l, quantity: l.quantity + line.quantity }
                  : l,
              ),
              adjustedKeys,
              skippedKeys,
            };
          }
          return {
            lines: [...state.lines, { ...line, variantKey: vk }],
            adjustedKeys,
            skippedKeys,
          };
        }),
      setQty: (productId, qty, variantKey = null) =>
        set((state) => {
          const key = lineKey(productId, variantKey);
          // Any explicit qty change = a buyer adjustment. setQty(_,0) is
          // the "remove" path for non-draft callers; we still keep the
          // skipped marker in sync so the draft UI doesn't render a
          // ghost row that shouldn't be ghost.
          const adjustedKeys = state.adjustedKeys.includes(key)
            ? state.adjustedKeys
            : [...state.adjustedKeys, key];
          const skippedKeys =
            qty <= 0
              ? state.skippedKeys // setQty(0) goes through skipLine if it's a rhythm row
              : state.skippedKeys.filter((k) => k !== key);
          return {
            lines:
              qty <= 0
                ? state.lines.filter((l) => !sameLine(l, productId, variantKey))
                : state.lines.map((l) =>
                    sameLine(l, productId, variantKey) ? { ...l, quantity: qty } : l,
                  ),
            adjustedKeys,
            skippedKeys,
          };
        }),
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
          adjustedKeys: [],
          rhythmQtyByKey: {},
          skippedKeys: [],
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

      // ---- Draft-mode helpers ------------------------------------------
      /**
       * Seed the cart with rhythm-suggested lines on first guide mount.
       * Idempotent — if the cart already has these productIds, leaves
       * the existing line + adjusted marker alone (the buyer was mid-edit
       * across page navigations). Records rhythm qty so a later "Add
       * back" can restore it.
       */
      seedRhythm: (newLines) =>
        set((state) => {
          const byKey = new Map(
            state.lines.map((l) => [lineKey(l.productId, l.variantKey ?? null), l]),
          );
          const rhythmQty = { ...state.rhythmQtyByKey };
          for (const l of newLines) {
            const key = lineKey(l.productId, l.variantKey ?? null);
            rhythmQty[key] = l.quantity;
            if (byKey.has(key)) continue;
            byKey.set(key, {
              ...l,
              variantKey: l.variantKey ?? null,
              variantSku: l.variantSku ?? null,
              priceByWeight: l.priceByWeight ?? false,
            });
          }
          return {
            lines: Array.from(byKey.values()),
            rhythmQtyByKey: rhythmQty,
            // Seeding doesn't touch adjustedKeys — these lines came from
            // the system, not the buyer.
          };
        }),
      markAdjusted: (productId, variantKey = null) =>
        set((state) => {
          const key = lineKey(productId, variantKey);
          if (state.adjustedKeys.includes(key)) return state;
          return { adjustedKeys: [...state.adjustedKeys, key] };
        }),
      /**
       * Buyer hit the "skip" affordance on a rhythm row. Drop the line
       * from the cart (so totals stay accurate) but record the productKey
       * in skippedKeys so the UI keeps the row visible (dimmed) with an
       * "Add back" pill.
       */
      skipLine: (productId, variantKey = null) =>
        set((state) => {
          const key = lineKey(productId, variantKey);
          return {
            lines: state.lines.filter((l) => !sameLine(l, productId, variantKey)),
            skippedKeys: state.skippedKeys.includes(key)
              ? state.skippedKeys
              : [...state.skippedKeys, key],
            adjustedKeys: state.adjustedKeys.includes(key)
              ? state.adjustedKeys
              : [...state.adjustedKeys, key],
          };
        }),
      /**
       * Reverse a skip: restore the line at its rhythm qty (or 1 if we
       * never saw rhythm for it) and unflag the skipped marker. Stays
       * marked as adjusted — the buyer touched this row.
       */
      addBackLine: (productId, variantKey = null) =>
        set((state) => {
          const key = lineKey(productId, variantKey);
          const qty = state.rhythmQtyByKey[key] ?? 1;
          // We can't reconstruct the full CartLine here without the
          // product row — the seedRhythm path is the canonical place to
          // recreate it. So we leave the line off and just clear the
          // skip marker. The caller (DraftLine) seeds the line itself
          // via add() before clearing the skip.
          // Future: store the full CartLine in a sidecar map keyed by
          // lineKey so addBackLine can fully restore without the caller.
          void qty;
          return {
            skippedKeys: state.skippedKeys.filter((k) => k !== key),
          };
        }),
      isAdjusted: (productId, variantKey = null) =>
        get().adjustedKeys.includes(lineKey(productId, variantKey)),
      isSkipped: (productId, variantKey = null) =>
        get().skippedKeys.includes(lineKey(productId, variantKey)),
      rhythmQtyFor: (productId, variantKey = null) => {
        const k = lineKey(productId, variantKey);
        return get().rhythmQtyByKey[k] ?? null;
      },
    }),
    {
      name: "flf-cart",
      version: 3,
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
        // v3: draft-mode arrays land empty on legacy carts.
        if (!Array.isArray(persisted.adjustedKeys)) persisted.adjustedKeys = [];
        if (!Array.isArray(persisted.skippedKeys)) persisted.skippedKeys = [];
        if (
          !persisted.rhythmQtyByKey ||
          typeof persisted.rhythmQtyByKey !== "object"
        ) {
          persisted.rhythmQtyByKey = {};
        }
        return persisted;
      },
    },
  ),
);
