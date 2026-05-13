"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface BaseProps {
  href: string;
  /** href prefixes that should also count as "active" (e.g. /catalog
   * matches /catalog/abc/detail). Defaults to startsWith(href). */
  matchPrefixes?: string[];
  className?: string;
  activeClassName?: string;
}

/**
 * Pathname-aware link. Adds an "active" class when the current route
 * matches the href (or any matchPrefix). Used by StoreNav so desktop
 * top-tabs and mobile bottom-tabs both highlight where you are.
 *
 * Force-prefetches the full RSC payload (not just the loading shell)
 * because every storefront route is dynamic (reads cookies), and
 * Next 16's default `prefetch="auto"` skips dynamic prefetch — which
 * made the first click to any tab feel slow. The nav lives in the
 * viewport on every storefront page, so this warms all 3–4 tabs as
 * soon as the user lands, and the client router cache (staleTimes,
 * see next.config.js) keeps them warm for 30s.
 */
export function NavLink({
  href,
  matchPrefixes,
  className,
  activeClassName,
  children,
}: BaseProps & { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const prefixes = matchPrefixes ?? [href];
  const isActive =
    prefixes.some((p) => (p === "/" ? pathname === "/" : pathname.startsWith(p)));

  return (
    <Link
      href={href}
      prefetch
      className={`${className ?? ""} ${isActive ? activeClassName ?? "" : ""}`}
    >
      {children}
    </Link>
  );
}
