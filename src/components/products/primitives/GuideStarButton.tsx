"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
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
  const [inGuide, setInGuide] = useState(initialInGuide);
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
    setInGuide(!wasIn);
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
        setInGuide(wasIn);
        return;
      }
    } catch {
      toast.push(wasIn ? "Failed to remove from guide" : "Failed to add to guide", "error");
      setInGuide(wasIn);
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
