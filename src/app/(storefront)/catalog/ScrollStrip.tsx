"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ProductCard, type PricedProduct } from "@/components/products/ProductCard";

/**
 * Horizontal scroll strip of vertical product cards. Per Brief 03:
 *
 *   - **Fade + peek**: when content overflows, a 64px white-to-transparent
 *     fade sits over the right edge so buyers see there's more. A
 *     symmetric left fade appears once the rail has scrolled. Suppressed
 *     when the rail fits — clean right edge, no fake-broken affordance.
 *   - **Desktop arrows + keyboard nav**: at lg (≥1024px), prev/next
 *     circular buttons sit in the strip header. Arrow keys move focus
 *     card-by-card; the focused card auto-scrolls to the rail center.
 *     `prefers-reduced-motion` swaps smooth scrolling for instant.
 *   - **Single-card branch**: a strip with exactly 1 product centers the
 *     card so the row doesn't read as an unfinished overflow.
 */
export function ScrollStrip({
  title,
  href,
  subtitle,
  products,
  emoji,
  density = "default",
  inGuideIds,
  isB2B,
}: {
  title: string;
  href?: string;
  subtitle?: string;
  products: PricedProduct[];
  emoji?: string;
  /** "dense" packs more cards per viewport — used on the Guide where
   *  buyers scan known items quickly. "default" is the catalog feel. */
  density?: "default" | "dense";
  /**
   * IDs of products in the active buyer's order guide. Cards in this
   * set render the gold "In guide" badge. Omit on pages where every
   * card is already in-guide (the badge would be noise).
   */
  inGuideIds?: ReadonlySet<string>;
  /** B2B session flag — see CatalogGrid for details. */
  isB2B?: boolean;
}) {
  if (products.length === 0) return null;

  const cardWidth =
    density === "dense"
      ? "w-[38vw] max-w-[160px] md:max-w-[200px] lg:max-w-[220px] min-w-[140px]"
      : "w-[44vw] max-w-[180px] md:max-w-[220px] lg:max-w-[240px] min-w-[150px]";

  // Single-card strip: a centered card. No fades, no arrows — the
  // affordance would lie about there being more.
  if (products.length === 1) {
    return (
      <section className="mb-5">
        <StripHeader title={title} emoji={emoji} count={1} href={href} subtitle={subtitle} />
        <div className="flex justify-center px-4 md:px-0">
          <div className={cardWidth}>
            <ProductCard
              product={products[0]}
              variant="compact"
              inGuide={inGuideIds?.has(products[0].id) ?? false}
              isB2B={isB2B}
            />
          </div>
        </div>
      </section>
    );
  }

  return (
    <ScrollStripRail
      title={title}
      emoji={emoji}
      href={href}
      subtitle={subtitle}
      products={products}
      cardWidth={cardWidth}
      inGuideIds={inGuideIds}
      isB2B={isB2B}
    />
  );
}

function ScrollStripRail({
  title,
  emoji,
  href,
  subtitle,
  products,
  cardWidth,
  inGuideIds,
  isB2B,
}: {
  title: string;
  emoji?: string;
  href?: string;
  subtitle?: string;
  products: PricedProduct[];
  cardWidth: string;
  inGuideIds?: ReadonlySet<string>;
  isB2B?: boolean;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const { canScrollLeft, canScrollRight } = useStripOverflow(railRef);

  const scrollByStride = useCallback((dir: 1 | -1) => {
    const rail = railRef.current;
    if (!rail) return;
    // One stride = first card's outer width + the row gap. Reading from
    // the live DOM keeps the math accurate when card widths change with
    // breakpoint (44vw on mobile, 180px cap on desktop).
    const first = rail.querySelector<HTMLElement>("[data-strip-card-index='0']");
    const second = rail.querySelector<HTMLElement>("[data-strip-card-index='1']");
    const stride =
      first && second
        ? second.getBoundingClientRect().left - first.getBoundingClientRect().left
        : first?.offsetWidth ?? rail.clientWidth * 0.8;
    rail.scrollBy({ left: dir * stride, behavior: scrollBehavior() });
  }, []);

  // Arrow-key card-to-card focus + auto-center. Hijacks only when focus
  // is on a link inside a card (cards are otherwise hit-testable via
  // their overlay <a>); inner button focus (stepper) stays free.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const active = document.activeElement;
      if (!(active instanceof HTMLAnchorElement)) return;
      const card = active.closest<HTMLElement>("[data-strip-card-index]");
      if (!card || !rail!.contains(card)) return;
      const idx = Number(card.dataset.stripCardIndex);
      const nextIdx = e.key === "ArrowRight" ? idx + 1 : idx - 1;
      if (nextIdx < 0 || nextIdx >= products.length) return;
      const next = rail!.querySelector<HTMLElement>(
        `[data-strip-card-index="${nextIdx}"]`,
      );
      if (!next) return;
      e.preventDefault();
      const nextLink = next.querySelector<HTMLAnchorElement>("a");
      nextLink?.focus({ preventScroll: true });
      next.scrollIntoView({
        block: "nearest",
        inline: "center",
        behavior: scrollBehavior(),
      });
    }
    rail.addEventListener("keydown", onKey);
    return () => rail.removeEventListener("keydown", onKey);
  }, [products.length]);

  return (
    <section className="mb-5">
      <StripHeader
        title={title}
        emoji={emoji}
        count={products.length}
        href={href}
        subtitle={subtitle}
        canScrollLeft={canScrollLeft}
        canScrollRight={canScrollRight}
        onPrev={() => scrollByStride(-1)}
        onNext={() => scrollByStride(1)}
      />
      <div className="relative">
        <div
          ref={railRef}
          className="overflow-x-auto -mx-4 md:-mx-0 px-4 md:px-0 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{
            WebkitOverflowScrolling: "touch",
            overscrollBehaviorX: "contain",
          }}
        >
          <div className="flex gap-3 min-w-max">
            {products.map((p, i) => (
              <div
                key={p.id}
                data-strip-card-index={i}
                className={`${cardWidth} shrink-0`}
              >
                <ProductCard
                  product={p}
                  variant="compact"
                  inGuide={inGuideIds?.has(p.id) ?? false}
                  isB2B={isB2B}
                />
              </div>
            ))}
          </div>
        </div>
        {/* Fades: siblings of the scrolling rail so they don't translate
            with content. Negative margins on mobile match the rail's
            -mx-4 bleed so the fade overlays the *visible* right/left
            edge of the rail, not the section's content box. Opacity-
            toggled so the gradient never hides "more" when there's
            nothing more to see. */}
        <div
          aria-hidden
          className={`pointer-events-none absolute top-0 right-0 bottom-2 w-16 md:w-20 bg-gradient-to-l from-white via-white/80 to-white/0 transition-opacity duration-150 -mr-4 md:mr-0 ${
            canScrollRight ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          aria-hidden
          className={`pointer-events-none absolute top-0 left-0 bottom-2 w-12 md:w-16 bg-gradient-to-r from-white via-white/80 to-white/0 transition-opacity duration-150 -ml-4 md:ml-0 ${
            canScrollLeft ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>
    </section>
  );
}

