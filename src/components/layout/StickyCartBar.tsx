"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart/store";
import { countdown, money } from "@/lib/utils/format";
import { useScrollHidden } from "./ScrollHideHeader";

interface SerializedNextDelivery {
  deliveryDate: string;
  cutoffAt: string;
  deliveryDayName: string;
  pastCutoff: boolean;
}

interface Props {
  next?: SerializedNextDelivery | null;
  /** Account minimum from layout — drives the "Below minimum" pill state. */
  accountMinimum?: number;
  deliveryFee?: number;
}

/**
 * The persistent draft pill (repeat-buyer order loop v2). Bottom-fixed
 * above the tab nav, respects pb-safe via the offset on the wrapper.
 *
 * Three states (driven by cart total + minimum + cutoff):
 *
 *   1. BELOW MINIMUM  — white pill with gold left-edge bar + gold ink.
 *                        Left meta: "Under $X min · add $Y". CTA: "Review →"
 *                        (brand-blue). Tapping opens the SubmitSheet so
 *                        the buyer sees what they've got + can add more.
 *
 *   2. READY          — solid brand-blue, white ink. Left meta:
 *                        "{day} {date} · N lines · $total". CTA:
 *                        "Submit order →".
 *
 *   3. CUTOFF PASSED  — feedback-error red pill. Left meta: "Cutoff
 *                        passed — email orders@ilovenyfarms.com". CTA:
 *                        "Email →" (mailto:orders@ilovenyfarms.com).
 *
 * Cutoff countdown ownership: when the cutoff is ≤12h away the pill swaps
 * its left meta to "Cutoff in {Xh Ym} · {day} {hour}" so the urgency lives
 * here, not in the MobileHeader strip. The MobileHeader watches the same
 * cutoff and demotes itself to delivery-date-only when this swap fires.
 *
 * Tapping the pill (in any state except CUTOFF PASSED) dispatches
 * `flf:open-submit` on window — GuideClient listens and pops the
 * SubmitSheet. Decouples the pill from the sheet's React tree.
 */
