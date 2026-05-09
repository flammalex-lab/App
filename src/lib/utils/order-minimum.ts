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

/**
 * Resolve the effective order minimum for a B2B account: account-level
 * override → zone fallback → 0. Same precedence the server enforces in
 * /api/orders/create. Use this from both the cart RSC and any other
 * place that needs to display "min: $X" so the two layers can't drift.
 */
export function effectiveOrderMinimum(
  account: { order_minimum: number | null } | null,
  zone: { order_minimum: number | null } | null,
): number {
  if (!account) return 0;
  return Number(account.order_minimum ?? zone?.order_minimum ?? 0);
}
