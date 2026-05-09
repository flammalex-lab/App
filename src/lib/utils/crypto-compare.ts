/**
 * Constant-time string equality for secret comparisons (cron tokens,
 * webhook signatures, etc.). Returns false fast on length mismatch.
 *
 * Uses Node's crypto.timingSafeEqual when buffers are equal-length;
 * the wrapper exists so callers can pass plain strings without leaking
 * timing on the length check.
 */
import { timingSafeEqual } from "node:crypto";

export function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return timingSafeEqual(ab, bb);
}