export function StickyCartBar({
  next,
  accountMinimum = 0,
  deliveryFee = 0,
}: Props) {
  const pathname = usePathname();
  const lines = useCart((s) => s.lines);

  const itemCount = lines.length; // distinct lines, matches the "18 lines" spec
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const effectiveDeliveryFee = subtotal > 0 ? deliveryFee : 0;
  const total = subtotal + effectiveDeliveryFee;

  const onCartPage = pathname?.startsWith("/cart");
  // Hide on /chat — the message composer is bottom-anchored and the pill
  // (fixed at ~bottom: 120px on mobile) would otherwise occlude the input
  // for any buyer with cart contents. /chat isn't a BottomSheet so the
  // sheetOpen guard below doesn't cover it. Bug B2 from the audit pass.
  const onChatPage = pathname === "/chat";
  const navHidden = useScrollHidden();
  const sheetOpen = useSheetOpen();
  // Hide while any BottomSheet is open so the cart pill doesn't peek out
  // behind the sheet backdrop. BottomSheet sets html[data-sheet-open]
  // (see BottomSheet.tsx) and useSheetOpen mirrors that into React state.
  const visible = lines.length > 0 && !onCartPage && !onChatPage && !sheetOpen;

  // Tick the countdown locally so the pill swaps to "Cutoff in 4h 12m"
  // smoothly without waiting on a page refresh. 60s is enough — the
  // countdown is rendered in minutes.
  //
  // B3 hydration: `now` starts null so SSR and the first CSR paint agree
  // on the not-yet-ticking state — `pastCutoff`/`underMin`/`countdownActive`
  // are all derived from `now`, so a lazy `Date.now()` initializer would
  // make SSR and CSR pick different render branches when the clock crosses
  // the cutoff between page-build and hydration. Mirrors the MobileHeader
  // and CutoffClock fix for React error #418. First real tick is queued
  // for the next macrotask via setTimeout(0) so the initial paint matches
  // SSR; subsequent ticks fire each minute.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!visible) return;
    const handle = setTimeout(() => setNow(Date.now()), 0);
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      clearTimeout(handle);
      clearInterval(t);
    };
  }, [visible]);

  // Expose own height as a CSS var so toasts can offset above the bar.
  useEffect(() => {
    if (!visible) return;
    document.documentElement.style.setProperty("--sticky-cart-h", "60px");
    return () => {
      document.documentElement.style.removeProperty("--sticky-cart-h");
    };
  }, [visible]);

  if (!visible) return null;

  // ---- Determine the three states ---------------------------------------
  // While `now` is null (SSR + first hydration paint) we render the pill
  // in its non-cutoff "ready" baseline so SSR and CSR markup agree. As
  // soon as the post-mount tick lands, the cutoff branches activate.
  const pastCutoff =
    next && now != null ? new Date(next.cutoffAt).getTime() - now <= 0 : false;
  const underMin =
    accountMinimum > 0 && !pastCutoff && total < accountMinimum;
  const ms = next && now != null ? new Date(next.cutoffAt).getTime() - now : null;
  const countdownActive = ms != null && ms > 0 && ms < 12 * 60 * 60 * 1000;

  // ---- Render shells ---------------------------------------------------
  // B3: z-30 (was z-20) so the pill sits at the same layer as the
  // BottomTabs and any in-page sticky/animated section that ends up
  // creating its own paint layer (catalog producer drill-in, expanded
  // sub-category sections). The wrapper is `pointer-events-none` and
  // only the inner button is `pointer-events-auto`, so coexisting at
  // the same z as BottomTabs (which sits below the pill vertically)
  // doesn't introduce a click-eat. Stays below BottomSheets (z-50)
  // so the existing sheet-open dance still hides the pill behind any
  // open sheet without the two layers fighting.
  const wrapperClass = `fixed inset-x-0 z-30 px-3 md:px-6 pointer-events-none transition-[bottom] duration-200 md:bottom-6 ${
    navHidden
      ? "bottom-[calc(env(safe-area-inset-bottom,0px)+0.625rem)]"
      : "bottom-[calc(env(safe-area-inset-bottom,0px)+3.75rem)]"
  }`;

  if (pastCutoff) {
    // Past-cutoff pill opens a mailto to orders@ilovenyfarms.com so the
    // buyer can flag a late add directly. The placeholder rep phone that
    // used to live here would ship to prod for accounts without a real
    // rep_phone field, and the in-app /chat thread isn't the front-door
    // contact path anymore — email is.
    return (
      <div className={wrapperClass}>
        <div className="mx-auto max-w-screen-md md:max-w-2xl pointer-events-auto">
          <a
            href="mailto:orders@ilovenyfarms.com"
            className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-feedback-error text-white shadow-floating hover:bg-[#a22a1f] focus:outline-none focus:ring-2 focus:ring-feedback-error/40 transition-colors duration-150 active:scale-[0.98] animate-slide-up"
          >
            <span className="flex-1 min-w-0 leading-tight">
              <span className="block text-sm font-semibold tabular">
                Cutoff passed — email orders@ilovenyfarms.com
              </span>
            </span>
            <span className="inline-flex items-center gap-1 text-sm font-bold shrink-0">
              Email
              <ArrowIcon />
            </span>
          </a>
        </div>
      </div>
    );
  }

  if (underMin) {
    const shortfall = Math.max(0, accountMinimum - total);
    // Round up so the buyer sees a whole-dollar gap to close, never a
    // false "you only need $0.79 more" that the cart can't actually
    // satisfy with real prices. `Math.ceil` matches the warm framing —
    // "add a bit more" reads better than "add $63.31".
    const shortfallDollars = Math.ceil(shortfall);
    const dayName = next?.deliveryDayName ?? null;
    const headline = dayName
      ? `Add $${shortfallDollars} to ship ${dayName}`
      : `Add $${shortfallDollars} to submit`;
    return (
      <div className={wrapperClass}>
        <div className="mx-auto max-w-screen-md md:max-w-2xl pointer-events-auto">
          <Link
            href="/cart"
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white text-[#8a690f] shadow-floating border border-accent-gold/40 hover:bg-accent-gold/5 focus:outline-none focus:ring-2 focus:ring-accent-gold/40 transition-colors duration-150 active:scale-[0.98] animate-slide-up text-left"
          >
            {/* Gold left-edge bar — the per-state visual signal */}
            <span aria-hidden className="h-8 w-1 rounded-full bg-accent-gold shrink-0" />
            <span className="flex-1 min-w-0 flex flex-col justify-center leading-tight">
              <span className="text-sm font-semibold tabular truncate">
                {headline}
              </span>
              {countdownActive ? (
                <span className="text-[11px] text-[#8a690f]/70 tabular truncate">
                  Cutoff in {countdown(ms!)} · {cutoffDayHour(next!)}
                </span>
              ) : null}
            </span>
            <span className="inline-flex items-center gap-1 text-sm font-bold shrink-0 text-brand-blue">
              View
              <ArrowIcon />
            </span>
          </Link>
        </div>
      </div>
    );
  }

  // READY — Brief 2 mobile-chrome spec:
  //   [ qty-blob ] [ Cart · $total / Fri cutoff in 4h 12m ] [ View → ]
  //
  // qty-blob: rounded-md, white@18% tint, the distinct-line-count digit.
  // label: "Cart · $X" main, optional cutoff/delivery sub-line at 11px.
  //   Container is `flex flex-col justify-center` so the two block
  //   children stack inside the pill's box instead of overflowing past
  //   the rounded bottom edge (the previous inline-span-with-block-
  //   children approach was rendering the sub-line outside the pill).
  // CTA: "View →" routes to /cart. Was a one-tap submit via
  //   window.dispatchEvent("flf:open-submit") but that event had a
  //   single listener (GuideClient's SubmitSheetBridge), so taps from
  //   /catalog / /orders / /standing did nothing. Routing to /cart
  //   matches the brief's intent and works from every page.
  return (
    <div className={wrapperClass}>
      <div className="mx-auto max-w-screen-md md:max-w-2xl pointer-events-auto">
        <Link
          href="/cart"
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[14px] bg-brand-blue text-white shadow-[0_8px_24px_rgba(23,99,181,0.25)] hover:bg-brand-blue-dark focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition-colors duration-150 active:scale-[0.98] animate-slide-up text-left"
        >
          <span
            aria-hidden
            className="inline-flex items-center justify-center rounded-lg bg-white/[0.18] px-2 py-1 text-[12px] font-bold tabular leading-none shrink-0"
          >
            {itemCount}
          </span>
          <span className="flex-1 min-w-0 flex flex-col justify-center">
            <span className="text-[13px] font-semibold tabular truncate leading-[1.15]">
              Cart · {money(total)}
            </span>
            {countdownActive ? (
              <span className="text-[11px] font-normal opacity-85 tabular truncate leading-[1.15]">
                {next!.deliveryDayName} cutoff in {countdown(ms!)}
              </span>
            ) : next ? (
              <span className="text-[11px] font-normal opacity-85 tabular truncate leading-[1.15]">
                {next.deliveryDayName} delivery · {formatPillDate(next)}
              </span>
            ) : null}
          </span>
          <span className="inline-flex items-center gap-1 text-[13px] font-bold shrink-0">
            View
            <ArrowIcon />
          </span>
        </Link>
      </div>
    </div>
  );
}

/** Formats the delivery date as e.g. "Fri May 22" for the pill's left meta. */
function formatPillDate(next: SerializedNextDelivery): string {
  const d = new Date(next.deliveryDate);
  if (Number.isNaN(d.getTime())) return next.deliveryDayName;
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** "Tue 2pm" — used inside the countdown meta. */
function cutoffDayHour(next: SerializedNextDelivery): string {
  const d = new Date(next.cutoffAt);
  const wd = d.toLocaleString("en-US", { weekday: "short" });
  const hour = d
    .toLocaleString("en-US", { hour: "numeric", hour12: true })
    .replace(/\s/g, "")
    .toLowerCase();
  return `${wd} ${hour}`;
}

/**
 * Mirrors the `<html data-sheet-open>` flag (set by BottomSheet during its
 * body-scroll-lock layout effect) into React state via MutationObserver.
 * Lets the StickyCartBar disappear while any sheet is open so it doesn't
 * peek out behind the backdrop.
 */
function useSheetOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const html = document.documentElement;
    const update = () => setOpen(html.hasAttribute("data-sheet-open"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(html, {
      attributes: true,
      attributeFilter: ["data-sheet-open"],
    });
    return () => observer.disconnect();
  }, []);
  return open;
}

function ArrowIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
