"use client";

import { create } from "zustand";
import type { Product } from "@/lib/supabase/types";
import type { PackRow } from "@/app/(storefront)/catalog/[id]/packs";
import { loadProductDetail } from "@/app/(storefront)/catalog/detail-action";
import { isGroupedCandidate } from "./build-packs";

/**
 * Pepper-style client-state product detail modal.
 *
 * The catalog and guide cards already carry the `Product` row AND a
 * pre-computed `packs` list (default pack + pack_options, priced
 * against the active account's overrides + price-list + tier). So
 * `open(product, { packs, isB2B, inGuide })` mounts the sheet INSTANTLY
 * with title, image, description, AND fully-priced variant rows.
 *
 * The server action `loadProductDetail` only fires when the product is
 * a sibling-grouped candidate — i.e. its name contains a pack-size
 * suffix like " — Gallon" / " — Half Gallon". For most products
 * (no siblings), zero round-trips: instant open, no skeleton, no
 * background fetch.
 *
 * When it does fire (sibling candidates), the action returns the union
 * of self-packs + sibling-packs; the store swaps `packs` in only when
 * the union has MORE rows than the current self-packs (the canonical
 * "we discovered siblings, upgrade now" signal). Stale upgrades are
 * dropped via the requestId guard.
 *
 * Legacy callers that don't supply `packs`/`isB2B` still work — the
 * store falls back to the full server-action loading path with a
 * skeleton.
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
  open: (
    product: Product,
    opts?: {
      fromGroup?: string | null;
      inGuide?: boolean;
      /** Whether the active session is a B2B buyer. Seed for instant
       *  paint; the action also returns this when it fires. */
      isB2B?: boolean;
      /** Pre-computed self-pack list for this product. When provided,
       *  the sheet skips the loading state entirely and renders the
       *  packs immediately. The server action only fires for sibling
       *  candidates; otherwise it's a zero-network open. */
      packs?: PackRow[];
    },
  ) => void;
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
    const seedPacks = opts?.packs;
    const hasSeedPacks = Array.isArray(seedPacks);
    // Sibling-grouped candidates need the server action to discover
    // and price siblings. Everything else can skip the action entirely
    // when seedPacks is present — instant-open with zero round-trips.
    const grouped = isGroupedCandidate(product.name);
    const willFetch = !hasSeedPacks || grouped;

    set({
      product,
      fromGroup: opts?.fromGroup ?? null,
      // Seed inGuide / isB2B from the caller (the card knows these)
      // so the starred state + Add-to-guide affordance are correct on
      // first paint, before the server action confirms.
      inGuide: opts?.inGuide ?? false,
      isB2B: opts?.isB2B ?? false,
      // Seed packs when provided — sheet renders the variant picker
      // immediately. Otherwise null + loading=true triggers the
      // skeleton path (legacy / unknown callers).
      packs: hasSeedPacks ? seedPacks! : null,
      groupedProductCount: 1,
      loading: !hasSeedPacks,
      requestId: nextRequestId,
    });

    if (!willFetch) return;

    void (async () => {
      const res = await loadProductDetail(product.id);
      if (get().requestId !== nextRequestId) return;
      if (!res.ok) {
        // Only flip loading off if we ARE the loading-state owner;
        // a seeded-packs open never went into loading=true.
        if (!hasSeedPacks) set({ loading: false });
        return;
      }
      // Sibling-upgrade comparator: swap to the action's packs only
      // when it found MORE rows than we already have. For seeded
      // opens with no siblings, the action returns the same self-pack
      // count → no swap → no flash. For seeded opens that DO have
      // siblings, the action returns a longer union → swap to it.
      // For non-seeded (legacy) opens, current packs is null so the
      // action's result always wins.
      const current = get().packs;
      const shouldSwap = !current || res.packs.length > current.length;
      set({
        ...(shouldSwap ? { packs: res.packs } : {}),
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
