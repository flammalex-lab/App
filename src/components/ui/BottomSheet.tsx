"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

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
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  ariaLabel?: string;
  children: ReactNode;
  desktopMaxWidth?: string;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);
  // Source of the gesture: drag handle (always treats as sheet drag) vs
  // inner scroll area (only treats as sheet drag while inner is at top
  // and the sheet hasn't reached full).
  const dragSource = useRef<"handle" | "content" | null>(null);
  const startHeightPx = useRef<number>(0);
  const [dragOffset, setDragOffset] = useState(0);

  // Two-detent sheet, but the user's pull is what *grows* the sheet —
  // it doesn't snap from peek to full mid-scroll. Tracked as a height
  // in px between PEEK_PX and FULL_PX so animation feels natural.
  const PEEK_VH = 0.75;
  const FULL_VH = 0.92;
  const [heightPx, setHeightPx] = useState<number | null>(null);

  function vh(v: number) {
    if (typeof window === "undefined") return 600 * v;
    return window.innerHeight * v;
  }

  // Lock body scroll while open WITHOUT jumping the underlying page.
  // The naive approach (overflow: hidden on body) makes iOS Safari
  // reset scrollTop to 0 and bounce back when restored — feels jumpy.
  // Instead, capture the current scroll, pin the body via fixed
  // positioning at top:-Y, then restore both on unlock.
  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    const body = document.body;
    const prevPosition = body.style.position;
    const prevTop = body.style.top;
    const prevWidth = body.style.width;
    const prevOverflow = body.style.overflow;
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    return () => {
      body.style.position = prevPosition;
      body.style.top = prevTop;
      body.style.width = prevWidth;
      body.style.overflow = prevOverflow;
      // Restore exact scrollY using auto behavior so there's no
      // perceptible scroll animation.
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

  // Reset drag + height every time the sheet opens
  useEffect(() => {
    if (open) {
      setDragOffset(0);
      setHeightPx(vh(PEEK_VH));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Drag handle: gesture always controls the sheet (grow / shrink / dismiss)
  function onHandleTouchStart(e: React.TouchEvent) {
    startY.current = e.touches[0].clientY;
    startHeightPx.current = heightPx ?? vh(PEEK_VH);
    dragSource.current = "handle";
  }
  // Inner content: only control the sheet while content is at top and
  // user is pulling DOWN. Pulling UP while at peek lets the sheet grow.
  function onContentTouchStart(e: React.TouchEvent) {
    startY.current = e.touches[0].clientY;
    startHeightPx.current = heightPx ?? vh(PEEK_VH);
    dragSource.current = "content";
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
    const fullPx = vh(FULL_VH);
    const peekPx = vh(PEEK_VH);
    // Dismiss if dragged the WHOLE sheet down past threshold
    if (dragOffset > 0) {
      const threshold = Math.min(100, peekPx * 0.25);
      if (dragOffset > threshold) {
        onClose();
        startY.current = null;
        dragSource.current = null;
        return;
      }
      setDragOffset(0);
    }
    // Snap height to the nearest detent
    if (heightPx != null) {
      const mid = (peekPx + fullPx) / 2;
      setHeightPx(heightPx >= mid ? fullPx : peekPx);
    }
    startY.current = null;
    dragSource.current = null;
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
          transition:
            startY.current !== null
              ? "none"
              : "transform 200ms cubic-bezier(.2,.8,.2,1), height 220ms cubic-bezier(.2,.8,.2,1)",
          maxWidth: desktopMaxWidth,
          height: heightPx != null ? `${heightPx}px` : `${PEEK_VH * 100}vh`,
        }}
        className="relative w-full bg-white rounded-t-2xl md:rounded-2xl shadow-floating animate-sheet-up md:animate-slide-up md:!h-auto md:max-h-[92vh] flex flex-col"
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
