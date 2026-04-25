"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart, type CartLine } from "@/lib/cart/store";
import { money, dateLong } from "@/lib/utils/format";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { LineItem } from "@/components/products/LineItem";
import { EmptyState } from "@/components/ui/EmptyState";
import { BottomSheet } from "@/components/ui/BottomSheet";
import type { PickupLocation } from "@/lib/supabase/types";

interface NextDelivery {
  deliveryDate: string;
  cutoffAt: string;
  pastCutoff: boolean;
  deliveryDayName: string;
}

interface Props {
  isB2B: boolean;
  accountMinimum: number;
  deliveryFee: number;
  nextDelivery: NextDelivery | null;
  pickupLocations: PickupLocation[];
  reorder: CartLine[] | null;
}

export function CartClient({ isB2B, accountMinimum, deliveryFee, nextDelivery, pickupLocations, reorder }: Props) {
  const lines = useCart((s) => s.lines);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const clear = useCart((s) => s.clear);
  const bulkSet = useCart((s) => s.bulkSet);

  const deliveryDate = useCart((s) => s.deliveryDate);
  const setDeliveryDate = useCart((s) => s.setDeliveryDate);
  const pickupDate = useCart((s) => s.pickupDate);
  const pickupLocationId = useCart((s) => s.pickupLocationId);
  const setPickup = useCart((s) => s.setPickup);
  const orderNote = useCart((s) => s.orderNote);
  const setOrderNote = useCart((s) => s.setOrderNote);

  // Seed the cart with reorder items once, on first mount
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    if (reorder && reorder.length) {
      const byId = new Map<string, CartLine>();
      for (const l of lines) byId.set(l.productId, l);
      for (const l of reorder) byId.set(l.productId, l);
      bulkSet(Array.from(byId.values()));
    }
    // Default delivery date to the earliest available if none picked
    if (isB2B && !deliveryDate && nextDelivery && !nextDelivery.pastCutoff) {
      setDeliveryDate(nextDelivery.deliveryDate.slice(0, 10));
    }
    // Default pickup location to first available for DTC
    if (!isB2B && pickupLocations.length && !pickupLocationId) {
      setPickup(pickupDate, pickupLocations[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0), [lines]);
  const underMinimum = isB2B && accountMinimum > 0 && subtotal < accountMinimum;
  const effectiveDeliveryFee = isB2B && subtotal > 0 ? deliveryFee : 0;
  const total = subtotal + effectiveDeliveryFee;
  const hasCatchWeight = lines.some((l) => l.priceByWeight);

  const [search, setSearch] = useState("");
  const visibleLines = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return lines;
    return lines.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        (l.sku ?? "").toLowerCase().includes(q) ||
        (l.variantSku ?? "").toLowerCase().includes(q),
    );
  }, [lines, search]);

  const [noteOpen, setNoteOpen] = useState(Boolean(orderNote));
  const [dateOpen, setDateOpen] = useState(false);

  const router = useRouter();
  function goToReview() {
    if (lines.length === 0) return;
    if (isB2B && !deliveryDate) { setDateOpen(true); return; }
    if (!isB2B && (!pickupDate || !pickupLocationId)) { setDateOpen(true); return; }
    if (underMinimum) return;
    router.push("/cart/review");
  }

  if (lines.length === 0) {
    return (
      <EmptyState
        className="card mx-4 md:mx-0"
        icon={<div className="text-5xl opacity-30">🛒</div>}
        title="Nothing in your cart yet"
        body={isB2B ? "Head back to your guide to start building an order." : "Browse the catalog to pick something fresh."}
        cta={{
          href: isB2B ? "/guide" : "/catalog",
          label: isB2B ? "Back to your guide" : "Browse the catalog",
        }}
      />
    );
  }

  return (
    <div className="space-y-4 px-4 md:px-0">
      {/* Delivery / Note rows (Choco-style) */}
      <div className="card divide-y divide-black/5 overflow-hidden">
        <DeliveryRow
          isB2B={isB2B}
          deliveryDate={deliveryDate}
          pickupDate={pickupDate}
          pickupLocationId={pickupLocationId}
          pickupLocations={pickupLocations}
          nextDelivery={nextDelivery}
          onSetDelivery={(d) => setDeliveryDate(d)}
          onSetPickup={(d, id) => setPickup(d, id)}
          open={dateOpen}
          setOpen={setDateOpen}
        />
        <NoteRow
          note={orderNote}
          onChange={setOrderNote}
          open={noteOpen}
          setOpen={setNoteOpen}
        />
      </div>

      {/* Items */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="font-serif text-lg">Your items ({lines.length})</h2>
          <button onClick={clear} className="text-xs text-feedback-error uppercase tracking-wide">
            Remove all
          </button>
        </div>
        {lines.length > 3 ? (
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find in this cart"
            className="input mb-2"
          />
        ) : null}
        <div className="card divide-y divide-black/5 overflow-hidden">
          {visibleLines.map((l) => (
            <LineItem
              key={`${l.productId}:${l.variantKey ?? ""}`}
              data={{
                id: l.productId,
                name: l.name,
                packSize: l.packSize,
                unit: l.unit,
                unitPrice: l.unitPrice,
                quantity: l.quantity,
                notes: l.notes,
                priceByWeight: l.priceByWeight,
              }}
              mode="edit"
              onQty={(q) => setQty(l.productId, q, l.variantKey)}
              onRemove={() => setQty(l.productId, 0, l.variantKey)}
            />
          ))}
          {visibleLines.length === 0 ? (
            <div className="p-6 text-center text-sm text-ink-secondary">
              Nothing matches &ldquo;{search}&rdquo;.
            </div>
          ) : null}
        </div>
      </div>

      {/* Totals */}
      <div className="card p-4 space-y-1 text-sm">
        <Row label="Subtotal" value={money(subtotal)} />
        {effectiveDeliveryFee > 0 ? <Row label="Delivery fee" value={money(effectiveDeliveryFee)} /> : null}
        <Row label="Estimated total" value={money(total)} strong />
        {hasCatchWeight ? (
          <p className="text-[11px] text-ink-tertiary pt-1">
            Final price confirmed by distributor — weight-priced items settle at delivery.
          </p>
        ) : null}
      </div>

      {/* Minimum warning */}
      {underMinimum ? (
        <div className="rounded-md bg-feedback-error/5 text-feedback-error text-sm px-3 py-2">
          Order minimum is {money(accountMinimum)} — {money(accountMinimum - subtotal)} more to meet it.
        </div>
      ) : null}

      {/* Sticky Checkout CTA */}
      <div className="fixed bottom-[80px] md:bottom-6 inset-x-0 px-4 md:px-6 z-20 pointer-events-none">
        <div className="max-w-5xl mx-auto pointer-events-auto">
          <Button
            onClick={goToReview}
            size="lg"
            disabled={underMinimum}
            className="w-full shadow-sticky"
          >
            <span className="flex-1 text-left">Total</span>
            <span className="mono">{money(total)}</span>
            <span className="ml-2">Review →</span>
          </Button>
        </div>
      </div>
      {/* Bottom-of-page spacer so nothing hides under the sticky CTA */}
      <div className="h-20" />
    </div>
  );
}

