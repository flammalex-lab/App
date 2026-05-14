"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart/store";
import { useToast } from "@/components/ui/Toast";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Textarea } from "@/components/ui/Input";
import { money, dateLong } from "@/lib/utils/format";

interface UpcomingDelivery {
  date: string;
  dayName: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pre-formatted "Submit Friday's order" title fragment (e.g. "Friday").
   *  Derived from the selected delivery date by the parent. */
  deliveryDayName: string | null;
  /** Account minimum from the storefront layout. 0 = no minimum. */
  accountMinimum: number;
  deliveryFee: number;
  /** Already past cutoff for the selected date? — disables submit. */
  pastCutoff: boolean;
  /** Days the buyer may switch to without leaving the sheet. The default
   *  delivery is the first item. Pass an empty array to hide the switcher. */
  upcomingDeliveries: UpcomingDelivery[];
}

const ORDER_NOTE_MAX = 500;

/**
 * Bottom-sheet submit flow that replaces the /cart → /cart/review route
 * change for repeat buyers. Tapping the StickyCartBar pill opens this;
 * buyer stays on /guide until submit. Post-submit routes to the existing
 * /orders/[id]?placed=1 confirmation hero.
 *
 * Submit button is brand-green — the ONLY place green appears in this
 * surface. Everywhere else is brand-blue per the design system.
 */
