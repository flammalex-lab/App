"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/supabase/types";
import { useCart } from "@/lib/cart/store";
import { money } from "@/lib/utils/format";
import { useToast } from "@/components/ui/Toast";
import { QtyInput } from "@/components/ui/QtyInput";
import type { PackRow } from "./packs";

export type { PackRow } from "./packs";

export function ProductDetailClient({
  product,
  packs,
  showAddToGuide,
  inGuideInitial,
  onClose,
}: {
  product: Product;
  packs: PackRow[];
  showAddToGuide: boolean;
  inGuideInitial: boolean;
  /** Modal-only — close the sheet when navigating to /cart so the
   *  overlay doesn't stick around behind the cart page. */
  onClose?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const add = useCart((s) => s.add);
  const setQty = useCart((s) => s.setQty);
  const lines = useCart((s) => s.lines);
  // Optimistic toggle: flip immediately on click, snap back on error.
  // `saving` blocks double-fires while the request is in flight; both
  // directions (add + remove) are reachable from any state.
  const [inGuide, setInGuide] = useState<boolean>(inGuideInitial);
  const [saving, setSaving] = useState<boolean>(false);

  function qtyFor(p: PackRow): number {
    return lines.find(
      (l) => l.productId === p.productId && (l.variantKey ?? null) === p.variantKey,
    )?.quantity ?? 0;
  }

  function addOne(p: PackRow) {
    add({
      productId: p.productId,
      variantKey: p.variantKey,
      variantSku: p.variantKey ? p.sku : null,
      sku: p.sku,
      name: p.productName,
      packSize: p.packSize,
      unit: p.unit,
      unitPrice: p.unitPrice,
      priceByWeight: p.priceByWeight,
      quantity: 1,
    });
  }
  function sub(p: PackRow) {
    setQty(p.productId, Math.max(0, qtyFor(p) - 1), p.variantKey);
  }
  function setDirectQty(p: PackRow, n: number) {
    if (n === 0) {
      setQty(p.productId, 0, p.variantKey);
      return;
    }
    if (qtyFor(p) === 0) {
      add({
        productId: p.productId,
        variantKey: p.variantKey,
        variantSku: p.variantKey ? p.sku : null,
        sku: p.sku,
        name: p.productName,
        packSize: p.packSize,
        unit: p.unit,
        unitPrice: p.unitPrice,
        priceByWeight: p.priceByWeight,
        quantity: n,
      });
    } else {
      setQty(p.productId, n, p.variantKey);
    }
  }

  async function toggleGuide() {
    if (saving) return;
    const wasIn = inGuide;
    // Optimistic flip.
    setInGuide(!wasIn);
    setSaving(true);
    const endpoint = wasIn ? "/api/my-guide/remove" : "/api/my-guide/add";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: product.id }),
      });
      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: wasIn ? "Failed to remove from guide" : "Failed to add to guide" }));
        toast.push(
          err.error ?? (wasIn ? "Failed to remove from guide" : "Failed to add to guide"),
          "error",
        );
        // Snap back on failure so the UI matches server truth.
        setInGuide(wasIn);
        return;
      }
      // Refresh underlying page so /guide reflects the change when the
      // modal closes (the catalog rail uses this list to render badges).
      router.refresh();
    } catch {
      toast.push(
        wasIn ? "Failed to remove from guide" : "Failed to add to guide",
        "error",
      );
      setInGuide(wasIn);
    } finally {
      setSaving(false);
    }
  }

  const saved = inGuide;

  return (
    <div className="mt-5 space-y-3">
      <ul className="card divide-y divide-black/5 overflow-hidden">
        {packs.map((p) => {
          const qty = qtyFor(p);
          return (
            <li
              key={`${p.productId}:${p.variantKey ?? "default"}`}
              className="p-3 flex items-center gap-3"
            >
              {showAddToGuide && p.productId === product.id ? (
                <button
                  onClick={toggleGuide}
                  aria-label={saved ? "Remove from your guide" : "Add to your guide"}
                  aria-pressed={saved}
                  className={`h-7 w-7 shrink-0 inline-flex items-center justify-center transition ${
                    saved ? "text-accent-gold" : "text-ink-tertiary hover:text-accent-gold"
                  }`}
                  disabled={saving}
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                    <path d="M12 2l3 7h7l-5.7 4.3L18 21l-6-4-6 4 1.7-7.7L2 9h7l3-7z" />
                  </svg>
                </button>
              ) : (
                <div className="h-7 w-7 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{p.label}</div>
                <div className="text-xs text-ink-secondary mono">
                  {p.sku ? `${p.sku} · ` : ""}
                  {money(p.unitPrice)}
                  <span className="text-ink-tertiary"> / {p.unit}</span>
                  {p.priceByWeight ? (
                    <span className="ml-1 text-accent-gold">· est.</span>
                  ) : null}
                </div>
              </div>
              {qty > 0 ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => sub(p)}
                    className="h-8 w-8 rounded-full border border-black/10 flex items-center justify-center text-sm hover:bg-bg-secondary"
                    aria-label={qty === 1 ? "Remove from cart" : "Remove one"}
                  >
                    {qty === 1 ? <TrashIcon /> : "−"}
                  </button>
                  <QtyInput
                    value={qty}
                    onSet={(n) => setDirectQty(p, n)}
                    className="h-8 w-12 text-center tabular text-sm font-semibold rounded-md border border-black/15 bg-white text-ink-primary focus:outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/30 transition-colors duration-150"
                  />
                  <button
                    onClick={() => addOne(p)}
                    className="h-8 w-8 rounded-full bg-brand-green text-white flex items-center justify-center hover:bg-brand-green-dark transition"
                    aria-label="Add one"
                  >
                    +
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => addOne(p)}
                  className="h-9 w-9 rounded-full bg-brand-green text-white text-lg flex items-center justify-center hover:bg-brand-green-dark transition shrink-0"
                  aria-label="Add to cart"
                >
                  +
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {packs.some((p) => p.priceByWeight) ? (
        <p className="text-xs text-ink-tertiary px-1">
          Weight-priced — final line total is confirmed by the distributor at fulfillment.
        </p>
      ) : null}

      <button
        onClick={() => {
          // Close the overlay first so we don't leave it sitting on top
          // of the cart page after navigation. Modal close is a no-op on
          // the full /catalog/[id] page (onClose undefined there).
          onClose?.();
          router.push("/cart");
        }}
        className="btn-ghost text-sm w-full"
      >
        Go to cart →
      </button>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

