/**
 * URL convention for notification click-through tracking.
 *
 * Any link we put in an SMS / email / push payload should pass through
 * this helper. It appends two query params:
 *   `n`  — notification type/name (e.g. "order_confirmation", "order_status")
 *   `nt` — transport: "sms" | "email" | "push"
 *
 * The buyer's first page load reads these via NotificationClickTracker
 * (mounted in the storefront layout), fires a `notification_clicked`
 * event, then strips the params from the visible URL so a refresh or
 * shared link doesn't double-count.
 *
 * Path can be absolute (https://…) or relative (/orders/123). Existing
 * query params are preserved.
 */
export function notificationUrl(
  path: string,
  opts: { name: string; transport: "sms" | "email" | "push" },
): string {
  // Pick the right base for resolving a relative path. The whole thing
  // gets serialized as an absolute URL so SMS bodies render a clickable
  // link in iMessage / Android Messages.
  const base =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://order.ilovenyfarms.com";
  const url = new URL(path, base);
  url.searchParams.set("n", opts.name);
  url.searchParams.set("nt", opts.transport);
  return url.toString();
}
