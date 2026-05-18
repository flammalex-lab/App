"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useToast } from "@/components/ui/Toast";
import { countdown, money } from "@/lib/utils/format";
import { track } from "@/lib/analytics/track";

export interface AmendCandidate {
  productId: string;
  name: string;
  sku: string | null;
  packSize: string | null;
  unit: string;
  unitPrice: number;
  priceByWeight: boolean;
}

interface Props {
  orderId: string;
  orderNumber: string;
  cutoffAtIso: string | null;
  candidates: AmendCandidate[];
}

/**
 * Bottom-sheet (mobile) / centered modal (desktop) for appending lines to
 * an already-placed order. Buyer searches their recent-buy list, taps
 * steppers, and submits — server (POST /api/orders/[id]/amend) re-prices
 * and re-validates everything so a stale client can't sneak past gates.
 *
 * Mode is deliberately *not* "global cart" — we keep an in-memory map of
 * { productId -> qty } scoped to this sheet so the buyer's real cart
 * isn't disturbed. On success we close + refresh the page; on failure
 * we surface the server's error toast and disable the CTA on
 * cutoff-passed responses.
 */
export function AmendOrderSheet({
  orderId,
  orderNumber,
  cutoffAtIso,
  candidates,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [query, setQuery] = useState("");
  // productId -> qty. Empty / 0 means "not in the amendment."
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  // Cutoff countdown — refresh once a minute. Re-derives from cutoffAtIso
  // so a server-rendered cutoff change (page refresh) is reflected.
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, [open]);
  const cutoffMs = cutoffAtIso ? new Date(cutoffAtIso).getTime() - now : null;
  const cutoffLabel = cutoffMs != null && cutoffMs > 0 ? countdown(cutoffMs) : null;
  const cutoffPassed = cutoffMs != null && cutoffMs <= 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) => {
      return (
        c.name.toLowerCase().includes(q) ||
        (c.sku ?? "").toLowerCase().includes(q) ||
        (c.packSize ?? "").toLowerCase().includes(q)
      );
    });
  }, [query, candidates]);

  const totalUnits = Object.values(qtys).reduce((s, n) => s + (n > 0 ? n : 0), 0);
  const distinctLines = Object.values(qtys).filter((n) => n > 0).length;
  const canSubmit = distinctLines > 0 && !submitting && !disabled && !cutoffPassed;

  function bump(productId: string, delta: number) {
    setQtys((prev) => {
      const next = Math.max(0, (prev[productId] ?? 0) + delta);
      const copy = { ...prev };
      if (next === 0) delete copy[productId];
      else copy[productId] = next;
      return copy;
    });
  }

  function reset() {
    setQtys({});
    setQuery("");
  }

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    const linesPayload = candidates
      .filter((c) => (qtys[c.productId] ?? 0) > 0)
      .map((c) => ({
        productId: c.productId,
        quantity: qtys[c.productId],
        // Server re-prices; this is informational only.
        unitPrice: c.unitPrice,
        notes: null,
        variantKey: null,
        variantSku: null,
      }));

    track("amend_submitted", {
      order_id: orderId,
      line_count: linesPayload.length,
      item_count: linesPayload.reduce((n, l) => n + l.quantity, 0),
    });
    let res: Response;
    try {
      res = await fetch(`/api/orders/${orderId}/amend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: linesPayload }),
      });
    } catch {
      setSubmitting(false);
      track("amend_failed", { order_id: orderId, reason: "network" });
      toast.push("Network error — try again.", "error");
      return;
    }
    setSubmitting(false);
    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as { error?: string };
      const msg = errBody.error ?? "Couldn't add to order.";
      track("amend_failed", { order_id: orderId, status: res.status, error: msg });
      // Cutoff-passed (and order-state-changed) failures: lock the CTA so
      // the buyer can't retry into the same wall. They'll see the error
      // toast and the disabled button.
      if (/cutoff/i.test(msg) || /no longer amendable/i.test(msg)) {
        toast.push("Cutoff just passed — can't amend.", "error");
        setDisabled(true);
        setOpen(false);
      } else {
        toast.push(msg, "error");
      }
      return;
    }
    const body = (await res.json().catch(() => ({}))) as {
      addedCount?: number;
      addedUnits?: number;
    };
    const added = body.addedUnits ?? body.addedCount ?? distinctLines;
    toast.push(`Added ${added} ${added === 1 ? "item" : "items"} to ${orderNumber}.`, "success");
    reset();
    setOpen(false);
    // Server-rendered page → refresh to show the new lines + totals.
    router.refresh();
  }

  // Focus search input when the sheet opens. Without this, mobile keyboards
  // don't surface until the buyer taps — which costs them a step.
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => inputRef.current?.focus(), 220);
    return () => clearTimeout(id);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          track("amend_opened", { order_id: orderId });
          setOpen(true);
        }}
        disabled={disabled || cutoffPassed}
        className="w-full btn-primary py-3.5 text-base font-semibold disabled:opacity-50"
      >
        Add to this order
      </button>
      <p className="mt-2 text-[11px] text-center text-ink-tertiary">
        {cutoffPassed
          ? "Cutoff has passed — text your rep to add anything else."
          : cutoffLabel
            ? `Append more items — cutoff in ${cutoffLabel}.`
            : "Append more items before cutoff."}
      </p>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={
          <div className="flex flex-col">
            <span>Add to this order</span>
            <span className="block text-[11px] uppercase tracking-[0.18em] text-ink-tertiary font-normal mt-1">
              {cutoffLabel ? `Cutoff in ${cutoffLabel}` : "Before cutoff"}
            </span>
          </div>
        }
        ariaLabel={`Add items to order ${orderNumber}`}
      >
        <div className="flex h-full flex-col">
          <div className="px-4 pt-3 pb-3 border-b border-black/[0.06]">
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your recent buys"
              className="input"
              autoComplete="off"
            />
          </div>

          <ul className="flex-1 overflow-y-auto divide-y divide-black/[0.06]">
            {candidates.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-ink-secondary">
                Nothing in your recent buys yet — text your rep to add a one-off.
              </li>
            ) : filtered.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-ink-secondary">
                Nothing matches &ldquo;{query}&rdquo;.
              </li>
            ) : (
              filtered.map((c) => {
                const qty = qtys[c.productId] ?? 0;
                return (
                  <li
                    key={c.productId}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[15px] font-medium leading-snug truncate">
                        {c.name}
                      </div>
                      <div className="text-[12px] text-ink-secondary tabular mt-0.5">
                        {money(c.unitPrice)} / {c.unit}
                        {c.packSize ? (
                          <span className="text-ink-tertiary"> · {c.packSize}</span>
                        ) : null}
                        {c.priceByWeight ? (
                          <span className="ml-1 text-accent-gold">· est.</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => bump(c.productId, -1)}
                        disabled={qty === 0}
                        className="h-9 w-9 rounded-full border border-black/10 flex items-center justify-center hover:bg-bg-secondary focus:outline-none focus:ring-2 focus:ring-brand-blue/40 disabled:opacity-30 transition-colors duration-150"
                        aria-label={`Decrease ${c.name} quantity`}
                      >
                        <span className="text-base leading-none">−</span>
                      </button>
                      <div className="min-w-[44px] px-1.5 py-1.5 text-center border border-black/10 rounded-md bg-white">
                        <span className="tabular text-sm font-semibold block leading-none">
                          {qty}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => bump(c.productId, 1)}
                        className="h-9 w-9 rounded-full bg-brand-blue text-white flex items-center justify-center hover:bg-brand-blue-dark focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition-colors duration-150"
                        aria-label={`Increase ${c.name} quantity`}
                      >
                        <span className="text-base leading-none">+</span>
                      </button>
                    </div>
                  </li>
                );
              })
            )}
          </ul>

          {/* Sticky footer inside the sheet so the CTA is always reachable
              when the list is long. Brand-blue per design-system primary
              token. */}
          <div className="border-t border-black/[0.06] px-4 py-3 bg-white pb-[max(env(safe-area-inset-bottom,0px),0.75rem)]">
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="w-full btn-primary py-3 text-base font-semibold disabled:opacity-50"
            >
              {submitting
                ? "Adding…"
                : distinctLines === 0
                  ? "Add to order"
                  : `Add to order (${totalUnits} ${totalUnits === 1 ? "item" : "items"})`}
            </button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
