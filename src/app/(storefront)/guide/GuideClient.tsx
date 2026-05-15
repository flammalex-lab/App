"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { OrderGuide, Product } from "@/lib/supabase/types";
import type { PackRow } from "@/app/(storefront)/catalog/[id]/packs";
import { ScrollStrip } from "@/app/(storefront)/catalog/ScrollStrip";
import { groupBySubCategory } from "@/lib/products/sub-category";
import { EmptyState } from "@/components/ui/EmptyState";
import { useCart, type CartLine } from "@/lib/cart/store";
import { DraftLine, pickSubstitutes } from "./DraftLine";
import { DraftStrip } from "./DraftStrip";
import { SubmitSheet } from "./SubmitSheet";
import { dateLong } from "@/lib/utils/format";
import type { GuideRow, PricedProductLite } from "./page";
import { SearchBar } from "@/components/catalog/SearchBar";
import { ListSwitcher } from "./ListSwitcher";

interface UpcomingDelivery {
  date: string;
  dayName: string;
}

interface LastOrder {
  id: string;
  order_number: string;
  total: number;
  item_count: number;
  deliveryLabel: string | null;
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

  // ---- v2 draft props ---------------------------------------------------
  /** Rhythm signals from `loadDraftRhythm` keyed by product_id. */
  rhythmByProduct?: RhythmByProduct;
  /** ISO yyyy-mm-dd date of the next delivery the draft targets. */
  targetDeliveryDate: string | null;
  /** Pretty weekday name ("Friday"). Used in the draft header + sheet title. */
  targetDeliveryDayName: string | null;
  /** Active standing orders matching the target weekday — render as
   *  separate locked-in cards above the draft. */
  activeStanding?: ActiveStanding[];
  /** Buyer's own product-level qty totals (for substitute ranking). */
  buyerProductCounts?: Record<string, number>;
  /** Account minimum + delivery fee — feeds the SubmitSheet totals. */
  accountMinimum: number;
  deliveryFee: number;
  /** Upcoming delivery days the buyer may switch to from the SubmitSheet. */
  upcomingDeliveries?: UpcomingDelivery[];
  /** Demoted "clone last Friday's order" chip in the draft header. */
  lastOrder: LastOrder | null;
  /** Status === inactive/churned — disable draft interactions. */
  accountPaused?: boolean;
  /** Most recent cutoff was already passed (drives the "rolled forward"
   *  note + disables submit in the sheet). */
  pastCutoff?: boolean;
  /** All of the buyer's order guides — drives the list switcher in the
   *  header. The DEFAULT view (this component) always corresponds to the
   *  default guide; the switcher lets the buyer flip to non-default
   *  side-lists, which render via the simpler `NonDefaultListView`. */
  allGuides?: OrderGuide[];
  activeGuideId?: string | null;
}

type PricedProduct = Product & { unitPrice: number | null; packs?: PackRow[] };