/* ---------- Delivery row + sheet ---------- */

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "font-semibold text-base pt-1" : ""}`}>
      <span className={strong ? "" : "text-ink-secondary"}>{label}</span>
      <span className="mono">{value}</span>
    </div>
  );
}

function DeliveryRow({
  isB2B,
  deliveryDate,
  pickupDate,
  pickupLocationId,
  pickupLocations,
  nextDelivery,
  onSetDelivery,
  onSetPickup,
  open,
  setOpen,
}: {
  isB2B: boolean;
  deliveryDate: string | null;
  pickupDate: string | null;
  pickupLocationId: string | null;
  pickupLocations: PickupLocation[];
  nextDelivery: NextDelivery | null;
  onSetDelivery: (d: string) => void;
  onSetPickup: (d: string | null, id: string | null) => void;
  open: boolean;
  setOpen: (o: boolean) => void;
}) {
  const display = isB2B
    ? deliveryDate
      ? dateLong(deliveryDate)
      : "Pick a delivery date"
    : pickupDate && pickupLocationId
    ? `${dateLong(pickupDate)} · ${pickupLocations.find((p) => p.id === pickupLocationId)?.name ?? ""}`
    : "Pick a pickup date + location";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-bg-secondary transition-colors duration-150"
      >
        <span aria-hidden className="h-10 w-10 rounded-lg bg-brand-blue-tint text-brand-blue flex items-center justify-center text-lg">
          📅
        </span>
        <span className="flex-1 min-w-0">
          <span className="text-[11px] text-ink-secondary uppercase tracking-wide block font-medium">
            {isB2B ? "Delivery date" : "Pickup"}
          </span>
          <span className="text-[15px] font-medium">{display}</span>
        </span>
        <span className="text-ink-tertiary">›</span>
      </button>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={isB2B ? "Delivery date" : "Pickup details"}
      >
        <div className="px-5 py-5 space-y-4">
          {isB2B ? (
            <>
              {nextDelivery ? (
                <p className="text-[13px] text-ink-secondary">
                  Earliest available:{" "}
                  <strong className="text-ink-primary">
                    {dateLong(nextDelivery.deliveryDate)}
                  </strong>
                </p>
              ) : null}
              <label className="block">
                <span className="text-[11px] text-ink-secondary uppercase tracking-wide font-medium block mb-1.5">
                  Pick a date
                </span>
                <input
                  type="date"
                  className="input text-base"
                  value={deliveryDate ?? ""}
                  onChange={(e) => onSetDelivery(e.target.value)}
                />
              </label>
            </>
          ) : (
            <>
              <label className="block">
                <span className="text-[11px] text-ink-secondary uppercase tracking-wide font-medium block mb-1.5">
                  Location
                </span>
                <select
                  className="input text-base"
                  value={pickupLocationId ?? ""}
                  onChange={(e) => onSetPickup(pickupDate, e.target.value || null)}
                >
                  <option value="">—</option>
                  {pickupLocations.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.pickup_window}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] text-ink-secondary uppercase tracking-wide font-medium block mb-1.5">
                  Pickup date
                </span>
                <input
                  type="date"
                  className="input text-base"
                  value={pickupDate ?? ""}
                  onChange={(e) => onSetPickup(e.target.value || null, pickupLocationId)}
                />
              </label>
            </>
          )}
          <button
            onClick={() => setOpen(false)}
            className="btn-primary w-full mt-2"
          >
            Done
          </button>
        </div>
      </BottomSheet>
    </>
  );
}

/* ---------- Order note row ---------- */

function NoteRow({
  note,
  onChange,
  open,
  setOpen,
}: {
  note: string;
  onChange: (s: string) => void;
  open: boolean;
  setOpen: (o: boolean) => void;
}) {
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-bg-secondary transition-colors duration-150"
      >
        <span aria-hidden className="h-10 w-10 rounded-lg bg-brand-blue-tint text-brand-blue flex items-center justify-center text-lg">
          💬
        </span>
        <span className="flex-1 min-w-0">
          <span className="text-[11px] text-ink-secondary uppercase tracking-wide block font-medium">
            Order note
          </span>
          <span className="text-[15px] font-medium text-ink-primary truncate block">
            {note
              ? `“${note.slice(0, 50)}${note.length > 50 ? "…" : ""}”`
              : <span className="text-ink-secondary">Add a note (optional)</span>}
          </span>
        </span>
        <span className="text-ink-tertiary">›</span>
      </button>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Order note"
      >
        <div className="px-5 py-5 space-y-3">
          <p className="text-[13px] text-ink-secondary">
            Anything we should know? Back-of-house delivery, cut thickness,
            substitution preferences, etc.
          </p>
          <Textarea
            value={note}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Type a note…"
            rows={5}
            className="text-base"
          />
          <button
            onClick={() => setOpen(false)}
            className="btn-primary w-full"
          >
            Save note
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
