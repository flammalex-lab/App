import { NextResponse } from "next/server";

/**
 * Clears the short-lived flf-reorder cookie set by /api/orders/reorder
 * once the CartClient has hydrated its initial state from it. Next 14
 * server components can't mutate cookies; this route handler can.
 */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("flf-reorder");
  return response;
}
