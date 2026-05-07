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
    <Link href={href} className={`${className ?? ""} ${isActive ? activeClassName ?? "" : ""}`}>
      {children}
    </Link>
  );
}
