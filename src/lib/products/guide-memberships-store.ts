"use client";

import { create } from "zustand";

/**
 * Shared client-side source of truth for "is this product in the buyer's
 * order guide?" across cards (GuideStarButton), the product detail sheet
 * (ProductDetailSheet / ProductDetailClient), and any other surface that
 * reflects the starred state.
 *
 * Why it exists: GuideStarButton used to keep `inGuide` in local React
 * state, so an optimistic toggle on the card never propagated to the
 * detail sheet that the same card opened. Tapping the star on a card
 * (fills gold) and then tapping the card to open the modal would show
 * the stale "Add to your guide" copy.
 *
 * Design:
 *   - Map of productId → inGuide. Lazily hydrated: GuideStarButton's
 *     `initialInGuide` prop (server-rendered) is the seed value, but the
 *     store value wins once the buyer has toggled it. `has(id)` lets
 *     consumers fall back to their own server-supplied initial value
 *     for products the store has never seen.
 *   - Optimistic flip + write-through. Callers still hit the
 *     `/api/my-guide/{add,remove}` endpoints; on failure they call
 *     `set(productId, previousValue)` to snap the UI back.
 *   - Not persisted. The truth lives server-side in `order_guide_items`;
 *     this store only spans a single page session and is rebuilt from
 *     fresh server props on the next navigation.
 */
interface State {
  byProduct: Record<string, boolean>;
}

interface Actions {
  /** Optimistic flip + write-through. Caller still hits the API and
   *  should call `set(productId, prev)` on failure to snap back. */
  set: (productId: string, inGuide: boolean) => void;
  /** True if the store knows about this product. Used to decide
   *  whether to fall back to the server-supplied initialInGuide. */
  has: (productId: string) => boolean;
}

export const useGuideMemberships = create<State & Actions>((set, get) => ({
  byProduct: {},
  set: (productId, inGuide) =>
    set((s) => ({ byProduct: { ...s.byProduct, [productId]: inGuide } })),
  has: (productId) => productId in get().byProduct,
}));
