"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";

// Use layout effect on the client; fall back to plain effect during SSR.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const FOCUSABLES =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

let openSheetCount = 0;

// Constants from the cart-sheet brief (`09-cart-sheet.html` spec table)
const TOP_INSET_PX = 60;
const INITIAL_OPEN_RATIO = 0.65;
const DISMISS_TRAVEL_RATIO = 0.70;
const DISMISS_VELOCITY_PX_PER_MS = 1.1;
const DISMISS_VELOCITY_OFFSET_RATIO = 0.20;
const OPEN_EASE = "cubic-bezier(.2,.8,.2,1)";
const CLOSE_EASE = "cubic-bezier(.4,0,.2,1)";
const OPEN_DURATION_MS = 280;
const CLOSE_DURATION_MS = 240;
const BACKDROP_MAX_OPACITY = 0.40;
const SHEET_RADIUS_PX = 18;
const HANDLE_WIDTH_PX = 40;
const HANDLE_HEIGHT_PX = 4;
const SHEET_Z_INDEX = 70;
const BACKDROP_Z_INDEX = 60;

/**
 * Apple-Maps-style bottom sheet with composite-P gesture math. Use for
 * the cart sheet and product detail sheet. The other 4 sheets in the
 * codebase (AmendOrder, SaveAsStanding, VariantPicker, StockUp) stay
 * on the simpler BottomSheet primitive — they don't need this fidelity.
 *
 * **Composite-P gesture model.** Sheet position (sheetY) and content
 * scroll (scrollTop) share one virtual axis P. Drag deltas update P;
 * P projects back into the two values.
 *
 *   sheetY    ∈ [0, sheetMax]    0 = fully open · sheetMax = closed
 *   scrollTop ∈ [0, scrollMax]   0 = top of content · scrollMax = bottom
 *
 * On drag move: P = P_start + dy. If P > 0 → sheetY = P, scrollTop = 0.
 * If P < 0 → sheetY = 0, scrollTop = -P. One continuous finger motion
 * across sheet drag and content scroll, with no hand-off seam.
 *
 * **Initial open ratio** = 0.65. Sheet shows 65% of its max-open height
 * on open; the rest hangs below for the drag-up reveal.
 *
 * **No snap-back on release.** Wherever the finger leaves, the sheet
 * stays. The only automatic motions are open, close (tap), and
 * dismiss (drag past threshold OR fast downward flick).
 *
 * **Dismiss triggers:**
 *   - sheetY > sheetMax * 0.70 on release
 *   - velocity > 1.1 px/ms downward AND sheetY > sheetMax * 0.20
 *
 * **Backdrop opacity** scales linearly with 1 - sheetY/sheetMax, max 0.40.
 *
 * Z-index: sheet 70, backdrop 60. Above topbar (30) and tabbar (35).
 */
