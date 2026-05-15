"use client";

import Link from "next/link";

/**
 * Uppercase eyebrow caps used as the producer caption above a product
 * name. The same visual treatment everywhere a producer is surfaced
 * adjacent to product chrome (cards, rows, draft lines, stock-up rows,
 * sheet headers). The detail page hero uses a different treatment
 * (green-tinted monogram chip) because it's a hero element, not chrome.
 *
 * Renders nothing when producer is null/empty.
 */
export function ProducerEyebrow({
  producer,
  href,
  className,
}: {
  producer: string | null | undefined;
  /** When provided, the eyebrow becomes a clickable link to the producer filter. */
  href?: string | null;
  className?: string;
}) {
  if (!producer) return null;
  const base =
    "text-[10px] uppercase tracking-[0.08em] font-semibold text-ink-tertiary truncate leading-tight";
  const cls = className ? `${base} ${className}` : base;
  if (href) {
    return (
      <Link
        href={href}
        className={`${cls} hover:text-ink-secondary hover:underline pointer-events-auto focus:outline-none focus:ring-2 focus:ring-brand-blue/40 rounded-sm`}
      >
        {producer}
      </Link>
    );
  }
  return <span className={cls}>{producer}</span>;
}

/** Convenience helper — build the canonical /catalog?producer=… href. */
export function producerHref(producer: string | null | undefined): string | null {
  if (!producer) return null;
  return `/catalog?producer=${encodeURIComponent(producer)}`;
}
