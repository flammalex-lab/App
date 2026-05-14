"use client";

import { useEffect, useLayoutEffect } from "react";

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Mount-time body scroll-lock. Use when a sheet/modal layout needs to
 * keep the underlying page from scrolling while it's open, but the host
 * is a Server Component (e.g. an App Router `loading.tsx` skeleton)
 * that can't run its own `useLayoutEffect`.
 *
 * Mechanism mirrors the BottomSheet body-lock at
 * `src/components/ui/BottomSheet.tsx` — pin the body with
 * `position: fixed; top: -<scrollY>` so the page can't scroll while
 * preserving the visual scroll position; restore on unmount.
 *
 * Concrete regression this addresses: a Playwright trace on
 * production caught that tapping a catalog card surfaced the modal's
 * `loading.tsx` skeleton at t≈7ms, but body-lock didn't fire until the
 * real BottomSheet swap-in at t≈800ms (mobile) / t≈475ms (web). For
 * that ~half-second the catalog underneath stayed scrollable, and the
 * subsequent body-lock + scroll-restore-to-pinned-position registered
 * to the buyer as a "thunk" jump. Locking from the moment the skeleton
 * mounts collapses three simultaneous state changes into one and makes
 * the open feel instant.
 *
 * Sequence when both this and BottomSheet's own lock run back-to-back
 * (skeleton → real sheet swap): cleanup unlocks + restores scroll →
 * BottomSheet re-locks at the same scrollY → both pin to the same px
 * offset. Both effects run in the same commit phase without a paint
 * in between, so no flicker.
 *
 * Use `BottomSheet` directly when you control the open state in a
 * Client Component; reach for `<BodyScrollLock />` when you only need
 * the lock side-effect (e.g. inside a Server Component skeleton).
 */
export function BodyScrollLock() {
  useIsoLayoutEffect(() => {
    if (typeof window === "undefined") return;
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
  }, []);
  return null;
}