export function Sheet({
  open,
  onClose,
  title,
  ariaLabel,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  ariaLabel?: string;
  children: ReactNode;
  /** Fixed footer slot (e.g. Place Order / Add to cart). Doesn't scroll
   *  with content; doesn't accept drag (buttons remain tappable). */
  footer?: ReactNode;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Geometry (resolved at runtime, measured via ResizeObserver)
  const [sheetMax, setSheetMax] = useState(0);
  const [bodyHeight, setBodyHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);

  // State: sheet translateY (downward offset from max-open position)
  const [sheetY, setSheetY] = useState(0);
  // State: content translateY offset (manual scroll, not native overflow)
  const [scrollTop, setScrollTop] = useState(0);
  // Whether the user is mid-drag (suppresses transition for 1:1 finger follow)
  const [dragging, setDragging] = useState(false);
  // Whether the sheet has performed its initial open animation
  const [opened, setOpened] = useState(false);

  // Gesture refs (avoid re-renders during pointermove)
  const startP = useRef(0);
  const startY = useRef(0);
  const dragSource = useRef<"handle" | "body" | "header" | null>(null);
  const velocityTrack = useRef<Array<{ y: number; t: number }>>([]);
  const pointerId = useRef<number | null>(null);

  const scrollMax = Math.max(0, contentHeight - bodyHeight);

  // ─── Body scroll lock + data-sheet-open ────────────────────────────
  useIsoLayoutEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    const body = document.body;
    const html = document.documentElement;
    const prev = {
      bodyPos: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
      bodyOverflow: body.style.overflow,
      htmlOverflow: html.style.overflow,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    html.setAttribute("data-sheet-open", "true");
    return () => {
      body.style.position = prev.bodyPos;
      body.style.top = prev.bodyTop;
      body.style.left = prev.bodyLeft;
      body.style.right = prev.bodyRight;
      body.style.width = prev.bodyWidth;
      body.style.overflow = prev.bodyOverflow;
      html.style.overflow = prev.htmlOverflow;
      html.removeAttribute("data-sheet-open");
      window.scrollTo({ top: scrollY, left: 0, behavior: "auto" });
    };
  }, [open]);

  // ─── Measure sheet + body + content ────────────────────────────────
  // sheetMax is the sheet's full traversable height = viewportHeight - TOP_INSET_PX.
  // bodyHeight is the scrollable area's height. contentHeight is the
  // measured height of the inner content (drives scrollMax).
  useEffect(() => {
    if (!open) return;
    function measureViewport() {
      const vh = window.innerHeight;
      setSheetMax(vh - TOP_INSET_PX);
    }
    measureViewport();
    window.addEventListener("resize", measureViewport);
    window.addEventListener("orientationchange", measureViewport);
    return () => {
      window.removeEventListener("resize", measureViewport);
      window.removeEventListener("orientationchange", measureViewport);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const bodyEl = bodyRef.current;
    const contentEl = contentRef.current;
    if (!bodyEl || !contentEl) return;
    function measure() {
      setBodyHeight(bodyEl!.getBoundingClientRect().height);
      setContentHeight(contentEl!.scrollHeight);
    }
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(bodyEl);
    ro.observe(contentEl);
    return () => ro.disconnect();
  }, [open]);

  // ─── Initial open animation ────────────────────────────────────────
  // Reset state on every open, then animate from closed → initial open
  // position. We start at sheetY = sheetMax (closed off-screen), then
  // RAF to sheetY = sheetMax * (1 - 0.65) (showing 65%).
  const [lastOpen, setLastOpen] = useState(open);
  if (lastOpen !== open) {
    setLastOpen(open);
    if (open) {
      setSheetY(sheetMax || 800); // start off-screen; resolved sheetMax kicks in next frame
      setScrollTop(0);
      setOpened(false);
    }
  }

  useEffect(() => {
    if (!open || sheetMax === 0) return;
    if (opened) return;
    // First paint: positioned at sheetMax (off-screen). Second paint
    // (via RAF) animates to initial position. Wrapped in setTimeout
    // so React commits the first paint with sheetY = sheetMax before
    // the animation kicks in.
    const id = window.setTimeout(() => {
      const initialY = sheetMax * (1 - INITIAL_OPEN_RATIO);
      setSheetY(initialY);
      setOpened(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, [open, sheetMax, opened]);

  // ─── ESC to close ──────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // ─── Focus management + trap + aria-hidden refcount ────────────────
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const id = window.setTimeout(() => {
      const root = sheetRef.current;
      if (!root) return;
      const auto = root.querySelector<HTMLElement>("[autofocus], [autoFocus]");
      if (auto) {
        auto.focus({ preventScroll: true });
        return;
      }
      const first = root.querySelector<HTMLElement>(FOCUSABLES);
      if (first) first.focus({ preventScroll: true });
    }, 0);
    return () => {
      window.clearTimeout(id);
      const prev = previouslyFocused.current;
      previouslyFocused.current = null;
      if (prev && document.contains(prev)) {
        prev.focus({ preventScroll: true });
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const root = sheetRef.current;
      if (!root) return;
      const nodes = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLES)).filter(
        (n) => !n.hasAttribute("disabled") && n.tabIndex !== -1,
      );
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!active || !root.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus({ preventScroll: true });
        return;
      }
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const main = document.querySelector("main");
    openSheetCount += 1;
    if (main && openSheetCount === 1) {
      main.setAttribute("aria-hidden", "true");
    }
    return () => {
      openSheetCount = Math.max(0, openSheetCount - 1);
      if (openSheetCount === 0) {
        const m = document.querySelector("main");
        if (m) m.removeAttribute("aria-hidden");
      }
    };
  }, [open]);

  // ─── Gesture handlers (pointer events for touch + mouse) ───────────
  function targetIsInteractive(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(
      target.closest(
        "button, input, textarea, select, a, [role='button'], [data-stepper], [data-no-drag]",
      ),
    );
  }

  function startDrag(
    e: React.PointerEvent,
    source: "handle" | "body" | "header",
  ) {
    if (targetIsInteractive(e.target)) return;
    // Composite-P start position
    startP.current = sheetY - scrollTop;
    startY.current = e.clientY;
    dragSource.current = source;
    velocityTrack.current = [{ y: e.clientY, t: performance.now() }];
    pointerId.current = e.pointerId;
    setDragging(true);
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {
      /* setPointerCapture can throw on dead elements; ignore */
    }
  }

  function moveDrag(e: React.PointerEvent) {
    if (dragSource.current == null || pointerId.current !== e.pointerId) return;
    const dy = e.clientY - startY.current;
    // Composite-P
    const p = startP.current + dy;
    if (p > 0) {
      // Sheet partial-open; content sits at top
      const nextSheetY = Math.min(p, sheetMax);
      if (nextSheetY !== sheetY) setSheetY(nextSheetY);
      if (scrollTop !== 0) setScrollTop(0);
    } else {
      // Sheet fully open; content scrolled
      if (sheetY !== 0) setSheetY(0);
      const nextScrollTop = Math.min(-p, scrollMax);
      if (nextScrollTop !== scrollTop) setScrollTop(nextScrollTop);
    }
    // Track velocity (rolling window of last ~80ms)
    const now = performance.now();
    velocityTrack.current.push({ y: e.clientY, t: now });
    velocityTrack.current = velocityTrack.current.filter((s) => now - s.t < 80);
  }

  function endDrag(e: React.PointerEvent) {
    if (dragSource.current == null || pointerId.current !== e.pointerId) return;
    dragSource.current = null;
    pointerId.current = null;
    setDragging(false);
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    // Compute velocity from the rolling window
    const samples = velocityTrack.current;
    let vel = 0;
    if (samples.length >= 2) {
      const first = samples[0];
      const last = samples[samples.length - 1];
      const dt = last.t - first.t;
      if (dt > 0) vel = (last.y - first.y) / dt; // px per ms, positive = downward
    }
    velocityTrack.current = [];

    // Dismiss conditions per brief:
    //   1. sheetY > sheetMax * 0.70 (cumulative travel past threshold)
    //   2. vel > 1.1 px/ms downward AND sheetY > sheetMax * 0.20 (fast flick)
    const travelDismiss = sheetY > sheetMax * DISMISS_TRAVEL_RATIO;
    const flickDismiss =
      vel > DISMISS_VELOCITY_PX_PER_MS &&
      sheetY > sheetMax * DISMISS_VELOCITY_OFFSET_RATIO;
    if (travelDismiss || flickDismiss) {
      // Animate to closed; closing useEffect-derived state will fire onClose
      // after the animation duration so the slide-down is visible.
      setSheetY(sheetMax);
      window.setTimeout(() => onClose(), CLOSE_DURATION_MS);
      return;
    }
    // No snap-back — sheet stays where finger left it.
  }

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const visibleRatio = sheetMax > 0 ? Math.max(0, 1 - sheetY / sheetMax) : 0;
  const backdropOpacity = visibleRatio * BACKDROP_MAX_OPACITY;

  const sheetTransition = dragging
    ? "none"
    : `transform ${opened ? OPEN_DURATION_MS : CLOSE_DURATION_MS}ms ${opened ? OPEN_EASE : CLOSE_EASE}`;

  return createPortal(
    <>
      {/* Backdrop — z 60. Tap to close. Opacity scales with sheet visibility. */}
      <div
        aria-hidden
        onPointerDown={(e) => {
          // Only close if the tap landed on the backdrop itself.
          if (e.target === e.currentTarget) onClose();
        }}
        style={{
          backgroundColor: `rgba(0,0,0,${backdropOpacity})`,
          zIndex: BACKDROP_Z_INDEX,
          transition: dragging ? "none" : `background-color ${OPEN_DURATION_MS}ms ${OPEN_EASE}`,
        }}
        className="fixed inset-0"
      />

      {/* Sheet — z 70. position fixed at bottom 0; translateY pushes
          it downward for partial-open / dismiss. */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? (typeof title === "string" ? title : "Dialog")}
        style={{
          zIndex: SHEET_Z_INDEX,
          height: sheetMax > 0 ? `${sheetMax}px` : `calc(100vh - ${TOP_INSET_PX}px)`,
          transform: `translateY(${sheetY}px)`,
          transition: sheetTransition,
          borderTopLeftRadius: SHEET_RADIUS_PX,
          borderTopRightRadius: SHEET_RADIUS_PX,
          boxShadow: "0 -8px 32px rgba(0,0,0,0.18)",
          willChange: "transform",
        }}
        className="fixed bottom-0 left-0 right-0 bg-white flex flex-col"
      >
        {/* Drag handle — pointer events here always control the sheet */}
        <div
          onPointerDown={(e) => startDrag(e, "handle")}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="shrink-0 pt-2 pb-2 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
        >
          <span
            aria-hidden
            style={{
              width: HANDLE_WIDTH_PX,
              height: HANDLE_HEIGHT_PX,
              backgroundColor: "rgba(0,0,0,0.20)",
            }}
            className="block rounded-full"
          />
        </div>

        {/* Header — title + close button. Drag-enabled around the title;
            close button has data-no-drag so taps don't initiate drag. */}
        {title ? (
          <div
            onPointerDown={(e) => startDrag(e, "header")}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className="shrink-0 px-5 pt-1 pb-3 flex items-start justify-between gap-3 border-b border-black/[0.06] touch-none"
          >
            <div className="display text-lg leading-tight">{title}</div>
            <button
              data-no-drag
              onClick={onClose}
              aria-label="Close"
              className="-mr-1 -mt-1 h-9 w-9 rounded-full flex items-center justify-center text-ink-secondary hover:bg-bg-secondary hover:text-ink-primary transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-blue/40"
            >
              <span className="text-xl leading-none">×</span>
            </button>
          </div>
        ) : null}

        {/* Body — overflow hidden. Content translates manually via translateY. */}
        <div
          ref={bodyRef}
          onPointerDown={(e) => startDrag(e, "body")}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="flex-1 overflow-hidden relative touch-none"
        >
          <div
            ref={contentRef}
            style={{
              transform: `translateY(${-scrollTop}px)`,
              transition: dragging ? "none" : `transform ${OPEN_DURATION_MS}ms ${OPEN_EASE}`,
              willChange: "transform",
            }}
            className="absolute top-0 left-0 right-0"
          >
            {children}
          </div>
        </div>

        {/* Footer — fixed, no drag. Buttons (Place Order / Add to cart). */}
        {footer ? (
          <div
            data-no-drag
            className="shrink-0 px-5 py-4 border-t border-black/[0.06] bg-white"
          >
            {footer}
          </div>
        ) : null}
      </div>
    </>,
    document.body,
  );
}
