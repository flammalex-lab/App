"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart/store";
import { useToast } from "@/components/ui/Toast";
import { Sheet } from "@/components/ui/Sheet";
import { LineItem } from "@/components/products/LineItem";
import { Textarea } from "@/components/ui/Input";
import { money, dateLong } from "@/lib/utils/format";
import { isDeliveryDateStale } from "@/lib/utils/delivery-date";
import { track } from "@/lib/analytics/track";

interface UpcomingDelivery {
  date: string;
  dayName: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  deliveryDayName: string | null;
  accountMinimum: number;
  deliveryFee: number;
  pastCutoff: boolean;
  upcomingDeliveries: UpcomingDelivery[];
}

const ORDER_NOTE_MAX = 500;

/**
 * Unified cart sheet — replaces the old /cart route + /cart/review route
 * + SubmitSheet trio on mobile. One floating sheet handles BOTH cart
 * editing (qty +/- / remove) AND commit (Place Order) in one place.
 *
 * Built on the new Sheet primitive (composite-P gesture). Renders the
 * cart contents in editable mode using the same `LineItem` component
 * the /cart route uses, so the qty stepper + swipe-to-remove behavior
 * is identical to the desktop full-page experience.
 *
 * On submit, the sheet animates closed and the route pushes to
 * /orders/[id]?placed=1. The order-placed hero handles the celebration
 * beat.
 *
 * Desktop /cart and /cart/review routes are preserved as fallbacks —
 * this sheet is only mounted on mobile via GlobalSubmitSheet.
 */
