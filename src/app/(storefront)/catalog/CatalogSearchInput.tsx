"use client";

import { useState } from "react";
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

/**
 * Wraps a standard <form> search input with a barcode scanner button on
 * the right edge. Kept as a client component so the scanner modal can
 * be driven by local state without converting the surrounding page.
 * The form still submits normally via GET for server-side search.
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
  const [scannerOpen, setScannerOpen] = useState(false);
  return (
    <>
      <div className="relative flex-1">
        <input
          type="search"
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
          className="input pr-12"
          list={datalistId}
          autoComplete="off"
        />
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
