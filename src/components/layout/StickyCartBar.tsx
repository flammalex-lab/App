"use client";

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
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
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
  const pastCutoff = next ? new Date(next.cutoffAt).getTime() - now <= 0 : false;
  const underMin =
    accountMinimum > 0 && !pastCutoff && total < accountMinimum;
  const ms = next ? new Date(next.cutoffAt).getTime() - now : null;
  const countdownActive = ms != null && ms > 0 && ms < 12 * 60 * 60 * 1000;

  // CTA + click handler vary by state.
  function handleClick(e: React.MouseEvent) {
    if (pastCutoff) return; // tel link handled directly below
    e.preventDefault();
    window.dispatchEvent(new Event("flf:open-submit"));
  }

  // ---- Render shells ---------------------------------------------------
  const wrapperClass = `fixed inset-x-0 z-20 px-3 md:px-6 pointer-events-none transition-[bottom] duration-200 md:bottom-6 ${
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
    return (
      <div className={wrapperClass}>
        <div className="mx-auto max-w-screen-md md:max-w-2xl pointer-events-auto">
          <button
            type="button"
            onClick={handleClick}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white text-[#8a690f] shadow-floating border border-accent-gold/40 hover:bg-accent-gold/5 focus:outline-none focus:ring-2 focus:ring-accent-gold/40 transition-colors duration-150 active:scale-[0.98] animate-slide-up text-left"
          >
            {/* Gold left-edge bar — the per-state visual signal */}
            <span aria-hidden className="h-8 w-1 rounded-full bg-accent-gold shrink-0" />
            <span className="flex-1 min-w-0 leading-tight">
              <span className="block text-sm font-semibold tabular">
                {money(shortfall)} to your {money(accountMinimum)} minimum
              </span>
              {countdownActive ? (
                <span className="block text-[11px] text-[#8a690f]/70 tabular truncate">
                  Cutoff in {countdown(ms!)} · {cutoffDayHour(next!)}
                </span>
              ) : null}
            </span>
            <span className="inline-flex items-center gap-1 text-sm font-bold shrink-0 text-brand-blue">
              Review
              <ArrowIcon />
            </span>
          </button>
        </div>
      </div>
    );
  }

  // READY
  // B8: The money portion is the most useful info on the pill — never let it
  // truncate. Split leftMeta into segments so the date + lines prefix can
  // collapse on narrow viewports (`hidden sm:inline`) while `$total →` stays
  // intact. Countdown mode keeps its single-string form (urgency copy is
  // short — "Cutoff in 4h 12m · Tue 2pm" fits without truncation).
  const linesLabel = `${itemCount} ${itemCount === 1 ? "line" : "lines"}`;

  return (
    <div className={wrapperClass}>
      <div className="mx-auto max-w-screen-md md:max-w-2xl pointer-events-auto">
        <button
          type="button"
          onClick={handleClick}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-brand-blue text-white shadow-floating hover:bg-brand-blue-dark focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition-colors duration-150 active:scale-[0.98] animate-slide-up text-left"
        >
          <span className="flex-1 min-w-0 leading-tight">
            {countdownActive ? (
              <span className="block text-sm font-semibold tabular truncate">
                Cutoff in {countdown(ms!)} · {cutoffDayHour(next!)}
              </span>
            ) : (
              <span className="flex items-baseline gap-1.5 text-sm font-semibold tabular">
                {next ? (
                  <span className="hidden sm:inline truncate">
                    {formatPillDate(next)} ·
                  </span>
                ) : null}
                <span className="truncate min-w-0">{linesLabel} ·</span>
                <span className="whitespace-nowrap shrink-0">{money(total)}</span>
              </span>
            )}
          </span>
          <span className="inline-flex items-center gap-1 text-sm font-bold shrink-0">
            Submit order
            <ArrowIcon />
          </span>
        </button>
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
