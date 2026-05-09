"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/supabase/types";
import { useCart } from "@/lib/cart/store";
import { money } from "@/lib/utils/format";
import { useToast } from "@/components/ui/Toast";
import type { PackRow } from "./packs";

export type { PackRow } from "./packs";

export function ProductDetailClient({
  product,
  packs,
  showAddToGuide,
  inGuideInitial,
}: {
  product: Product;
  packs: PackRow[];
  showAddToGuide: boolean;
  inGuideInitial: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const add = useCart((s) => s.add);
  const setQty = useCart((s) => s.setQty);
  const lines = useCart((s) => s.lines);
  const [guideState, setGuideState] = useState<"idle" | "saving" | "saved">(
    inGuideInitial ? "saved" : "idle",
  );

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

  async function star() {
    if (guideState !== "idle") return;
    setGuideState("saving");
    const res = await fetch("/api/my-guide/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: product.id }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Failed to add to guide" }));
      toast.push(err.error ?? "Failed to add to guide", "error");
      setGuideState("idle");
      return;
    }
    const body = (await res.json().catch(() => ({}))) as { alreadyExisted?: boolean };
    setGuideState("saved");
    toast.push(body.alreadyExisted ? "Already in your guide" : "Added to your guide", "success");
    // Refresh the underlying page so /guide reflects the new item when the
    // modal closes.
    router.refresh();
  }

  const saved = guideState === "saved";

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
                  onClick={star}
                  aria-label={saved ? "Added to your guide" : "Add to your guide"}
                  className={`h-7 w-7 shrink-0 inline-flex items-center justify-center transition ${
                    saved ? "text-accent-gold" : "text-ink-tertiary hover:text-accent-gold"
                  }`}
                  disabled={guideState === "saving"}
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
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => sub(p)}
                    className="h-8 w-8 rounded-full border border-black/10 flex items-center justify-center text-sm hover:bg-bg-secondary"
                    aria-label={qty === 1 ? "Remove from cart" : "Remove one"}
                  >
                    {qty === 1 ? <TrashIcon /> : "−"}
                  </button>
                  <span className="mono font-semibold w-6 text-center text-sm">{qty}</span>
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
        onClick={() => router.push("/cart")}
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

