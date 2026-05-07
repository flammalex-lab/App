"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart/store";
import { useToast } from "@/components/ui/Toast";
import { money } from "@/lib/utils/format";
import { productImage } from "@/lib/utils/product-image";

interface ScannedProduct {
  id: string;
  sku: string | null;
  upc: string | null;
  name: string;
  pack_size: string | null;
  unit: string;
  image_url: string | null;
  price_by_weight: boolean;
  unitPrice: number | null;
}

type BannerState =
  | { kind: "idle" }
  | { kind: "looking_up"; code: string }
  | { kind: "added"; name: string; price: number | null; unit: string }
  | { kind: "error"; message: string };

const COOLDOWN_MS = 2500;

/**
 * Full-screen barcode scanner modal (Pepper-style). Stays open between
 * scans so the buyer can scan item after item without re-launching. The
 * cart below the camera updates live so they can eyeball what they've
 * captured.
 *
 * Debounces the same code within a 2.5s window so holding a barcode in
 * frame doesn't register as 30 scans.
 */
export function BarcodeScanner({
  open,
  onClose,
  mode = "cart",
}: {
  open: boolean;
  onClose: () => void;
  mode?: "cart" | "guide";
}) {
  const router = useRouter();
  const toast = useToast();
  const add = useCart((s) => s.add);
  const setQty = useCart((s) => s.setQty);
  const lines = useCart((s) => s.lines);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const cooldownRef = useRef<{ code: string; until: number } | null>(null);
  const [banner, setBanner] = useState<BannerState>({ kind: "idle" });
  const [manualCode, setManualCode] = useState("");
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      controlsRef.current?.stop();
      controlsRef.current = null;
      setBanner({ kind: "idle" });
      setCameraError(null);
      cooldownRef.current = null;
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        const video = videoRef.current;
        if (!video) return;

        const controls = await reader.decodeFromVideoDevice(
          undefined,
          video,
          (result) => {
            if (cancelled) return;
            if (!result) return;
            const code = result.getText();
            const now = Date.now();
            if (
              cooldownRef.current &&
              cooldownRef.current.until > now &&
              cooldownRef.current.code === code
            ) {
              return;
            }
            cooldownRef.current = { code, until: now + COOLDOWN_MS };
            lookup(code);
          },
        );
        controlsRef.current = controls;
      } catch (e: any) {
        if (cancelled) return;
        setCameraError(
          e?.name === "NotAllowedError"
            ? "Camera permission denied. Enter the code manually below."
            : e?.message ?? "Couldn't start the camera.",
        );
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function lookup(code: string) {
    setBanner({ kind: "looking_up", code });
    const res = await fetch(`/api/products/scan?code=${encodeURIComponent(code)}`);
    if (res.ok) {
      const { product } = (await res.json()) as { product: ScannedProduct };
      await handleHit(product);
    } else {
      const body = await res.json().catch(() => ({}));
      const message =
        body.reason === "not_found"
          ? `No match for ${code}`
          : body.reason === "out_of_scope"
          ? `${body.productName ?? "That item"} isn't in your buyer scope`
          : body.error ?? "Lookup failed";
      setBanner({ kind: "error", message });
      setTimeout(() => setBanner({ kind: "idle" }), 2000);
    }
  }

  async function handleHit(product: ScannedProduct) {
    if (product.unitPrice == null) {
      setBanner({ kind: "error", message: `${product.name} — price on request` });
      setTimeout(() => setBanner({ kind: "idle" }), 2000);
      return;
    }
    if (mode === "cart") {
      add({
        productId: product.id,
        variantKey: null,
        variantSku: null,
        sku: product.sku,
        name: product.name,
        packSize: product.pack_size,
        unit: product.unit,
        unitPrice: product.unitPrice,
        priceByWeight: product.price_by_weight,
        quantity: 1,
      });
    } else {
      await fetch("/api/my-guide/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: product.id }),
      }).catch(() => null);
    }
    setBanner({
      kind: "added",
      name: product.name,
      price: product.unitPrice,
      unit: product.unit,
    });
    setTimeout(() => setBanner({ kind: "idle" }), 1500);
  }

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const code = manualCode.trim();
    if (!code) return;
    setManualCode("");
    lookup(code);
  }

  function reviewCart() {
    onClose();
    router.push("/cart");
  }

  if (!open) return null;

  const totalQty = lines.reduce((s, l) => s + l.quantity, 0);
  const totalMoney = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);

  return (
    <div className="fixed inset-0 z-50 bg-[#1a1a1a] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 text-white">
        <button
          onClick={onClose}
          aria-label="Close scanner"
          className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
        >
          ←
        </button>
        <div className="inline-flex items-center gap-2 bg-white text-ink-primary rounded-full px-3 py-1.5 text-sm font-medium">
          <BarcodeIcon />
          Scanner
        </div>
        <div className="h-10 w-10" />
      </div>

      {/* Camera viewport */}
      <div className="relative mx-3 rounded-2xl overflow-hidden bg-black/60 aspect-[4/3]">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
        />
        {/* Scan frame */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-6 border-2 border-white/70 rounded-xl" />
        </div>
        {/* Banner overlay */}
        {banner.kind === "added" ? (
          <div className="absolute inset-x-0 bottom-0 bg-brand-green text-white text-sm px-4 py-2.5 flex items-center justify-between animate-slide-up">
            <span className="truncate flex-1">✓ Added {banner.name}</span>
            {banner.price != null ? (
              <span className="tabular font-semibold">
                {money(banner.price)}/{banner.unit}
              </span>
            ) : null}
          </div>
        ) : null}
        {banner.kind === "error" ? (
          <div className="absolute inset-x-0 bottom-0 bg-feedback-error text-white text-sm px-4 py-2.5">
            {banner.message}
          </div>
        ) : null}
        {banner.kind === "looking_up" ? (
          <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-sm px-4 py-2.5">
            Looking up {banner.code}…
          </div>
        ) : null}
      </div>

      {/* Bottom sheet */}
      <div className="bg-white rounded-t-3xl mt-3 flex-1 flex flex-col overflow-hidden">
        <div className="h-1 w-10 rounded-full bg-ink-tertiary/30 mx-auto mt-2" />

        {cameraError ? (
          <div className="px-5 pt-3">
            <p className="text-xs text-feedback-error text-center">{cameraError}</p>
          </div>
        ) : null}

        {lines.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-5 gap-3 py-6">
            <div className="h-14 w-14 rounded-full border-2 border-dashed border-ink-tertiary/40 flex items-center justify-center">
              <BarcodeIcon className="text-ink-secondary" />
            </div>
            <p className="text-sm text-ink-secondary text-center">
              {mode === "guide"
                ? "Scan an item to add it to your guide"
                : "Scan an item to add it to your cart"}
            </p>
          </div>
        ) : (
          <>
            <div className="px-5 pt-3 pb-2 text-[13px] text-ink-secondary flex items-baseline justify-between">
              <span>
                <span className="tabular font-semibold text-ink-primary">{totalQty}</span>{" "}
                {totalQty === 1 ? "item" : "items"} in cart
              </span>
              <span className="tabular font-semibold text-ink-primary">{money(totalMoney)}</span>
            </div>
            <ul className="flex-1 overflow-y-auto divide-y divide-black/[0.06] px-2">
              {lines.map((l) => (
                <li key={`${l.productId}:${l.variantKey ?? "default"}`} className="flex items-center gap-3 py-2.5 px-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={productImage({ id: l.productId, image_url: null, name: l.name } as any)}
                    alt=""
                    className="h-12 w-12 rounded-md object-cover bg-gradient-radial-soft shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-medium truncate leading-snug">{l.name}</div>
                    <div className="text-[12px] text-ink-secondary tabular mt-0.5">
                      {money(l.unitPrice)} / {l.unit}
                    </div>
                  </div>
                  <div className="flex items-center shrink-0 rounded-full bg-bg-secondary">
                    <button
                      onClick={() => setQty(l.productId, Math.max(0, l.quantity - 1), l.variantKey)}
                      className="h-9 w-9 rounded-full flex items-center justify-center text-base hover:bg-brand-green-tint focus:outline-none focus:ring-2 focus:ring-brand-green/40 transition-colors duration-150"
                      aria-label="Remove one"
                    >
                      {l.quantity === 1 ? "🗑" : "−"}
                    </button>
                    <span className="tabular font-semibold w-5 text-center text-[13px]">{l.quantity}</span>
                    <button
                      onClick={() =>
                        add({
                          productId: l.productId,
                          variantKey: l.variantKey,
                          variantSku: l.variantSku,
                          sku: l.sku,
                          name: l.name,
                          packSize: l.packSize,
                          unit: l.unit,
                          unitPrice: l.unitPrice,
                          priceByWeight: Boolean(l.priceByWeight),
                          quantity: 1,
                        })
                      }
                      className="h-9 w-9 rounded-full bg-brand-green-dark text-white flex items-center justify-center text-base hover:bg-brand-green-dark/90 focus:outline-none focus:ring-2 focus:ring-brand-green/40 transition-colors duration-150"
                      aria-label="Add one"
                    >
                      +
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="border-t border-black/[0.06] px-4 py-3 space-y-2 pb-safe">
          <form onSubmit={submitManual} className="flex gap-2">
            <input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Type UPC / SKU"
              className="input flex-1 text-base"
              inputMode="numeric"
            />
            <button type="submit" className="btn-secondary text-sm">
              Find
            </button>
          </form>
          {lines.length > 0 ? (
            <button onClick={reviewCart} className="btn-primary w-full text-base h-12">
              Review cart · {money(totalMoney)} →
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function BarcodeIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M4 7v10M8 7v10M12 7v10M16 7v10M20 7v10" />
    </svg>
  );
}
