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
  const startY = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
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

  // Reset drag state every time the sheet opens
  useEffect(() => {
    if (open) setDragOffset(0);
  }, [open]);

  function onTouchStart(e: React.TouchEvent) {
    startY.current = e.touches[0].clientY;
  }
  function onTouchMove(e: React.TouchEvent) {
    if (startY.current == null) return;
    const dy = e.touches[0].clientY - startY.current;
    // Only track downward drag; clamp upward to 0 so the sheet doesn't
    // float up when the user over-pulls.
    setDragOffset(Math.max(0, dy));
  }
  function onTouchEnd() {
    // Threshold: 100px down OR > 25% of sheet height = dismiss
    const sheetH = sheetRef.current?.offsetHeight ?? 600;
    const threshold = Math.min(100, sheetH * 0.25);
    if (dragOffset > threshold) {
      onClose();
    } else {
      setDragOffset(0);
    }
    startY.current = null;
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
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined,
          transition: dragOffset > 0 ? "none" : "transform 200ms cubic-bezier(.2,.8,.2,1)",
          maxWidth: desktopMaxWidth,
        }}
        className="relative w-full bg-white rounded-t-2xl md:rounded-2xl shadow-floating animate-sheet-up md:animate-slide-up max-h-[92vh] flex flex-col"
      >
        {/* Drag handle (mobile) */}
        <div className="md:hidden pt-2 pb-1 flex items-center justify-center">
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

        <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  );
}
