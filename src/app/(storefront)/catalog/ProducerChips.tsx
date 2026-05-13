import Link from "next/link";
import { Chip } from "@/components/ui/Badge";
import type { ProductGroup } from "@/lib/constants";

/**
 * Horizontal row of producer chips, shown at the top of a category page
 * (e.g. /catalog?group=dairy) so loyalists can one-tap narrow to a single
 * producer. Each chip is a Link to /catalog?group=<g>&producer=<name>.
 *
 * Producers are pre-ranked by the parent: buyer frequency first, global
 * popularity as tie-break (mirrors /guide). Selection state is computed
 * here against the URL's `producer` filter (case-insensitive).
 *
 * Visual:
 *   - unselected: standard `Chip` (gray badge style) wrapped in a Link
 *   - selected: brand-blue solid pill (inline class — Chip doesn't have a
 *     solid-blue tone yet, and a single use case doesn't justify a token)
 *   - wraps on desktop (`md:flex-wrap`), horizontal scroll on mobile so a
 *     long list doesn't blow out the layout on a phone
 */
export function ProducerChips({
  group,
  producers,
  selected,
  maxVisible = 8,
  className,
}: {
  /** Category slug for the current page (`?group=dairy`). */
  group: ProductGroup;
  /** Pre-ranked list of producer names that have ≥1 visible product here. */
  producers: string[];
  /** Currently-selected producer from `?producer=` (raw URL value). */
  selected: string | null;
  /** Cap on chips rendered before "+ N more" overflow chip. */
  maxVisible?: number;
  className?: string;
}) {
  if (producers.length <= 1) return null;

  const selectedNorm = selected?.trim().toLowerCase() ?? null;

  // Ensure the selected producer is always in the visible set — even if it
  // would have fallen below the maxVisible cutoff by rank. The buyer needs
  // to see the chip in order to toggle it back off.
  let visible = producers.slice(0, maxVisible);
  if (selectedNorm) {
    const inVisible = visible.some((p) => p.toLowerCase() === selectedNorm);
    if (!inVisible) {
      const idx = producers.findIndex((p) => p.toLowerCase() === selectedNorm);
      if (idx >= 0) {
        visible = [producers[idx], ...visible.slice(0, maxVisible - 1)];
      }
    }
  }
  const overflow = producers.length - visible.length;

  return (
    <div
      className={`overflow-x-auto md:overflow-visible -mx-4 md:-mx-0 px-4 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className ?? ""}`}
      aria-label="Producers"
    >
      <div className="flex md:flex-wrap gap-2 min-w-max md:min-w-0">
        {visible.map((producer) => {
          const isSelected = selectedNorm === producer.toLowerCase();
          // Toggle: selected chip clears the producer filter (back to the
          // category landing). Unselected chips add the producer to the URL.
          const href = isSelected
            ? `/catalog?group=${group}`
            : `/catalog?group=${group}&producer=${encodeURIComponent(producer)}`;
          return (
            <Link
              key={producer}
              href={href}
              aria-pressed={isSelected}
              className="whitespace-nowrap transition hover:opacity-90"
            >
              {isSelected ? (
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-brand-blue text-white">
                  {producer}
                </span>
              ) : (
                <Chip tone="gray">{producer}</Chip>
              )}
            </Link>
          );
        })}
        {overflow > 0 ? (
          <Link
            href={`/catalog?group=${group}`}
            className="whitespace-nowrap transition hover:opacity-90"
          >
            <Chip tone="gray">+ {overflow} more ›</Chip>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
