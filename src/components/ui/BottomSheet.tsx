"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";

// Use layout effect on the client; fall back to plain effect during SSR
// so React doesn't warn. The lock has to run synchronously after render
// and before paint to avoid the page briefly snapping to top on open.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Standard focusables selector for the focus trap. Excludes disabled,
// hidden inputs, and elements with tabindex=-1.
const FOCUSABLES =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Reference count of currently-open sheets so we don't strip aria-hidden
// off <main> while a nested sheet is still open.
let openSheetCount = 0;

/**
 * Mobile-first bottom sheet. Slides up from the bottom edge, supports
 * touch drag-to-dismiss, locks body scroll while open. On md+ it morphs
 * into a centered modal — bottom-sheet feel reads weird on wide
 * viewports.
 *
 * Gesture model (Phase 1 of the cart-sheet brief — adapted from the
 * composite-P spec):
 *
 *   - **Single max-open height** = `calc(100vh - 60px)`. No peek/full
 *     detents. Sheet either opens to natural content height (capped at
 *     max) or sits at max with the inner overflow scrolling.
 *   - **No snap-back on release.** Wherever the finger leaves the sheet,
 *     it stays. No animation home unless the drag crossed the dismiss
 *     threshold (then it animates closed).
 *   - **70% dismiss threshold.** If `dragOffset > 0.70 * sheetHeight`,
 *     release fires `onClose`.
 *   - **Backdrop opacity scales linearly** with `1 - dragOffset/sheetHeight`,
 *     max 0.40. Mid-drag the scrim fades in/out continuously with the
 *     sheet's position.
 *   - **Drag from handle OR content-at-top.** Pulling down from inside
 *     content only initiates a sheet drag when `scrollTop === 0`;
 *     otherwise native overflow scroll handles it. This is the
 *     "composite handoff" — one continuous motion between content
 *     scroll and sheet drag.
 *   - **Native overflow inside the sheet.** Composite-P brief proposed
 *     manual translate; we keep native scroll for keyboard
 *     accessibility, momentum on iOS, and zero rubber-band fights.
 *   - **`will-change: transform`** so the transform compositing
 *     stays on the GPU through the drag — no layout thrash, 60fps on
 *     mid-tier Android.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  ariaLabel,
  children,
  /** Max width on desktop (md+). Defaults to 32rem. */
  desktopMaxWidth = "32rem",
  /**
   * Skip the entrance slide-up animation. Used by the parallel-route
   * product modal: its `loading.tsx` skeleton already runs the slide-up
   * once during route compile, then this real sheet swap-mounts on top
   * — re-running the animation makes the overlay appear to "expand
   * twice" on first open. With this flag the real sheet appears in
   * place where the skeleton was.
   */
  suppressEnterAnimation = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  ariaLabel?: string;
  children: ReactNode;
  desktopMaxWidth?: string;
  suppressEnterAnimation?: boolean;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Element focused before the sheet opened, so we can hand focus back.
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const startY = useRef<number | null>(null);
  const startOffset = useRef<number>(0);
  // "handle": gestures here always control the sheet.
  // "content": only intercept the gesture when content is at scrollTop = 0
  //            AND the user is pulling DOWN. Otherwise native overflow handles.
  const dragSource = useRef<"handle" | "content" | null>(null);
  // The sheet's downward translateY in px. 0 = fully open.
  // Persists across drags (release-where-you-let-go semantics).
  const [dragOffset, setDragOffset] = useState(0);
  // dragging state is read during render to disable transitions while
  // the finger is on the sheet (1:1 finger-follow, no smoothing lag).
  const [dragging, setDragging] = useState(false);
  // Sheet height in px — used to compute the dismiss threshold and the
  // backdrop opacity ratio. Resolved on open via measuring the rendered
  // sheet (not via vh math) so iOS Safari's vh quirks don't drift the
  // values between renders.
  const [sheetHeightPx, setSheetHeightPx] = useState(0);

  // Lock body scroll while open WITHOUT jumping the underlying page.
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

  // ESC to close.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Focus management — capture prior, move into sheet, restore on close.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current =
      (document.activeElement instanceof HTMLElement ? document.activeElement : null);
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

  // Focus trap.
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

  // aria-hidden <main> while sheet is open. Refcount for nested sheets.
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

  // Reset offset on every open. Render-time sync (not useEffect) to
  // satisfy React 19's set-state-in-effect lint — `open` transitioning
  // is the trigger, not a derivable source.
  const [lastOpen, setLastOpen] = useState(open);
  if (lastOpen !== open) {
    setLastOpen(open);
    if (open) {
      setDragOffset(0);
    }
  }

  // Measure the rendered sheet height once it mounts. Drives the
  // dismiss threshold (70% of height) and the backdrop opacity ratio.
  useEffect(() => {
    if (!open) return;
    const el = sheetRef.current;
    if (!el) return;
    function measure() {
      const h = el!.getBoundingClientRect().height;
      if (h > 0) setSheetHeightPx(h);
    }
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  // ─── Gesture handlers ──────────────────────────────────────────────
  // Don't initiate a drag if the touch started on an interactive
  // control. Otherwise tapping a stepper's "+" registers as the start
  // of a drag and the sheet wobbles on every qty-bump.
  function targetIsInteractive(e: React.TouchEvent): boolean {
    const t = e.target as HTMLElement | null;
    if (!t) return false;
    return Boolean(
      t.closest("button, input, textarea, select, a, [role='button'], [data-stepper]"),
    );
  }

  function onHandleTouchStart(e: React.TouchEvent) {
    if (targetIsInteractive(e)) return;
    startY.current = e.touches[0].clientY;
    startOffset.current = dragOffset;
    dragSource.current = "handle";
    setDragging(true);
  }

  function onContentTouchStart(e: React.TouchEvent) {
    if (targetIsInteractive(e)) return;
    startY.current = e.touches[0].clientY;
    startOffset.current = dragOffset;
    dragSource.current = "content";
    setDragging(true);
  }

  function onTouchMove(e: React.TouchEvent) {
    if (startY.current == null || dragSource.current == null) return;
    const dy = e.touches[0].clientY - startY.current;

    if (dragSource.current === "handle") {
      // Handle drag: any direction adjusts the sheet's offset.
      // Clamp to >= 0 (can't drag the sheet UP past its natural max-open).
      const next = Math.max(0, startOffset.current + dy);
      setDragOffset(next);
      return;
    }

    // Content drag: only commandeer when scrolled to top AND pulling down.
    // Otherwise native overflow handles the gesture (composite handoff).
    const inner = scrollRef.current;
    const innerAtTop = !inner || inner.scrollTop <= 0;
    if (!innerAtTop) {
      // Content has been scrolled — let native scroll do its thing.
      // Reset the drag baseline so a later transition to sheet-drag
      // doesn't accumulate the prior dy.
      startY.current = e.touches[0].clientY;
      startOffset.current = dragOffset;
      return;
    }
    if (dy > 0) {
      // Pulling down at the top → drag the sheet for dismiss.
      const next = startOffset.current + dy;
      setDragOffset(next);
    } else {
      // Pulling up at sheet's natural max-open — no-op. Native overflow
      // takes over once content has anything to scroll into view.
      const next = Math.max(0, startOffset.current + dy);
      setDragOffset(next);
    }
  }

  function onTouchEnd() {
    const threshold = sheetHeightPx > 0 ? sheetHeightPx * 0.70 : 280;
    if (dragOffset > threshold) {
      onClose();
    }
    // No snap-back. If dragOffset is < threshold, the sheet stays at
    // whatever offset the finger left it. Buyer can tap close, tap
    // backdrop, or drag again to dismiss.
    startY.current = null;
    dragSource.current = null;
    setDragging(false);
  }

  if (!open) return null;
  if (typeof document === "undefined") return null;

  // Backdrop opacity scales linearly with sheet visibility.
  // visibleRatio = 1 when sheet is at offset 0; 0 when offset = sheetHeight.
  const visibleRatio =
    sheetHeightPx > 0 ? Math.max(0, 1 - dragOffset / sheetHeightPx) : 1;
  const backdropOpacity = visibleRatio * 0.40;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? (typeof title === "string" ? title : "Dialog")}
      onMouseDown={(e) => {
        if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) onClose();
      }}
      style={{ backgroundColor: `rgba(0,0,0,${backdropOpacity})` }}
      className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center transition-colors duration-150 animate-fade-in"
    >
      <div
        ref={sheetRef}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        style={{
          transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined,
          // No transition while the finger is on the sheet (1:1 follow).
          // After release: 240ms ease-out only on dismiss (which fires
          // onClose, unmounting before any animation runs anyway). For
          // partial drags released below threshold, the sheet stays
          // at its dragged position — no animate-home (per brief).
          transition: dragging ? "none" : undefined,
          maxWidth: desktopMaxWidth,
          willChange: "transform",
        }}
        className={`relative w-full bg-white rounded-t-2xl md:rounded-2xl shadow-[0_-8px_32px_rgba(0,0,0,0.18)] ${suppressEnterAnimation ? "" : "animate-sheet-up md:animate-slide-up"} md:!h-auto max-h-[calc(100vh-60px)] md:max-h-[92vh] flex flex-col`}
      >
        {/* Drag handle (mobile) — gestures here always control the sheet */}
        <div
          onTouchStart={onHandleTouchStart}
          className="md:hidden pt-2 pb-2 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
        >
          <span aria-hidden className="block h-1 w-10 rounded-full bg-black/20" />
        </div>

        {title ? (
          <div className="px-5 pt-2 md:pt-5 pb-3 flex items-start justify-between gap-3 border-b border-black/[0.06]">
            <div className="display text-lg leading-tight">{title}</div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="-mr-1 -mt-1 h-9 w-9 rounded-full flex items-center justify-center text-ink-secondary hover:bg-bg-secondary hover:text-ink-primary transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-blue/40"
            >
              <span className="text-xl leading-none">×</span>
            </button>
          </div>
        ) : null}

        <div
          ref={scrollRef}
          onTouchStart={onContentTouchStart}
          className="flex-1 overflow-y-auto overscroll-contain"
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