export function SubmitSheet({
  open,
  onClose,
  deliveryDayName,
  accountMinimum,
  deliveryFee,
  pastCutoff,
  upcomingDeliveries,
}: Props) {
  const router = useRouter();
  const toast = useToast();

  const lines = useCart((s) => s.lines);
  const deliveryDate = useCart((s) => s.deliveryDate);
  const setDeliveryDate = useCart((s) => s.setDeliveryDate);
  const orderNote = useCart((s) => s.orderNote);
  const setOrderNote = useCart((s) => s.setOrderNote);
  const clear = useCart((s) => s.clear);

  const [placing, setPlacing] = useState(false);
  const [itemsExpanded, setItemsExpanded] = useState(false);
  const [editingDate, setEditingDate] = useState(false);

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0),
    [lines],
  );
  const effectiveDeliveryFee = subtotal > 0 ? deliveryFee : 0;
  const total = subtotal + effectiveDeliveryFee;
  const underMinimum =
    accountMinimum > 0 && subtotal + effectiveDeliveryFee < accountMinimum;
  const totalUnits = lines.reduce((n, l) => n + l.quantity, 0);

  const selectedDate = deliveryDate ?? upcomingDeliveries[0]?.date ?? null;
  const altDeliveries = upcomingDeliveries.filter((u) => u.date !== selectedDate).slice(0, 4);
  // B1/B10: the selected date is "stale" when it's missing from the
  // server's fresh upcoming-delivery list. That means the cutoff for
  // that day already rolled. The first item in `upcomingDeliveries` is
  // the next valid date — use that for the inline fallback CTA.
  const selectedDateIsStale = Boolean(
    selectedDate &&
      upcomingDeliveries.length > 0 &&
      !upcomingDeliveries.some((u) => u.date === selectedDate),
  );
  const dateGated = pastCutoff || selectedDateIsStale;
  const firstFreshDelivery = upcomingDeliveries[0] ?? null;

  async function submit() {
    if (lines.length === 0 || underMinimum || dateGated) return;
    if (!selectedDate) {
      toast.push("Pick a delivery date first.", "error");
      return;
    }
    setPlacing(true);
    const res = await fetch("/api/orders/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderType: "b2b",
        paymentMethod: "invoice",
        requestedDeliveryDate: selectedDate,
        pickupDate: null,
        pickupLocationId: null,
        customerNotes: orderNote,
        lines: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          notes: l.notes ?? null,
          variantKey: l.variantKey ?? null,
          variantSku: l.variantSku ?? null,
        })),
      }),
    });
    setPlacing(false);
    if (!res.ok) {
      toast.push((await res.json()).error ?? "Order failed", "error");
      return;
    }
    const { orderId } = await res.json();
    clear();
    router.push(`/orders/${orderId}?placed=1`);
  }

  const titleDay = deliveryDayName ?? "your";
  const minShortfall = Math.max(0, accountMinimum - (subtotal + effectiveDeliveryFee));

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={`Submit ${titleDay}'s order`}
    >
      <div className="px-5 pt-4 pb-6 space-y-5">
        {/* ---- Delivery row -------------------------------------------- */}
        <section>
          <div className="text-[11px] uppercase tracking-wide text-ink-tertiary font-medium mb-1.5">
            Delivery
          </div>
          {editingDate && altDeliveries.length > 0 ? (
            <div className="space-y-1.5">
              {[{ date: selectedDate, dayName: deliveryDayName ?? "" } as UpcomingDelivery, ...altDeliveries]
                .filter((u) => Boolean(u.date))
                .map((u) => {
                  const isCurrent = u.date === selectedDate;
                  return (
                    <button
                      key={u.date as string}
                      type="button"
                      onClick={() => {
                        setDeliveryDate(u.date as string);
                        setEditingDate(false);
                      }}
                      className={`w-full text-left rounded-lg border px-3 py-2 text-[14px] transition-colors duration-150 ${
                        isCurrent
                          ? "border-brand-blue bg-brand-blue-tint text-brand-blue-dark font-medium"
                          : "border-black/10 hover:border-brand-blue/40 hover:bg-brand-blue-tint/40"
                      }`}
                    >
                      <span className="tabular">{dateLong(u.date as string)}</span>
                    </button>
                  );
                })}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="text-[15px] font-medium tabular">
                {selectedDate ? dateLong(selectedDate) : "Pick a date"}
              </div>
              {altDeliveries.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setEditingDate(true)}
                  className="text-[12px] text-brand-blue underline-offset-2 hover:underline"
                >
                  Switch to {altDeliveries[0].dayName.slice(0, 3)} {formatShortDate(altDeliveries[0].date)}
                </button>
              ) : null}
            </div>
          )}
        </section>

        {/* ---- Line summary -------------------------------------------- */}
        <section className="border-t border-black/[0.06] pt-4">
          <button
            type="button"
            onClick={() => setItemsExpanded((o) => !o)}
            className="w-full flex items-center justify-between text-left"
          >
            <span className="text-[14px] text-ink-secondary">
              <span className="font-medium text-ink-primary tabular">{lines.length}</span>{" "}
              {lines.length === 1 ? "line" : "lines"}
              <span className="text-ink-tertiary"> · {totalUnits} {totalUnits === 1 ? "unit" : "units"}</span>
            </span>
            <span className="text-[12px] text-brand-blue underline-offset-2 hover:underline">
              {itemsExpanded ? "Collapse" : "Expand"}
            </span>
          </button>
          {itemsExpanded ? (
            <ul className="mt-3 space-y-1.5 max-h-72 overflow-y-auto">
              {lines.map((l) => (
                <li
                  key={`${l.productId}:${l.variantKey ?? ""}`}
                  className="flex items-center gap-3 text-[13px]"
                >
                  <span className="tabular text-ink-secondary w-8 shrink-0 text-right">
                    {l.quantity}
                  </span>
                  <span className="flex-1 min-w-0 truncate">{l.name}</span>
                  <span className="tabular text-ink-tertiary shrink-0">
                    {money(l.unitPrice * l.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        {/* ---- Order note ---------------------------------------------- */}
        <section className="border-t border-black/[0.06] pt-4">
          <div className="text-[11px] uppercase tracking-wide text-ink-tertiary font-medium mb-1.5">
            Note
          </div>
          <Textarea
            value={orderNote}
            onChange={(e) => setOrderNote(e.target.value.slice(0, ORDER_NOTE_MAX))}
            placeholder="Anything for Alex?"
            rows={2}
            className="text-[14px]"
          />
        </section>

        {/* ---- Totals -------------------------------------------------- */}
        <section className="border-t border-black/[0.06] pt-4 space-y-1 text-[14px]">
          <Row label="Subtotal" value={money(subtotal)} />
          {effectiveDeliveryFee > 0 ? (
            <Row label="Delivery fee" value={money(effectiveDeliveryFee)} />
          ) : null}
          {accountMinimum > 0 ? (
            <Row
              label="Minimum"
              value={money(accountMinimum)}
              tone={underMinimum ? "warn" : "muted"}
            />
          ) : null}
          <div className="border-t border-dashed border-black/15 my-2" />
          <Row label="Total" value={money(total)} strong />
        </section>

        {underMinimum ? (
          <p className="text-[12px] text-accent-gold/90 leading-snug">
            {money(minShortfall)} to your {money(accountMinimum)} minimum.
          </p>
        ) : null}

        {/* B10: when the submit gate is the date (not the minimum or
            empty lines), call it out inline so the muted button has a
            visible reason. Without this, the only hint the buyer has
            is the "Switch to..." link buried in the delivery row. */}
        {dateGated && !underMinimum && lines.length > 0 ? (
          <p className="text-[12px] text-accent-rust leading-snug">
            Date is past cutoff
            {firstFreshDelivery
              ? (
                <>
                  {" — "}
                  <button
                    type="button"
                    onClick={() => setDeliveryDate(firstFreshDelivery.date)}
                    className="underline underline-offset-2 font-medium hover:text-accent-rust/80"
                  >
                    switch to {firstFreshDelivery.dayName.slice(0, 3)} {formatShortDate(firstFreshDelivery.date)}
                  </button>{" "}
                  to submit.
                </>
              )
              : "."}
          </p>
        ) : null}

        {/* ---- Submit -------------------------------------------------- */}
        {/* Brand-green is the commit moment — the ONLY place it appears in
            the repeat-buyer order loop. Inline classes instead of Button's
            variant prop because Button doesn't expose a "success" variant
            and we don't want to expand the API for a one-off. */}
        <button
          type="button"
          onClick={submit}
          disabled={lines.length === 0 || underMinimum || dateGated || placing}
          className="btn w-full bg-brand-green text-white hover:bg-brand-green-dark active:scale-[0.99] focus:ring-2 focus:ring-brand-green/40 px-5 py-3 text-base"
        >
          {placing
            ? "Placing order"
            : dateGated && lines.length > 0 && !underMinimum
              ? "Pick a valid delivery date"
              : "Submit order"}
          {!placing && !(dateGated && lines.length > 0 && !underMinimum) ? <span aria-hidden>→</span> : null}
        </button>
        <p className="text-[12px] text-ink-tertiary text-center -mt-1">
          You can amend until cutoff — just open the order.
        </p>
      </div>
    </BottomSheet>
  );
}

function Row({
  label,
  value,
  strong,
  tone = "default",
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "default" | "muted" | "warn";
}) {
  const labelTone =
    tone === "warn"
      ? "text-accent-gold/90"
      : tone === "muted"
        ? "text-ink-tertiary"
        : "text-ink-secondary";
  return (
    <div className={`flex justify-between ${strong ? "font-semibold text-base pt-1" : ""}`}>
      <span className={strong ? "" : labelTone}>{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}

function formatShortDate(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return d;
  return `${Number(m[2])}/${Number(m[3])}`;
}
