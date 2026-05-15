"use client";

/**
 * Status badges and inline flags rendered on product chrome.
 *
 * Two physical placements, same visual language:
 *   - Badge: absolute-positioned pill in the media corner (top-left for
 *     status; top-right for paused/week-off). Used on grid/compact cards.
 *   - Flag:  inline chip beside the producer eyebrow on dense layouts
 *     (row variant, draft lines, stock-up rows) where the media is too
 *     small or absent for a corner badge.
 *
 * Precedence is enforced by the caller (only one flag/badge at a time):
 *   InGuide > Peak. Paused and WeekOff are an orthogonal availability
 *   signal, rendered top-right when present.
 */

function StarIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 12 12"
      fill="currentColor"
      aria-hidden
      className="text-accent-gold"
    >
      <path d="M6 .5l1.6 3.7 4 .4-3 2.8.9 4-3.5-2.1-3.5 2.1.9-4-3-2.8 4-.4z" />
    </svg>
  );
}

/** Top-left corner pill: white bg, gold star + "In guide" copy. */
export function InGuideBadge() {
  return (
    <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white text-[#8a690f] text-[11px] font-semibold leading-none border border-accent-gold/40 shadow-card pointer-events-none">
      <StarIcon />
      In guide
    </span>
  );
}

/** Inline chip beside the producer eyebrow. Gold tint background. */
export function InGuideFlag() {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold leading-none text-[#8a690f] bg-accent-gold/15 shrink-0">
      <StarIcon />
      In guide
    </span>
  );
}

/** Top-left corner pill: white bg, green border + "Peak" copy. Quieter
 *  than InGuide (no icon) so a card with neither flag looks normal and
 *  a card with both prefers InGuide. */
export function PeakBadge() {
  return (
    <span className="absolute top-2 left-2 inline-flex items-center px-2 py-1 rounded-full bg-white text-brand-green text-[11px] font-semibold leading-none border border-brand-green/30 shadow-card pointer-events-none">
      Peak
    </span>
  );
}

/** Inline chip: small green-tint "Peak" flag for row-density layouts. */
export function PeakFlag() {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold leading-none text-brand-green bg-brand-green/12 shrink-0">
      Peak
    </span>
  );
}

/** Top-right corner pill: gold tint indicating the producer paused this product. */
export function PausedBadge({ inline }: { inline?: boolean }) {
  if (inline) {
    return <span className="badge badge-gold">Paused</span>;
  }
  return (
    <span className="absolute top-2 right-2 badge badge-gold text-[10px]">Paused</span>
  );
}

/** Top-right corner pill: gray tint indicating the product is not available this delivery week. */
export function WeekOffBadge({ inline }: { inline?: boolean }) {
  if (inline) {
    return <span className="badge badge-gray">Week off</span>;
  }
  return (
    <span className="absolute top-2 right-2 badge-gray bg-white/90 text-[10px]">
      Week off
    </span>
  );
}
