"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { track } from "@/lib/analytics/track";

/**
 * Mount once in the storefront layout. On every navigation:
 *   - If the URL has `?n=…&nt=…` (set by notificationUrl()), fire a
 *     `notification_clicked` event with the name + transport.
 *   - Strip both params from the URL so a refresh or shared link
 *     doesn't re-fire and so the receipt URL the buyer sees is clean.
 *
 * Lightweight render-side hook; never renders anything visible.
 */
export function NotificationClickTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    if (!searchParams) return;
    const n = searchParams.get("n");
    const nt = searchParams.get("nt");
    if (!n && !nt) return;
    track("notification_clicked", {
      notification_name: n,
      transport: nt,
      landed_on: pathname ?? null,
    });
    // Rebuild the URL without n/nt so the buyer's address bar (and any
    // share-from-here actions) stay clean. Replace, don't push — we
    // don't want a back button entry for the tracked URL.
    const next = new URLSearchParams(searchParams.toString());
    next.delete("n");
    next.delete("nt");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : (pathname ?? "/"), { scroll: false });
  }, [pathname, searchParams, router]);
  return null;
}
