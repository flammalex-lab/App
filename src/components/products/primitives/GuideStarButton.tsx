"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { useGuideMemberships } from "@/lib/products/guide-memberships-store";
import { track } from "@/lib/analytics/track";
import { haptic } from "./haptic";

/**
 * Tappable star that toggles a product in / out of the buyer's order
 * guide. B2B-only — callers gate rendering on `isB2B` since DTC buyers
 * don't have an order guide concept.
 *
 * Optimistic update + snap-back on server error, matching the toggle
 * behaviour in `ProductDetailClient` (the same surface in the PDP
 * sheet). Hits the same `/api/my-guide/{add,remove}` endpoints — the
 * routes derive the active buyer's default list server-side, so the
 * client just sends a product id.
 *
 * State source-of-truth: the shared `useGuideMemberships` store. The
 * `initialInGuide` prop seeds the value on first render for products
 * the store hasn't seen — once the buyer toggles a star anywhere
 * (card, PDP modal), every other surface for that product reflects
 * the new value immediately because they all read from the same store.
 *
 * Rendered as a 36px circular button so it's a comfortable touch
 * target without dominating the card's price row.
 */
export function GuideStarButton({
  productId,
  initialInGuide,
  disabled = false,
}: {
  productId: string;
  initialInGuide: boolean;
  disabled?: boolean;
}) {
  // Read live state from the shared store; fall back to the
  // server-supplied initial value only when the store hasn't seen
  // this productId yet. This keeps SSR-rendered correctness for
  // products that have never been toggled in the current session.
  const storeKnows = useGuideMemberships((s) => productId in s.byProduct);
  const storeValue = useGuideMemberships((s) => s.byProduct[productId]);
  const inGuide = storeKnows ? storeValue : initialInGuide;

  const writeMembership = useGuideMemberships((s) => s.set);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  async function toggle(e: React.MouseEvent) {
    // The card's underlying tap target (sheet-open button) sits behind
    // most of the card; the star is inside that hit area so we need to
    // stop propagation so a tap on the star doesn't also open the
    // detail sheet.
    e.stopPropagation();
    e.preventDefault();
    if (saving || disabled) return;
    const wasIn = inGuide;
    track(wasIn ? "guide_unstarred" : "guide_starred", { product_id: productId });
    // Optimistic flip — write through the store so every other surface
    // for this product (cards, PDP modal) updates instantly.
    writeMembership(productId, !wasIn);
    setSaving(true);
    haptic(6);
    const endpoint = wasIn ? "/api/my-guide/remove" : "/api/my-guide/add";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.push(
          err.error ?? (wasIn ? "Failed to remove from guide" : "Failed to add to guide"),
          "error",
        );
        writeMembership(productId, wasIn);
        return;
      }
    } catch {
      toast.push(wasIn ? "Failed to remove from guide" : "Failed to add to guide", "error");
      writeMembership(productId, wasIn);
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={saving || disabled}
      aria-label={inGuide ? "Remove from your guide" : "Add to your guide"}
      aria-pressed={inGuide}
      className={`relative shrink-0 h-9 w-9 inline-flex items-center justify-center rounded-full border transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 ${
        inGuide
          ? "bg-white border-accent-gold/40 text-accent-gold hover:bg-accent-gold/10"
          : "bg-white border-black/10 text-ink-tertiary hover:border-black/20 hover:text-accent-gold"
      } ${saving ? "opacity-60" : ""}`}
    >
      <StarIcon filled={inGuide} />
    </button>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 12 12"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.4}
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 .5l1.6 3.7 4 .4-3 2.8.9 4-3.5-2.1-3.5 2.1.9-4-3-2.8 4-.4z" />
    </svg>
  );
}