export function CartSheet({
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
  const setQty = useCart((s) => s.setQty);
  const deliveryDate = useCart((s) => s.deliveryDate);
  const setDeliveryDate = useCart((s) => s.setDeliveryDate);
  const orderNote = useCart((s) => s.orderNote);
  const setOrderNote = useCart((s) => s.setOrderNote);
  const clear = useCart((s) => s.clear);

  const [placing, setPlacing] = useState(false);
  const [editingDate, setEditingDate] = useState(false);

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0),
    [lines],
  );
  const effectiveDeliveryFee = subtotal > 0 ? deliveryFee : 0;
  const total = subtotal + effectiveDeliveryFee;
  const underMinimum = accountMinimum > 0 && total < accountMinimum;

  const selectedDate = deliveryDate ?? upcomingDeliveries[0]?.date ?? null;
  const sortedUpcoming = [...upcomingDeliveries].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const altDeliveries = sortedUpcoming
    .filter((u) => u.date !== selectedDate)
    .slice(0, 4);
  const firstFreshDelivery = sortedUpcoming[0] ?? null;
  const selectedDateIsStale = isDeliveryDateStale(
    selectedDate,
    firstFreshDelivery?.date ?? null,
  );
  // pastCutoff prop kept for API parity; selectedDateIsStale is the real gate.
  void pastCutoff;
  const dateGated = selectedDateIsStale;

  const minShortfall = Math.max(0, accountMinimum - total);
  const canSubmit = !underMinimum && !dateGated && lines.length > 0 && !placing;

  async function submit() {
    if (!canSubmit) return;
    if (!selectedDate) {
      toast.push("Pick a delivery date first.", "error");
      return;
    }
    setPlacing(true);
    track("checkout_started", { surface: "cart_sheet" });
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
      const errBody = await res.json().catch(() => ({}));
      track("checkout_failed", {
        surface: "cart_sheet",
        payment_method: "invoice",
        status: res.status,
        error: errBody?.error ?? null,
      });
      toast.push(errBody?.error ?? "Order failed", "error");
      return;
    }
    const { orderId } = await res.json();
    clear();
    // Close the sheet first, then push the route. Gives the visual
    // beat of the sheet sliding away before the confirmation hero
    // lands — feels like a commit, not a page swap.
    onClose();
    window.setTimeout(() => {
      router.push(`/orders/${orderId}?placed=1`);
    }, 240);
  }

  const footer = (
    <button
      type="button"
      onClick={submit}
      disabled={!canSubmit}
      className={
        canSubmit
          ? "w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-brand-green text-white font-bold text-[15px] hover:bg-brand-green-dark shadow-[0_8px_24px_rgba(42,155,70,0.30)] focus:outline-none focus:ring-2 focus:ring-brand-green/40 transition-colors duration-150 active:scale-[0.98]"
          : "w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-bg-secondary text-ink-tertiary font-bold text-[15px] cursor-not-allowed"
      }
    >
      {placing ? (
        "Placing…"
      ) : underMinimum ? (
        <>Add ${Math.ceil(minShortfall)} to ship {deliveryDayName ?? "this delivery"}</>
      ) : dateGated ? (
        "Pick a valid delivery date"
      ) : lines.length === 0 ? (
        "Cart's empty"
      ) : (
        <>Place order · {money(total)}</>
      )}
    </button>
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Submit ${deliveryDayName ?? "your"}'s order`}
      footer={footer}
    >
      <div className="px-5 pt-3 pb-4 space-y-5">
        {/* ---- Delivery row -------------------------------------------- */}
        <section>
          <div className="text-[11px] uppercase tracking-wide text-ink-tertiary font-medium mb-1.5">
            Delivery
          </div>
          {editingDate && altDeliveries.length > 0 ? (
            <div className="space-y-1.5">
              {[
                { date: selectedDate, dayName: deliveryDayName ?? "" } as UpcomingDelivery,
                ...altDeliveries,
              ]
                .filter((u) => Boolean(u.date))
                .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
                .map((u) => {
                  const isCurrent = u.date === selectedDate;
                  return (
                    <button
                      key={u.date as string}
                      type="button"
                      data-no-drag
                      onClick={() => {
                        track("delivery_date_picked", {
                          surface: "cart_sheet",
                          from: selectedDate,
                          to: u.date,
                        });
                        setDeliveryDate(u.date);
                        setEditingDate(false);
                      }}
                      className={
                        isCurrent
                          ? "w-full flex items-center justify-between px-3 py-2.5 rounded-md border-2 border-brand-blue bg-brand-blue-tint/50 text-left"
                          : "w-full flex items-center justify-between px-3 py-2.5 rounded-md border border-black/10 bg-white hover:border-black/20 text-left"
                      }
                    >
                      <span className="text-[14px] font-medium">
                        {u.dayName}, {dateLong(u.date ?? "")}
                      </span>
                      {isCurrent ? (
                        <span className="text-[11px] text-brand-blue font-bold uppercase tracking-wide">
                          Current
                        </span>
                      ) : null}
                    </button>
                  );
                })}
            </div>
          ) : (
            <button
              type="button"
              data-no-drag
              onClick={() => setEditingDate(true)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-md border border-black/10 bg-white hover:border-black/20 text-left"
            >
              <span className="text-[14px] font-medium">
                {selectedDate
                  ? `${deliveryDayName ?? ""}, ${dateLong(selectedDate)}`
                  : "Pick a delivery date"}
              </span>
              {altDeliveries.length > 0 ? (
                <span className="text-[12px] text-brand-blue">Change</span>
              ) : null}
            </button>
          )}
          {dateGated ? (
            <p className="mt-2 text-[12px] text-feedback-error leading-snug">
              That date passed cutoff. Pick a different one.
            </p>
          ) : null}
        </section>

        {/* ---- Lines ---------------------------------------------------- */}
        <section>
          <div className="text-[11px] uppercase tracking-wide text-ink-tertiary font-medium mb-1.5">
            {lines.length} {lines.length === 1 ? "line" : "lines"}
          </div>
          <div className="card overflow-hidden divide-y divide-black/[0.04]">
            {lines.map((l) => (
              <LineItem
                key={`${l.productId}|${l.variantKey ?? ""}`}
                data={{
                  id: l.productId,
                  name: l.name,
                  sku: l.sku,
                  packSize: l.packSize,
                  unit: l.unit,
                  unitPrice: l.unitPrice,
                  quantity: l.quantity,
                  notes: l.notes,
                  priceByWeight: l.priceByWeight,
                  variantLabel: l.variantLabel ?? null,
                }}
                mode="edit"
                onQty={(q) => setQty(l.productId, q, l.variantKey)}
                onRemove={() => {
                  track("remove_from_cart", {
                    product_id: l.productId,
                    sku: l.sku,
                    variant_key: l.variantKey ?? null,
                    quantity: l.quantity,
                  });
                  setQty(l.productId, 0, l.variantKey);
                }}
              />
            ))}
          </div>
        </section>

        {/* ---- Order note ---------------------------------------------- */}
        <section>
          <div className="text-[11px] uppercase tracking-wide text-ink-tertiary font-medium mb-1.5">
            Note for Alex
          </div>
          <Textarea
            data-no-drag
            value={orderNote}
            onChange={(e) => setOrderNote(e.target.value.slice(0, ORDER_NOTE_MAX))}
            placeholder="Substitutions, delivery instructions, anything we should know."
            rows={3}
            className="text-[14px]"
          />
        </section>

        {/* ---- Totals --------------------------------------------------- */}
        <section className="px-2 space-y-1 text-[14px]">
          <Row label="Subtotal" value={money(subtotal)} />
          {effectiveDeliveryFee > 0 ? (
            <Row label="Delivery fee" value={money(effectiveDeliveryFee)} />
          ) : null}
          <div className="border-t border-dashed border-black/15 my-2" />
          <Row label="Estimated total" value={money(total)} strong />
        </section>
      </div>
    </Sheet>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between ${strong ? "text-[16px] font-bold" : "text-[14px] text-ink-secondary"}`}
    >
      <span>{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}
