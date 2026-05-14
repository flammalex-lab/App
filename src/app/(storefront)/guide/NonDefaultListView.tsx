"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OrderGuide, Product } from "@/lib/supabase/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSwitcher } from "./ListSwitcher";
import { money } from "@/lib/utils/format";

export interface NonDefaultListItem {
  id: string;
  product: Product;
  unitPrice: number | null;
}

interface Props {
  activeGuide: OrderGuide;
  allGuides: OrderGuide[];
  items: NonDefaultListItem[];
}

/**
 * Lightweight view used when a buyer is browsing one of their side
 * lists (Monday prep, catering week of 3/18, etc.).
 *
 * Intentionally NOT the rich rhythm/draft surface — non-default lists
 * exist for organisation, not for the order-loop. The buyer can:
 *  - flip back to another list / the default via the switcher
 *  - remove items from this list
 *  - jump to /catalog to add more (an in-line item picker can land in a
 *    follow-up; out of scope for v1)
 *
 * The cart, submit flow, rhythm, and "in guide" badge all continue to
 * read from the buyer's DEFAULT list. This is the deliberate v1
 * contract — see CLAUDE notes for /guide.
 */
export function NonDefaultListView({ activeGuide, allGuides, items }: Props) {
  const router = useRouter();
  const [busyProductId, setBusyProductId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function handleRemove(productId: string) {
    setBusyProductId(productId);
    try {
      const res = await fetch(
        `/api/lists/${activeGuide.id}/items/${encodeURIComponent(productId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        window.alert(`Couldn't remove: ${body.error ?? res.statusText}`);
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setBusyProductId(null);
    }
  }

  return (
    <>
      <div className="pt-1 pb-2">
        <div className="flex items-center gap-2 mb-2">
          <Link
            href="/guide"
            className="text-[11px] uppercase tracking-wider text-ink-tertiary hover:text-brand-blue"
          >
            ← Back to draft
          </Link>
        </div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="display text-2xl tracking-tight leading-tight truncate">
              {activeGuide.name}
            </div>
            <p className="text-[12px] text-ink-secondary mt-0.5">
              Side list — products kept here don&apos;t auto-fill your weekly draft.
            </p>
          </div>
          <ListSwitcher guides={allGuides} activeGuideId={activeGuide.id} />
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          className="card md:mx-0"
          icon={<div className="text-5xl opacity-30">☰</div>}
          title="Nothing in this list yet"
          body="Open a product in the catalog and use the star menu to save it here. Items in side lists don't show up on the catalog 'in guide' badge."
          cta={{ href: "/catalog", label: "Browse the catalog" }}
        />
      ) : (
        <div className="card overflow-hidden divide-y divide-black/[0.04]">
          {items.map((row) => (
            <div
              key={row.id}
              className="flex items-center gap-3 px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <Link
                  href={`/catalog/${row.product.id}`}
                  className="text-[14px] text-ink-primary font-medium hover:text-brand-blue truncate block"
                >
                  {row.product.name}
                </Link>
                <div className="text-[12px] text-ink-secondary truncate">
                  {row.product.producer ?? "—"}
                  {row.product.pack_size ? ` · ${row.product.pack_size}` : ""}
                  {row.unitPrice != null ? ` · ${money(row.unitPrice)}` : ""}
                </div>
              </div>
              <button
                type="button"
                disabled={busyProductId === row.product.id || pending}
                onClick={() => handleRemove(row.product.id)}
                className="text-[12px] px-2.5 py-1 rounded-md border border-black/10 text-ink-secondary hover:text-accent-rust hover:border-accent-rust/40 disabled:opacity-40"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
