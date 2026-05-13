"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";

// The BarcodeScanner component pulls in @zxing/browser + @zxing/library
// (~150KB minified) plus a 370-line camera-modal UI that's only relevant
// when the user taps the scan button. Loading it on every catalog render
// inflated first-load JS. next/dynamic with ssr:false keeps the camera
// API client-side only, and the existing `if (!open) return null` inside
// the component makes the closed-state render a no-op while the chunk
// downloads on first open.
const BarcodeScanner = dynamic(
  () => import("@/components/BarcodeScanner").then((m) => m.BarcodeScanner),
  { ssr: false },
);

const DEBOUNCE_MS = 250;

/**
 * Live, debounced catalog search input. Typing updates the `q` query
 * param on the current URL after `DEBOUNCE_MS`, so the server re-renders
 * results without a page reload. The form action= fallback still works
 * for Enter-to-submit (and progressive enhancement for no-JS).
 *
 * URL semantics:
 *   - typing → router.replace (no scroll jump, no extra history entry)
 *   - Enter  → normal form submit (kept for keyboard parity)
 *   - any other current search params (group, producer, sort) are
 *     preserved across both paths.
 *
 * UX cues:
 *   - `useTransition` keeps the previous results visible while the new
 *     ones stream in; we dim the input border + show a tiny spinner in
 *     the right slot so the buyer knows something's happening without
 *     the page going blank.
 *   - The active-search "x" clear maps to the native input type=search
 *     clear button + we also clear our local state when value goes
 *     empty so the URL drops `q` cleanly.
 */
export function CatalogSearchInput({
  name = "q",
  defaultValue = "",
  placeholder = "Search products or farms…",
  datalistId,
}: {
  name?: string;
  defaultValue?: string;
  placeholder?: string;
  datalistId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(defaultValue);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  // Skip the URL-sync effect on initial mount — the server already
  // rendered with the URL's current `q`. We only want to push when the
  // *buyer* changes the value.
  const didMount = useRef(false);

  // If the URL's `q` changed without going through this input (back/
  // forward button, producer-chip click, navigating from another page),
  // mirror it into local state so the debounce effect doesn't push the
  // stale typed value back onto the URL.
  useEffect(() => {
    const urlQ = searchParams?.get("q") ?? "";
    if (urlQ !== value) setValue(urlQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    const urlQ = searchParams?.get("q") ?? "";
    const trimmed = value.trim();
    // Local state already matches the URL — nothing to push (this also
    // catches the sync-effect path above, avoiding a double-replace).
    if (urlQ === trimmed) return;
    const handle = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      if (trimmed) params.set("q", trimmed);
      else params.delete("q");
      const qs = params.toString();
      const target = qs ? `${pathname}?${qs}` : pathname;
      startTransition(() => router.replace(target, { scroll: false }));
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
    // searchParams / pathname are read inside but we don't depend on
    // them — pushing only happens when the typed value changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <>
      <div className="relative flex-1">
        <input
          type="search"
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className={`input pr-20 transition-shadow ${
            isPending ? "ring-1 ring-brand-blue/30" : ""
          }`}
          list={datalistId}
          autoComplete="off"
        />
        {isPending ? (
          <span
            aria-hidden
            className="absolute right-12 top-1/2 -translate-y-1/2 h-3 w-3 rounded-full border-2 border-brand-blue/30 border-t-brand-blue animate-spin"
          />
        ) : null}
        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          aria-label="Scan a barcode"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 inline-flex items-center justify-center rounded-md text-ink-secondary hover:text-ink-primary hover:bg-bg-secondary transition"
        >
          <ScanIcon />
        </button>
      </div>
      <BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)} mode="cart" />
    </>
  );
}

function ScanIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7V5a1 1 0 0 1 1-1h2" />
      <path d="M17 4h2a1 1 0 0 1 1 1v2" />
      <path d="M20 17v2a1 1 0 0 1-1 1h-2" />
      <path d="M7 20H5a1 1 0 0 1-1-1v-2" />
      <path d="M7 9v6M11 9v6M15 9v6" />
    </svg>
  );
}
