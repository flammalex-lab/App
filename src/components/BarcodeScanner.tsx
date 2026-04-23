"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart/store";
import { useToast } from "@/components/ui/Toast";
import { money } from "@/lib/utils/format";

type ScanState =
  | { kind: "idle" }
  | { kind: "scanning" }
  | { kind: "looking_up"; code: string }
  | { kind: "hit"; product: ScannedProduct }
  | { kind: "error"; message: string; code?: string };

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

/**
 * Full-screen barcode scanner modal (Pepper-style). Uses @zxing/browser
 * for camera-based UPC/EAN detection — loaded dynamically because the
 * library is heavy and we only need it when the user taps the scanner.
 *
 * After a successful scan:
 *   - mode="cart"  → adds qty 1 to the cart and closes
 *   - mode="guide" → adds to the buyer's default guide and closes
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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [state, setState] = useState<ScanState>({ kind: "idle" });
  const [manualCode, setManualCode] = useState("");

  // Start / stop camera when the modal toggles.
  useEffect(() => {
    if (!open) {
      controlsRef.current?.stop();
      controlsRef.current = null;
      setState({ kind: "idle" });
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setState({ kind: "scanning" });
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();

        const video = videoRef.current;
        if (!video) return;

        const controls = await reader.decodeFromVideoDevice(
          undefined,
          video,
          (result, err) => {
            if (cancelled) return;
            if (result) {
              const code = result.getText();
              controls.stop();
              controlsRef.current = null;
              lookup(code);
            }
            // err is a NotFoundException on every frame with no barcode —
            // that's fine, don't log.
          },
        );
        controlsRef.current = controls;
      } catch (e: any) {
        if (cancelled) return;
        setState({
          kind: "error",
          message:
            e?.name === "NotAllowedError"
              ? "Camera permission denied. Enter the code manually below."
              : e?.message ?? "Couldn't start the camera.",
        });
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
    setState({ kind: "looking_up", code });
    const res = await fetch(`/api/products/scan?code=${encodeURIComponent(code)}`);
    if (res.ok) {
      const { product } = (await res.json()) as { product: ScannedProduct };
      setState({ kind: "hit", product });
      await handleHit(product);
    } else {
      const body = await res.json().catch(() => ({}));
      const message =
        body.reason === "not_found"
          ? `No product matches ${code}.`
          : body.reason === "out_of_scope"
          ? `${body.productName ?? "That item"} isn't in your buyer scope.`
          : body.error ?? "Lookup failed.";
      setState({ kind: "error", message, code });
    }
  }

  async function handleHit(product: ScannedProduct) {
    if (product.unitPrice == null) {
      toast.push(`${product.name} — price on request, can't add directly`, "error");
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
      toast.push(`Added ${product.name} to cart`, "success");
    } else {
      const res = await fetch("/api/my-guide/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: product.id }),
      });
      if (res.ok) {
        const body = (await res.json().catch(() => ({}))) as { alreadyExisted?: boolean };
        toast.push(
          body.alreadyExisted ? `${product.name} is already in your guide` : `Added ${product.name} to guide`,
          "success",
        );
        router.refresh();
      } else {
        toast.push("Couldn't add to guide", "error");
      }
    }
    // Brief flash then close.
    setTimeout(() => onClose(), 600);
  }

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const code = manualCode.trim();
    if (!code) return;
    setManualCode("");
    lookup(code);
  }

  function restart() {
    setState({ kind: "idle" });
    // Re-mount the effect by toggling open via onClose+reopen pattern is messy;
    // simpler: just call lookup on a fresh code, or reopen. For now, reload effect:
    setTimeout(() => {
      if (controlsRef.current) return;
      setState({ kind: "scanning" });
      (async () => {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        const video = videoRef.current;
        if (!video) return;
        const controls = await reader.decodeFromVideoDevice(undefined, video, (result) => {
          if (result) {
            const code = result.getText();
            controls.stop();
            controlsRef.current = null;
            lookup(code);
          }
        });
        controlsRef.current = controls;
      })();
    }, 100);
  }

  if (!open) return null;

  const caption =
    state.kind === "looking_up"
      ? `Looking up ${state.code}…`
      : state.kind === "hit"
      ? `Found: ${state.product.name}`
      : state.kind === "error"
      ? state.message
      : mode === "guide"
      ? "Scan an item to add it to your guide"
      : "Scan an item to add it to your cart";

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
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

      <div className="relative mx-4 rounded-2xl overflow-hidden bg-black/60 aspect-[4/5]">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
        />
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-6 border-2 border-white/60 rounded-xl" />
        </div>
        {state.kind === "hit" ? (
          <div className="absolute inset-0 bg-brand-green/60 flex items-center justify-center text-white">
            <div className="text-center px-4">
              <div className="text-4xl mb-2">✓</div>
              <div className="font-medium">{state.product.name}</div>
              {state.product.unitPrice != null ? (
                <div className="text-sm opacity-90 mt-1">
                  {money(state.product.unitPrice)} / {state.product.unit}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className="bg-white rounded-t-3xl mt-3 px-5 pt-4 pb-6 flex-1 flex flex-col items-center gap-3">
        <div className="h-1 w-10 rounded-full bg-ink-tertiary/30 -mt-2 mb-1" />
        <div className="h-12 w-12 rounded-full border-2 border-dashed border-ink-tertiary/40 flex items-center justify-center">
          <BarcodeIcon className="text-ink-secondary" />
        </div>
        <p
          className={`text-center text-sm ${
            state.kind === "error" ? "text-feedback-error" : "text-ink-secondary"
          }`}
        >
          {caption}
        </p>

        {state.kind === "error" ? (
          <button onClick={restart} className="btn-secondary text-sm">
            Try again
          </button>
        ) : null}

        <form onSubmit={submitManual} className="w-full max-w-xs mt-2 flex gap-2">
          <input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="Or type UPC / SKU"
            className="input flex-1 text-sm"
            inputMode="numeric"
          />
          <button type="submit" className="btn-primary text-sm">
            Find
          </button>
        </form>
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
