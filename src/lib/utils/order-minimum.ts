/**
 * Single source of truth for the "is this order over the minimum" check.
 * Used by the cart UI (gate the Place-order button) and by
 * /api/orders/create (final server-side validation). Keep them in sync —
 * if these two layers ever disagree, you get the M8 inconsistency the
 * audit was trying to retire.
 *
 * Definition: an order meets the minimum when (subtotal + delivery_fee)
 * is greater than or equal to the configured minimum.
 */

export interface MinimumCheckInput {
  subtotal: number;
  deliveryFee: number;
  /** Resolved minimum: account.order_minimum ?? zone.order_minimum ?? 0. */
  minimum: number;
}

export function meetsMinimum({ subtotal, deliveryFee, minimum }: MinimumCheckInput): boolean {
  if (minimum <= 0) return true;
  return subtotal + deliveryFee >= minimum;
}

/** How much further this order needs to go to clear the minimum. */
export function shortfall({ subtotal, deliveryFee, minimum }: MinimumCheckInput): number {
  if (minimum <= 0) return 0;
  return Math.max(0, minimum - (subtotal + deliveryFee));
}
