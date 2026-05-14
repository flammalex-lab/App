"use client";

import { useEffect } from "react";
import { scopeCartToUser } from "@/lib/cart/store";

/**
 * H13: scope the persisted cart to the active buyer.
 *
 * The cart store uses zustand's persist middleware with
 * `skipHydration: true`. This gate runs once per layout render — after
 * the storefront server layout has resolved the active profile — and
 * rebinds the persist key to `flf-cart:${userId}` (or `flf-cart:anon`),
 * migrating the legacy single-key cart on first run.
 *
 * Without this gate, two buyers on a shared device leak carts across
 * sign-outs because localStorage isn't cleared on signout (only the SW
 * + cache are; see PWARegister + #105). The signout SW-clear flow stays
 * in place — that handles the offline shell — and this gate handles
 * the cart data layer.
 *
 * Renders nothing.
 */
export function CartHydrationGate({ userId }: { userId: string | null }) {
  useEffect(() => {
    scopeCartToUser(userId);
  }, [userId]);
  return null;
}
