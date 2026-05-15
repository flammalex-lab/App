"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { OrderGuide } from "@/lib/supabase/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { useCart } from "@/lib/cart/store";
import { DraftLine, pickSubstitutes } from "./DraftLine";
import { DraftStrip } from "./DraftStrip";
import type { DraftItem } from "./DraftTile";
import { SubmitSheet } from "./SubmitSheet";
import type { GuideRow, PricedProductLite } from "./page";
import { SearchBar } from "@/components/catalog/SearchBar";
import { ListSwitcher } from "./ListSwitcher";

interface UpcomingDelivery {
  date: string;
  dayName: string;
}

interface ActiveStanding {
  id: string;
  name: string | null;
  summary: string;
}

interface RhythmByProduct {
  [productId: string]: {
    averageQty: number;
    mostRecentQty: number;
    occurrenceCount: number;
  };
}

interface Props {
  items: GuideRow[];
  buyerProducerRank?: Record<string, number>;
  globalProducerRank?: Record<string, number>;
  newFromProducers?: PricedProductLite[];
  recentBuys?: PricedProductLite[];
  inGuideIds?: string[];

  /** Rhythm signals from `loadDraftRhythm`, keyed by product_id. No
   *  longer used to pre-fill the cart — kept only as a sort signal so
   *  the buyer's most-ordered items lead the weekly-orders strip. */
  rhythmByProduct?: RhythmByProduct;
  /** ISO yyyy-mm-dd date of the next delivery the order targets. */
  targetDeliveryDate: string | null;
  /** Pretty weekday name ("Friday"). Used in the order-guide header. */
  targetDeliveryDayName: string | null;
  /** Active standing orders matching the target weekday — render as
   *  separate locked-in cards above the order guide. */
  activeStanding?: ActiveStanding[];
  /** Buyer's own product-level qty totals (for substitute ranking). */
  buyerProductCounts?: Record<string, number>;
  /** Account minimum + delivery fee — feeds the SubmitSheet totals. */
  accountMinimum: number;
  deliveryFee: number;
  /** Upcoming delivery days the buyer may switch to from the SubmitSheet. */
  upcomingDeliveries?: UpcomingDelivery[];
  /** Most recent cutoff was already passed — disables submit in the sheet. */
  pastCutoff?: boolean;
  /** All of the buyer's order guides — drives the list switcher in the
   *  header. The DEFAULT view (this component) always corresponds to the
   *  default guide; the switcher lets the buyer flip to non-default
   *  side-lists, which render via the simpler `NonDefaultListView`. */
  allGuides?: OrderGuide[];
  activeGuideId?: string | null;
}

