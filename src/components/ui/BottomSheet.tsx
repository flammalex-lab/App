"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
 * touch drag-to-dismiss, locks body scroll while open. On md+ it
 * morphs into a centered modal — bottom-sheet feel reads weird on
 * wide viewports.
 *
 * Pattern follows iOS sheet presentation + Material 3 modal bottom
 * sheet conventions: visible drag handle, backdrop dim, swipe-down
 * to dismiss, ESC + backdrop-click to close.
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
  // The element that was focused before the sheet opened, so we can
  // hand focus back when it closes.
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const startY = useRef<number | null>(null);
  // Source of the gesture: drag handle (always treats as sheet drag) vs
  // inner scroll area (only treats as sheet drag while inner is at top
  // and the sheet hasn't reached full).
  const dragSource = useRef<"handle" | "content" | null>(null);
  const startHeightPx = useRef<number>(0);
  const [dragOffset, setDragOffset] = useState(0);
  // `dragging` is also state so we can read it during render for the
  // transition-disable trick — reading startY.current during render
  // trips React 19's `react-hooks/refs` rule. Always set in lockstep
  // with startY.current inside the touch handlers.
  const [dragging, setDragging] = useState(false);

  // Two-detent sheet, but the user's pull is what *grows* the sheet —
  // it doesn't snap from peek to full mid-scroll. Tracked as a height
  // in px between PEEK_PX and FULL_PX so animation feels natural.
  const PEEK_VH = 0.75;
  const FULL_VH = 0.92;
  const [heightPx, setHeightPx] = useState<number | null>(null);
  // Gate the height transition until after first paint. Without this,
  // the parallel-route modal flashes/expands: the sheet first paints
  // with `height: 75vh` (heightPx === null fallback below) then the
  // render-time lastOpen sync immediately switches to `height: Npx`,
  // and even though the values are equivalent, the `transition: height
  // 220ms` fires across the change. Buyer reads it as a second open
  // animation on top of `suppressEnterAnimation`.
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setHasMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  function vh(v: number) {
    if (typeof window === "undefined") return 600 * v;
    return window.innerHeight * v;
  }

  // Lock body scroll while open WITHOUT jumping the underlying page.
  // useLayoutEffect (synced before paint) so the lock applies in the
  // same frame as the sheet rendering — otherwise iOS Safari paints
  // one frame of unlocked body, which reads as a scroll-to-top jump.
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
    // Pin the body so the visual position stays where the user left it.
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    // Flag the document synchronously so ScrollHideHeader (and any other
    // sticky bar that breaks when body is position:fixed) can swap to
    // a fixed-positioned variant via CSS — no JS race, no MutationObserver
    // microtask gap, no service-worker-cached old behavior.
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

  // ESC to close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Focus management:
  //  - capture document.activeElement on open so we can restore later
  //  - move focus into the sheet (autoFocus element wins, else first focusable)
  //  - on cleanup, restore focus to the captured element if still in DOM
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current =
      (document.activeElement instanceof HTMLElement ? document.activeElement : null);

    // Defer to a microtask so the sheet's mount animation doesn't fight
    // a synchronous focus call (some browsers scroll the focused element
    // into view mid-animation and the layout flickers).
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
        // preventScroll so closing a sheet doesn't jump the page back to
        // wherever the trigger sits in the viewport.
        prev.focus({ preventScroll: true });
      }
    };
  }, [open]);

  // Focus trap: keep Tab/Shift+Tab cycling inside the sheet root.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const root = sheetRef.current;
      if (!root) return;
      const nodes = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLES)).filter(
        (n) => !n.hasAttribute("disabled") && n.tabIndex !== -1
      );
      if (nodes.length === 0) {
        // Degenerate sheet (no focusables) — let Tab through rather than
        // creating a black-hole focus state.
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;
      // If focus has escaped the sheet entirely (browser focused something
      // behind the backdrop), pull it back in on the next Tab.
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

  // Hide page content from assistive tech while the sheet is open.
  // Refcount across sheets so a nested sheet's cleanup doesn't strip
  // aria-hidden from <main> while an outer sheet is still open.
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

  // Reset drag + height every time the sheet opens. Render-time sync
  // instead of useEffect so React 19's set-state-in-effect lint stays
  // green (no derivable source — open's transition is the trigger).
  const [lastOpen, setLastOpen] = useState(open);
  if (lastOpen !== open) {
    setLastOpen(open);
    if (open) {
      setDragOffset(0);
      setHeightPx(vh(PEEK_VH));
    }
  }

  // Drag handle: gesture always controls the sheet (grow / shrink / dismiss)
  function onHandleTouchStart(e: React.TouchEvent) {
    startY.current = e.touches[0].clientY;
    startHeightPx.current = heightPx ?? vh(PEEK_VH);
    dragSource.current = "handle";
    setDragging(true);
  }
  // Inner content: only control the sheet while content is at top and
  // user is pulling DOWN. Pulling UP while at peek lets the sheet grow.
  function onContentTouchStart(e: React.TouchEvent) {
    startY.current = e.touches[0].clientY;
    startHeightPx.current = heightPx ?? vh(PEEK_VH);
    dragSource.current = "content";
    setDragging(true);
  }

  function onTouchMove(e: React.TouchEvent) {
    if (startY.current == null || dragSource.current == null) return;
    const dy = e.touches[0].clientY - startY.current;
    const inner = scrollRef.current;
    const innerAtTop = !inner || inner.scrollTop <= 0;
    const fullPx = vh(FULL_VH);
    const peekPx = vh(PEEK_VH);

    if (dragSource.current === "handle") {
      // Handle drag: dy>0 = pull down → drag whole sheet (potentially dismiss);
      //              dy<0 = pull up → grow sheet height up to FULL.
      if (dy > 0) {
        setDragOffset(dy);
      } else {
        const next = Math.min(fullPx, Math.max(peekPx, startHeightPx.current - dy));
        setHeightPx(next);
        setDragOffset(0);
      }
      return;
    }

    // Content drag: only intercept while at the top of the inner scroll.
    if (innerAtTop) {
      if (dy < 0 && (heightPx ?? peekPx) < fullPx) {
        // Pulling up while not yet full → grow the sheet at 1:1 with finger.
        const next = Math.min(fullPx, startHeightPx.current - dy);
        setHeightPx(next);
        setDragOffset(0);
      } else if (dy > 0 && (heightPx ?? peekPx) > peekPx) {
        // Pulling down while expanded → shrink toward peek (don't dismiss yet).
        const next = Math.max(peekPx, startHeightPx.current - dy);
        setHeightPx(next);
        setDragOffset(0);
      } else if (dy > 0) {
        // Already at peek + pulling down further → drag for dismiss.
        setDragOffset(dy);
      }
    }
  }
  function onTouchEnd() {
    const peekPx = vh(PEEK_VH);
    // Dismiss if dragged the WHOLE sheet down past threshold (only the
    // dismiss gesture; height stays wherever the user released).
    if (dragOffset > 0) {
      const threshold = Math.min(100, peekPx * 0.25);
      if (dragOffset > threshold) {
        onClose();
        startY.current = null;
        dragSource.current = null;
        setDragging(false);
        return;
      }
      setDragOffset(0);
    }
    // Intentionally NO height snap — sheet stays at whatever height
    // the user released at, anywhere between peek and full. Feels
    // continuous, not detent-y.
    startY.current = null;
    dragSource.current = null;
    setDragging(false);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? (typeof title === "string" ? title : "Dialog")}
      onMouseDown={(e) => {
        // Only fire close on a backdrop mousedown (not when interacting
        // with sheet content)
        if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) onClose();
      }}
      className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center bg-black/55 animate-fade-in"
    >
      <div
        ref={sheetRef}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined,
          // No transition while the finger is on the sheet — the user's
          // drag is the source of truth. Smooth snap on release only.
          // Height transition is gated on `hasMounted` so the first paint
          // (where heightPx flips from null fallback to a resolved px
          // value) doesn't animate — that was the "modal expands on
          // first open" flash buyers reported. After mount, height
          // changes from user drag animate smoothly as before.
          transition: dragging
            ? "none"
            : hasMounted
              ? "transform 200ms cubic-bezier(.2,.8,.2,1), height 220ms cubic-bezier(.2,.8,.2,1)"
              : "transform 200ms cubic-bezier(.2,.8,.2,1)",
          maxWidth: desktopMaxWidth,
          height: heightPx != null ? `${heightPx}px` : `${PEEK_VH * 100}vh`,
        }}
        className={`relative w-full bg-white rounded-t-2xl md:rounded-2xl shadow-floating ${suppressEnterAnimation ? "" : "animate-sheet-up md:animate-slide-up"} md:!h-auto md:max-h-[92vh] flex flex-col`}
      >
        {/* Drag handle (mobile) — gestures here always control the sheet */}
        <div
          onTouchStart={onHandleTouchStart}
          className="md:hidden pt-2 pb-2 flex items-center justify-center cursor-grab active:cursor-grabbing"
        >
          <span aria-hidden className="block h-1 w-10 rounded-full bg-black/15" />
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
    </div>
  );
}