function StripHeader({
  title,
  emoji,
  count,
  href,
  subtitle,
  canScrollLeft,
  canScrollRight,
  onPrev,
  onNext,
}: {
  title: string;
  emoji?: string;
  count: number;
  href?: string;
  subtitle?: string;
  canScrollLeft?: boolean;
  canScrollRight?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <div className="flex items-baseline gap-2 min-w-0">
          {href ? (
            <Link
              href={href}
              className="text-[17px] font-semibold tracking-tight text-ink-primary leading-tight truncate hover:text-brand-blue transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 rounded-sm"
            >
              {emoji ? <span className="mr-1">{emoji}</span> : null}
              {title}
            </Link>
          ) : (
            <h2 className="text-[17px] font-semibold tracking-tight text-ink-primary leading-tight truncate">
              {emoji ? <span className="mr-1">{emoji}</span> : null}
              {title}
            </h2>
          )}
          <span className="text-[12px] text-ink-tertiary tabular shrink-0">
            {count} {count === 1 ? "item" : "items"}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {href ? (
            <Link
              href={href}
              className="inline-flex items-center gap-0.5 text-[13px] font-medium text-brand-blue hover:text-brand-blue-dark transition-colors duration-150"
            >
              See all
              <span aria-hidden className="text-base leading-none">›</span>
            </Link>
          ) : null}
          {/* Desktop-only prev/next arrows. Hidden when the rail fits
              (both can-scroll flags false) so we don't render dead chrome. */}
          {onPrev && onNext && (canScrollLeft || canScrollRight) ? (
            <div className="hidden lg:inline-flex items-center gap-1.5 ml-1">
              <ArrowButton
                direction="prev"
                disabled={!canScrollLeft}
                onClick={onPrev}
              />
              <ArrowButton
                direction="next"
                disabled={!canScrollRight}
                onClick={onNext}
              />
            </div>
          ) : null}
        </div>
      </div>
      {subtitle ? (
        <p className="text-[13px] text-ink-secondary mb-2">{subtitle}</p>
      ) : null}
    </>
  );
}

function ArrowButton({
  direction,
  disabled,
  onClick,
}: {
  direction: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "prev" ? "Previous" : "Next"}
      className="h-8 w-8 inline-flex items-center justify-center rounded-full border border-black/10 bg-white text-ink-primary hover:border-black/20 hover:text-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/40 disabled:text-ink-tertiary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-black/10 disabled:hover:text-ink-tertiary transition-colors duration-150"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {direction === "prev" ? <path d="M15 6l-6 6 6 6" /> : <path d="M9 6l6 6-6 6" />}
      </svg>
    </button>
  );
}

/**
 * Tracks rail overflow on mount, scroll, and resize. Returns flags that
 * drive fade-overlay visibility AND prev/next-arrow disabled state.
 * 4px slack on either end avoids flicker when the rail rests exactly at
 * the edge.
 */
function useStripOverflow(railRef: React.RefObject<HTMLElement | null>) {
  const [state, setState] = useState({ canScrollLeft: false, canScrollRight: false });
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    function recompute() {
      if (!rail) return;
      const max = rail.scrollWidth - rail.clientWidth;
      setState({
        canScrollLeft: rail.scrollLeft > 4,
        canScrollRight: rail.scrollLeft < max - 4,
      });
    }
    recompute();
    rail.addEventListener("scroll", recompute, { passive: true });
    const ro = new ResizeObserver(recompute);
    ro.observe(rail);
    return () => {
      rail.removeEventListener("scroll", recompute);
      ro.disconnect();
    };
  }, [railRef]);
  return state;
}

/**
 * Returns "auto" when the user has prefers-reduced-motion set; "smooth"
 * otherwise. Safe to call during render but most callers use it inside
 * event handlers — checked at call time so the current value of the
 * media query is honored (matches change at runtime via OS settings).
 */
function scrollBehavior(): ScrollBehavior {
  if (typeof window === "undefined") return "smooth";
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}