export function GuideClient({
  items,
  newFromProducers = [],
  recentBuys = [],
  rhythmByProduct = {},
  targetDeliveryDate,
  targetDeliveryDayName,
  activeStanding = [],
  buyerProductCounts = {},
  accountMinimum,
  deliveryFee,
  upcomingDeliveries = [],
  pastCutoff = false,
  allGuides = [],
  activeGuideId = null,
}: Props) {
  const [search, setSearch] = useState("");
  const [submitOpen, setSubmitOpen] = useState(false);

  const lineCount = useCart((s) => s.lines.length);
  const clearStaleDeliveryDate = useCart((s) => s.clearStaleDeliveryDate);
  // Subtotal (sum of unitPrice * qty across all lines) — drives the under-min
  // copy on the in-eye-line submit pill.
  const cartSubtotal = useCart((s) =>
    s.lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0),
  );

  // Drop any stale persisted delivery date on every mount.
  useEffect(() => {
    clearStaleDeliveryDate(targetDeliveryDate);
  }, [targetDeliveryDate, clearStaleDeliveryDate]);

  const searchMatch = (r: GuideRow) =>
    !search || r.product.name.toLowerCase().includes(search.toLowerCase());

  // ---- Weekly orders: the full order guide, sorted by rhythm signal
  // when available (most-ordered first) with name as fallback. No
  // pre-fill — items start at qty=0 unless the buyer's cart already
  // had them from a previous visit.
  const weeklyRows = useMemo(() => {
    const sorted = [...items];
    sorted.sort((a, b) => {
      const aR = rhythmByProduct[a.product.id];
      const bR = rhythmByProduct[b.product.id];
      const aCount = aR?.occurrenceCount ?? 0;
      const bCount = bR?.occurrenceCount ?? 0;
      if (aCount !== bCount) return bCount - aCount;
      return a.product.name.localeCompare(b.product.name);
    });
    return sorted;
  }, [items, rhythmByProduct]);

  // ---- "Suggested": recent buys the buyer doesn't have in their
  // order guide. Surfaces "you bought this lately — want it on your
  // standing list?" candidates.
  const suggestedProducts = useMemo<PricedProductLite[]>(() => {
    const guideIds = new Set(items.map((it) => it.product.id));
    return recentBuys.filter((p) => !guideIds.has(p.id));
  }, [items, recentBuys]);

  // Substitute pool for stockout rows.
  const subPool = useMemo<PricedProductLite[]>(() => {
    const out: PricedProductLite[] = [];
    const seen = new Set<string>();
    function push(p: PricedProductLite) {
      if (seen.has(p.id)) return;
      seen.add(p.id);
      out.push(p);
    }
    for (const it of items) {
      push({ ...it.product, unitPrice: it.unitPrice, packs: it.packs });
    }
    for (const p of recentBuys) push(p);
    for (const p of newFromProducers) push(p);
    return out;
  }, [items, recentBuys, newFromProducers]);

  const globalCounts = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    recentBuys.forEach((p, i) => {
      out[p.id] = recentBuys.length - i;
    });
    return out;
  }, [recentBuys]);

  // Empty when the buyer has no order guide AND no cart from a prior session.
  const guideIsEmpty = items.length === 0 && lineCount === 0;

  // ---- In-eye-line submit pill ---------------------------------------
  const submitPillUnderMin =
    accountMinimum > 0 && cartSubtotal < accountMinimum;
  const submitPillShortfall = Math.ceil(
    Math.max(0, accountMinimum - cartSubtotal),
  );
  const submitPillCopy = submitPillUnderMin
    ? targetDeliveryDayName
      ? `Add $${submitPillShortfall} to ship ${targetDeliveryDayName}`
      : `Add $${submitPillShortfall} to submit`
    : targetDeliveryDayName
      ? `Submit ${targetDeliveryDayName}'s order →`
      : "Submit order →";
  function handleSubmitPillClick() {
    window.dispatchEvent(new Event("flf:open-submit"));
  }

  return (
    <>
      {/* ---- Active standing-order callouts (locked-in, above the order guide) */}
      {activeStanding.map((s) => (
        <div
          key={s.id}
          className="mb-2 rounded-lg border border-brand-blue/15 bg-brand-blue-tint/60 px-4 py-2.5 flex items-center justify-between gap-3"
        >
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-brand-blue/80 font-medium">
              Already on for {targetDeliveryDayName ?? "this delivery"}
            </div>
            <div className="text-[14px] text-ink-primary truncate">
              {s.summary} <span className="text-ink-tertiary">(Standing)</span>
            </div>
          </div>
          <Link
            href={`/standing`}
            className="text-[12px] text-brand-blue underline-offset-2 hover:underline shrink-0"
          >
            manage →
          </Link>
        </div>
      ))}

      {/* ---- Brief 8 V2 landscape strip — thin farm photo above the
          order-guide header. 96px mobile / 144px desktop with a
          caption pill bottom-left. Deliberately atmospheric: it does
          not carry information the buyer needs, just gives the page
          a sense of place before the working chrome starts. The
          Submit pill from PR #141 sits BELOW the header (lines ~223+)
          and is intentionally untouched. */}
      <div className="relative h-24 md:h-36 overflow-hidden rounded-xl ring-1 ring-black/[0.06] mb-4">
        <Image
          src="/photos/farm-4.jpg"
          alt="A morning at one of our partner farms in the Finger Lakes"
          fill
          sizes="(max-width: 768px) 100vw, 56rem"
          className="object-cover"
          style={{ objectPosition: "center 50%" }}
          priority
        />
        {targetDeliveryDayName ? (
          <span className="absolute bottom-2.5 left-3 inline-flex items-center rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-ink-primary shadow-sm">
            For {targetDeliveryDayName}
            {targetDeliveryDate ? (
              <span className="text-ink-tertiary tabular">
                {" · "}
                {shortDate(targetDeliveryDate)}
              </span>
            ) : null}
          </span>
        ) : null}
      </div>

      {/* ---- Order-guide header ----------------------------------------- */}
      <div className="mb-3 pt-1">
        <div className="flex items-start justify-between gap-3">
          <div className="display text-2xl tracking-tight leading-tight">
            Your order guide for {targetDeliveryDayName ?? "next delivery"},{" "}
            <span className="tabular">{shortDate(targetDeliveryDate)}</span>
          </div>
          {allGuides.length > 0 ? (
            <div className="pt-1 shrink-0">
              <ListSwitcher
                guides={allGuides}
                activeGuideId={activeGuideId}
              />
            </div>
          ) : null}
        </div>
      </div>

      {/* ---- In-eye-line submit pill — hidden until there's something in
          the cart to submit. With no rhythm prefill, the cart starts
          empty, so an always-visible "Submit Friday's order →" would
          point at an empty submission. */}
      {lineCount > 0 ? (
        <div className="mb-4">
          <button
            type="button"
            onClick={handleSubmitPillClick}
            disabled={submitPillUnderMin}
            aria-disabled={submitPillUnderMin}
            className={
              submitPillUnderMin
                ? "w-full flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-semibold bg-bg-secondary text-ink-tertiary border border-black/[0.06] cursor-not-allowed"
                : "w-full flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-semibold bg-brand-blue text-white hover:bg-brand-blue-dark focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition-colors duration-150 active:scale-[0.98]"
            }
          >
            {submitPillCopy}
          </button>
        </div>
      ) : null}

      {/* ---- Search ------------------------------------------------------ */}
      <div className="sticky top-0 z-20 -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 py-2 bg-white/95 backdrop-blur-sm mb-3">
        <SearchBar
          mode="local"
          value={search}
          onChange={setSearch}
          placeholder="Search your order guide"
        />
      </div>

      {/* ---- Your weekly orders: full guide as DraftStrip ------------ */}
      {guideIsEmpty ? (
        <EmptyState
          title="Nothing in your order guide yet"
          body="Browse the catalog and add the products you'd like in your weekly orders."
          cta={{ href: "/catalog", label: "Browse the catalog" }}
        />
      ) : (
        (() => {
          const filtered = weeklyRows.filter(searchMatch);
          if (filtered.length === 0) return null;
          const stockTiles: GuideRow[] = [];
          const stockoutRows: GuideRow[] = [];
          for (const r of filtered) {
            if (
              r.product.available_this_week === false ||
              r.product.available_b2b === false
            ) {
              stockoutRows.push(r);
            } else {
              stockTiles.push(r);
            }
          }
          const tileItems = stockTiles.map((r) => ({
            product: r.product,
            unitPrice: r.unitPrice,
            packs: r.packs,
          }));
          return (
            <section>
              <SectionHeader>Your weekly orders</SectionHeader>
              {tileItems.length > 0 ? (
                <DraftStrip tiles={tileItems} rows={3} />
              ) : null}
              {stockoutRows.length > 0 ? (
                <div className={tileItems.length > 0 ? "mt-4" : ""}>
                  <SectionHeader>Out this week</SectionHeader>
                  <div className="card overflow-hidden divide-y divide-black/[0.04]">
                    {stockoutRows.map((r) => {
                      const subs = pickSubstitutes(
                        r.product,
                        subPool,
                        buyerProductCounts,
                        globalCounts,
                        2,
                      );
                      return (
                        <DraftLine
                          key={r.product.id}
                          row={r}
                          substitutes={subs}
                        />
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </section>
          );
        })()
      )}

      {/* ---- Suggested: recent buys not yet in the order guide ----------- */}
      {!search && suggestedProducts.length > 0 ? (
        <section className="mt-6">
          <SectionHeader>Suggested</SectionHeader>
          <DraftStrip tiles={suggestedProducts.map(toDraftItem)} rows={3} />
        </section>
      ) : null}

      {/* ---- New from your farms ----------------------------------------- */}
      {!search && newFromProducers.length > 0 ? (
        <section className="mt-6">
          <SectionHeader>New from your farms</SectionHeader>
          <DraftStrip tiles={newFromProducers.map(toDraftItem)} rows={3} />
        </section>
      ) : null}

      <SubmitSheet
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        deliveryDayName={targetDeliveryDayName}
        accountMinimum={accountMinimum}
        deliveryFee={deliveryFee}
        pastCutoff={pastCutoff}
        upcomingDeliveries={upcomingDeliveries}
      />

      <SubmitSheetBridge onOpen={() => setSubmitOpen(true)} />
    </>
  );
}

/** Listens for a global 'flf:open-submit' event the StickyCartBar
 *  dispatches when its CTA is tapped. Keeps the pill decoupled from this
 *  component's React tree. */
function SubmitSheetBridge({ onOpen }: { onOpen: () => void }) {
  useEffect(() => {
    function handler() {
      onOpen();
    }
    window.addEventListener("flf:open-submit", handler);
    return () => window.removeEventListener("flf:open-submit", handler);
  }, [onOpen]);
  return null;
}

/** Adapter: PricedProductLite has product fields flat; DraftTile wants
 *  them nested under `product`. */
function toDraftItem(p: PricedProductLite): DraftItem {
  return { product: p, unitPrice: p.unitPrice, packs: p.packs };
}

/** Section header used above each strip on /guide. Uppercase eyebrow
 *  caps in ink-tertiary, ~11px. */
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] uppercase tracking-wider text-ink-tertiary font-medium mb-2 px-1">
      {children}
    </div>
  );
}

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Number(m[2]) - 1]} ${Number(m[3])}`;
}
