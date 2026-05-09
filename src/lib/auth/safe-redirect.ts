/**
 * Reject anything that isn't an internal, single-leading-slash path.
 * Blocks open-redirect vectors like `?next=@evil.com` (which reads as
 * userinfo and lands on evil.com), `?next=//evil.com` (protocol-relative
 * via double slash), and `?next=/\evil.com` (some browsers normalize
 * backslashes to forward).
 *
 * Lives in its own module so the auth-callback route can stay tiny and
 * the redirect logic can be unit-tested without mocking next/headers.
 */
export function safeRedirectTarget(next: string | null | undefined): string {
  if (!next) return "/";
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