export function GuideClient({
  items,
  newFromProducers = [],
  recentBuys = [],
  inGuideIds = [],
  rhythmByProduct = {},
  targetDeliveryDate,
  targetDeliveryDayName,
  activeStanding = [],
  buyerProductCounts = {},
  accountMinimum,
  deliveryFee,
  upcomingDeliveries = [],
  lastOrder,
  accountPaused = false,
  pastCutoff = false,
  allGuides = [],
  activeGuideId = null,
}: Props) {
  const [search, setSearch] = useState("");
  const [submitOpen, setSubmitOpen] = useState(false);

  const seedRhythm = useCart((s) => s.seedRhythm);
  const setDeliveryDate = useCart((s) => s.setDeliveryDate);
  const persistedDeliveryDate = useCart((s) => s.deliveryDate);
  const lineCount = useCart((s) => s.lines.length);
  const adjustedKeys = useCart((s) => s.adjustedKeys);
  const clearStaleDeliveryDate = useCart((s) => s.clearStaleDeliveryDate);
  // Subtotal (sum of unitPrice * qty across all lines) — drives the under-min
  // copy on the in-eye-line submit pill. Mirrors the math the bottom
  // StickyCartBar does (no delivery-fee add-on here; the cart bar owns the
  // total + fee surface, the in-eye-line pill is action-first).
  const cartSubtotal = useCart((s) =>
    s.lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0),
  );

  // ---- B1: drop any stale persisted delivery date on every mount.
  // Runs *before* the rhythm-seed effect so the default-date branch
  // below picks the freshly-computed `targetDeliveryDate` instead of
  // honoring a stored date that's already past today's cutoff.
  // Idempotent — no-op when the stored date is still valid.
  useEffect(() => {
    clearStaleDeliveryDate(targetDeliveryDate);
  }, [targetDeliveryDate, clearStaleDeliveryDate]);

  // ---- Seed the cart with rhythm-suggested lines once, on first mount.
  // Idempotent — `seedRhythm` skips products already in the cart so a
  // buyer mid-edit doesn't lose their adjustments on navigation. Empty
  // when there's no rhythm history.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    if (accountPaused) return;
    if (Object.keys(rhythmByProduct).length === 0) return;
    const seedLines: CartLine[] = [];
    for (const it of items) {
      const r = rhythmByProduct[it.product.id];
      if (!r) continue;
      // Skip stockouts — they're rendered as the stockout state, not a
      // pre-filled line.
      if (
        it.product.available_this_week === false ||
        it.product.available_b2b === false
      ) {
        continue;
      }
      const qty = r.averageQty;
      if (qty <= 0) continue;
      seedLines.push({
        productId: it.product.id,
        variantKey: null,
        variantSku: null,
        sku: it.product.sku,
        name: it.product.name,
        packSize: it.product.pack_size,
        unit: it.product.unit,
        unitPrice: it.unitPrice ?? 0,
        priceByWeight: Boolean(it.product.price_by_weight),
        quantity: qty,
      });
    }
    if (seedLines.length > 0) seedRhythm(seedLines);
    if (targetDeliveryDate && !persistedDeliveryDate) {
      setDeliveryDate(targetDeliveryDate);
    }
    seededRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searchMatch = (r: GuideRow) =>
    !search || r.product.name.toLowerCase().includes(search.toLowerCase());

  // ---- Draft section: rhythm-suggested + their stockout flips. Sort by
  // sub-category bucket (same grouping the catalog uses).
  const draftRows = useMemo(() => {
    const inDraft = items.filter((r) => Boolean(rhythmByProduct[r.product.id]));
    inDraft.sort((a, b) => {
      const aR = rhythmByProduct[a.product.id]!;
      const bR = rhythmByProduct[b.product.id]!;
      if (aR.occurrenceCount !== bR.occurrenceCount) {
        return bR.occurrenceCount - aR.occurrenceCount;
      }
      return a.product.name.localeCompare(b.product.name);
    });
    return inDraft;
  }, [items, rhythmByProduct]);

  // ---- Non-draft items still in the buyer's guide: rendered "below the
  // draft" so the buyer can re-add what rhythm didn't surface.
  const extraGuideRows = useMemo(
    () => items.filter((r) => !rhythmByProduct[r.product.id]),
    [items, rhythmByProduct],
  );

  const draftSections = useMemo(() => {
    const lite = draftRows.map((r) => ({
      id: r.product.id,
      row: r,
      name: r.product.name,
      category: r.product.category,
      sub_category: r.product.sub_category,
      sku: r.product.sku,
    }));
    const groups = groupBySubCategory(lite);
    return groups.map((g) => ({
      subCategory: g.subCategory,
      rows: g.items
        .map((it) => it.row)
        .sort((a, b) => a.product.name.localeCompare(b.product.name)),
    }));
  }, [draftRows]);

  // ---- "Anything new from your producers" strips — sub-category-grouped
  // products in the guide that DIDN'T make the rhythm cut. Same shape as
  // the old GuideClient but folded below the draft.
  const extraSections = useMemo(() => {
    const lite = extraGuideRows.map((r) => ({
      id: r.product.id,
      row: r,
      name: r.product.name,
      category: r.product.category,
      sub_category: r.product.sub_category,
      sku: r.product.sku,
    }));
    const groups = groupBySubCategory(lite);
    return groups.map((g) => ({
      subCategory: g.subCategory,
      rows: g.items
        .map((it) => it.row)
        .sort((a, b) => a.product.name.localeCompare(b.product.name)),
    }));
  }, [extraGuideRows]);

  // ReadonlySet for fast badge lookups inside ScrollStrip. Memoised so the
  // prop reference is stable across renders.
  const inGuideSet = useMemo(() => new Set(inGuideIds), [inGuideIds]);

  // Build a substitute-candidate pool keyed by sub_category for the
  // stockout flow. We use the buyer's own items (so swaps prefer products
  // already in the guide) plus the "new from your producers" + recent
  // buys pool. The pickSubstitutes helper filters out same-producer and
  // unavailable candidates.
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

  // Light global counts for substitute tiebreak — derived from recentBuys
  // ranking is the closest signal we have without another query.
  const globalCounts = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    recentBuys.forEach((p, i) => {
      out[p.id] = recentBuys.length - i;
    });
    return out;
  }, [recentBuys]);

  // Whether the draft has anything in it (draft body) — drives the
  // empty-draft state vs the full draft.
  const draftIsEmpty = draftRows.length === 0 && lineCount === 0;

  // ---- In-eye-line submit pill ---------------------------------------
  // Sits at the top of the draft so a buyer whose draft is exactly right
  // can submit in one tap without scrolling to find the bottom cart bar.
  // States mirror the bottom StickyCartBar (under-min, ready); past-cutoff
  // collapses into the same two states because `targetDeliveryDayName` is
  // already rolled forward upstream. Hidden when the draft is empty —
  // the empty-state card already directs the buyer to the catalog. Wires
  // through the same `flf:open-submit` event the bottom pill uses, so the
  // SubmitSheet opens identically from both surfaces.
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

  const dateLabel = targetDeliveryDate
    ? dateLong(targetDeliveryDate)
    : "your next delivery";
  // Count rhythm rows the buyer has personally diverged from. `adjustedKeys`
  // is a superset of `skippedKeys` (skipLine flags both) — so quantity
  // tweaks, skips, and add-backs all count as "edits." Keys use the
  // draft-default `variantKey = null`, mirroring how lines are seeded.
  const editCount = useMemo(() => {
    const set = new Set(adjustedKeys);
    let n = 0;
    for (const r of draftRows) {
      if (set.has(`${r.product.id}::`)) n += 1;
    }
    return n;
  }, [adjustedKeys, draftRows]);
  const draftHeaderSub = `${draftRows.length} ${draftRows.length === 1 ? "line" : "lines"} · pulled from your last 4 ${targetDeliveryDayName ? `${targetDeliveryDayName}s` : "deliveries"} · ${editCount} ${editCount === 1 ? "edit" : "edits"}`;

  return (
    <>
      {/* ---- Active standing-order callouts (locked-in, above the draft) */}
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

      {/* ---- Draft header ------------------------------------------------ */}
      <div className="mb-3 pt-1">
        <div className="flex items-start justify-between gap-3">
          <div className="display text-2xl tracking-tight leading-tight">
            Your draft for {targetDeliveryDayName ?? "next delivery"},{" "}
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
        <div className="text-[12px] text-ink-secondary mt-0.5">{draftHeaderSub}</div>
        {pastCutoff ? (
          <p className="text-[12px] text-ink-tertiary mt-1">
            Just past today&apos;s cutoff — we&apos;ve rolled to the next delivery.
          </p>
        ) : null}
        <p className="text-[13px] text-ink-secondary leading-snug mt-2">
          Your usual for {targetDeliveryDayName ?? "this delivery"} — adjust the lines you need to change, skip the rest.
        </p>
        {lastOrder ? (
          <form action={`/api/orders/reorder?orderId=${lastOrder.id}`} method="post" className="mt-1.5">
            <button
              type="submit"
              className="text-[12px] text-brand-blue underline-offset-2 hover:underline"
            >
              Or clone last {lastOrder.deliveryLabel ? lastOrder.deliveryLabel.split(" ")[0].replace(/,$/, "") : "order"}&apos;s order →
            </button>
          </form>
        ) : null}
      </div>

      {/* ---- In-eye-line submit pill ------------------------------------
          Single visible CTA at the top of the draft. NOT sticky — the
          bottom StickyCartBar already owns urgency/countdown/past-cutoff.
          This is the "if your draft is right, submit in one tap" surface.
          Hidden when the draft is empty (the EmptyState card below
          already nudges the buyer toward the catalog). */}
      {!draftIsEmpty ? (
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

      {/* ---- Search + scan ----------------------------------------------
          Sticky pill that filters the guide rows client-side (the guide
          is bounded — typically <100 rows — so a server round-trip would
          be wasteful). Same component the catalog uses, in local mode.
          top-0 anchors to the viewport edge; the StoreNav (z-30) sits
          above and ScrollHideHeader slides it out of the way on mobile
          scroll-down, so the search reads as the bar pinned to the top
          while the buyer scans their draft. z-20 keeps it below sheets
          and the cart pill. */}
      <div className="sticky top-0 z-20 -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 py-2 bg-white/95 backdrop-blur-sm mb-3">
        <SearchBar
          mode="local"
          value={search}
          onChange={setSearch}
          placeholder="Search your draft"
        />
      </div>

      {/* ---- Draft body: rhythm-suggested lines grouped by sub-category - */}
      {draftIsEmpty ? (
        <EmptyState
          title="Nothing in your draft yet"
          body="Your draft will fill in after a few more deliveries. For now, browse the catalog and add what you need."
          cta={{ href: "/catalog", label: "Browse the catalog" }}
        />
      ) : (
        <div className="space-y-4">
          {draftSections.map(({ subCategory, rows }) => {
            const filtered = rows.filter(searchMatch);
            if (filtered.length === 0) return null;
            // Split: in-stock rows render as condensed DraftTiles in a
            // horizontal-scroll grid; stockout rows fall to fullwidth
            // DraftLines below the grid so the substitute chips still
            // have room to breathe. This split preserves the existing
            // stockout UX while making the bulk of the draft 2–3× denser.
            const stockTiles: typeof filtered = [];
            const stockoutRows: typeof filtered = [];
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
            return (
              <section key={subCategory}>
                <div className="text-[11px] uppercase tracking-wider text-ink-tertiary font-medium mb-2 px-1">
                  {subCategory}
                </div>
                {stockTiles.length > 0 ? (
                  <DraftStrip tiles={stockTiles} rows={2} />
                ) : null}
                {stockoutRows.length > 0 ? (
                  <div
                    className={`card overflow-hidden divide-y divide-black/[0.04] ${stockTiles.length > 0 ? "mt-3" : ""}`}
                  >
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
                ) : null}
              </section>
            );
          })}
        </div>
      )}

      {/* ---- "Recent buys" — keep but demote below the draft -------------- */}
      {!search && recentBuys.length > 0 ? (
        <div className="mt-6">
          <ScrollStrip
            title="Recent buys"
            products={recentBuys}
            density="dense"
            inGuideIds={inGuideSet}
            isB2B
          />
        </div>
      ) : null}

      {/* ---- Extra guide items (not in rhythm) — sub-category strips ----- */}
      {extraSections.length > 0 ? (
        <div className="mt-2">
          {extraSections.map(({ subCategory, rows }) => {
            const filtered = rows.filter(searchMatch);
            if (filtered.length === 0) return null;
            const products: PricedProduct[] = filtered.map((r) => ({
              ...r.product,
              unitPrice: r.unitPrice,
              packs: r.packs,
            }));
            const parentGroup = filtered[0]?.product.category ?? null;
            const seeAllHref = parentGroup
              ? `/catalog?group=${parentGroup}&subCategory=${encodeURIComponent(subCategory)}`
              : undefined;
            return (
              <ScrollStrip
                key={subCategory}
                title={subCategory}
                href={seeAllHref}
                products={products}
                density="dense"
                inGuideIds={inGuideSet}
                isB2B
              />
            );
          })}
        </div>
      ) : null}

      {/* ---- "New from your producers" discovery (hidden when searching) - */}
      {!search && newFromProducers.length > 0 ? (
        <div className="mt-2">
          <ScrollStrip
            title="New from your producers"
            products={newFromProducers}
            density="dense"
            inGuideIds={inGuideSet}
            isB2B
          />
        </div>
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

      {/* Imperative open-sheet hook for the sticky pill. The pill lives in
          the storefront layout; it calls window.dispatchEvent('flf:open-submit')
          which we listen for here. Cleaner than threading the open setter
          through the layout tree. */}
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

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Number(m[2]) - 1]} ${Number(m[3])}`;
}

