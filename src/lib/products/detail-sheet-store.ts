"use client";

import { create } from "zustand";
import type { Product } from "@/lib/supabase/types";
import type { PackRow } from "@/app/(storefront)/catalog/[id]/packs";
import { loadProductDetail } from "@/app/(storefront)/catalog/detail-action";

/**
 * Pepper-style client-state product detail modal.
 *
 * The catalog and guide cards already carry the `Product` row (name,
 * image, description, pack_options, etc.), so `open(product, ...)`
 * mounts the sheet INSTANTLY with title + image + description. The
 * server action then fills in:
 *   - `packs`        — priced PackRows, including sibling-grouped sizes
 *   - `groupedCount` — number of sibling products in the group
 *   - `inGuide`      — whether this product is on the buyer's guide
 *   - `isB2B`        — whether to show "Add to guide" affordances
 *
 * While the action is in-flight, `loading` is true and consumers can
 * render an inline skeleton for the pack rows. The pack rows are the
 * only part that NEEDS server data; everything else renders from the
 * product the card handed us.
 *
 * Replaces the parallel-route `@modal/(.)catalog/[id]` interception
 * pattern. No URL change, no route push, no body-lock thrash, no
 * scroll-restoration interaction with the catalog layout below.
 */
interface State {
  product: Product | null;
  fromGroup: string | null;
  packs: PackRow[] | null;
  groupedProductCount: number;
  isB2B: boolean;
  inGuide: boolean;
  loading: boolean;
  /** Bumped on every `open(...)` so an in-flight `loadProductDetail`
   * for a different product can drop its result instead of clobbering
   * the current view. */
  requestId: number;
}

interface Actions {
  open: (product: Product, opts?: { fromGroup?: string | null; inGuide?: boolean }) => void;
  close: () => void;
}

export const useProductSheet = create<State & Actions>((set, get) => ({
  product: null,
  fromGroup: null,
  packs: null,
  groupedProductCount: 1,
  isB2B: false,
  inGuide: false,
  loading: false,
  requestId: 0,

  open(product, opts) {
    const nextRequestId = get().requestId + 1;
    set({
      product,
      fromGroup: opts?.fromGroup ?? null,
      // Seed inGuide from the caller (the card knows this) so the
      // starred state is correct on first paint, before the server
      // action confirms it.
      inGuide: opts?.inGuide ?? false,
      // Wipe stale packs from the previous open so we don't briefly
      // render last product's variants.
      packs: null,
      groupedProductCount: 1,
      loading: true,
      requestId: nextRequestId,
    });
    void (async () => {
      const res = await loadProductDetail(product.id);
      if (get().requestId !== nextRequestId) return;
      if (!res.ok) {
        set({ loading: false });
        return;
      }
      set({
        packs: res.packs,
        groupedProductCount: res.groupedProductCount,
        isB2B: res.isB2B,
        inGuide: res.inGuide,
        loading: false,
      });
    })();
  },

  close() {
    set({
      product: null,
      fromGroup: null,
      packs: null,
      groupedProductCount: 1,
      loading: false,
      // requestId NOT reset — a stale in-flight load for the just-
      // closed product would still resolve before we open the next
      // one. Bumping requestId on open() handles that case; leaving
      // it alone here is fine.
    });
  },
}));
