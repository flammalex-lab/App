"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart, type CartLine } from "@/lib/cart/store";
import { money, dateLong } from "@/lib/utils/format";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
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
  nextDelivery: NextDelivery | null;
  pickupLocations: PickupLocation[];
  reorder: CartLine[] | null;
}

export function CartClient({ isB2B, accountMinimum, nextDelivery, pickupLocations, reorder }: Props) {
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
      <div className="card p-8 text-center mx-4 md:mx-0">
        <div className="text-5xl mb-3 opacity-30">🛒</div>
        <p className="text-ink-secondary mb-4">Nothing here yet — head to your guide to start building an order.</p>
        <Link href={isB2B ? "/guide" : "/catalog"} className="btn-primary text-sm">
          {isB2B ? "Back to your guide" : "Browse the catalog"}
        </Link>
      </div>
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
        <ul className="card divide-y divide-black/5 overflow-hidden">
          {lines.map((l) => (
            <li key={l.productId} className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{l.name}</div>
                <div className="text-xs text-ink-secondary">
                  {l.packSize ? `${l.packSize} · ` : ""}
                  <span className="mono">{money(l.unitPrice)} / {l.unit}</span>
                </div>
                {l.notes ? (
                  <div className="text-[11px] text-ink-tertiary italic mt-1">“{l.notes}”</div>
                ) : null}
              </div>
              <div className="shrink-0 flex items-center gap-1">
                <button
                  onClick={() => setQty(l.productId, l.quantity - 1)}
                  className="h-9 w-9 rounded-full border border-black/10 flex items-center justify-center hover:bg-bg-secondary"
                >
                  −
                </button>
                <div className="min-w-[56px] px-2 py-1.5 text-center border border-black/10 rounded-md bg-white">
                  <span className="mono text-sm font-semibold block leading-none">{l.quantity}</span>
                  <span className="text-[10px] text-ink-secondary uppercase tracking-wide">
                    {l.unit}
                  </span>
                </div>
                <button
                  onClick={() => setQty(l.productId, l.quantity + 1)}
                  className="h-9 w-9 rounded-full bg-brand-blue text-white flex items-center justify-center hover:bg-brand-blue-dark"
                >
                  +
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Minimum warning */}
      {underMinimum ? (
        <div className="rounded-md bg-feedback-error/5 text-feedback-error text-sm px-3 py-2">
          Order minimum is {money(accountMinimum)} — {money(accountMinimum - subtotal)} more to meet it.
        </div>
      ) : null}

      {/* Sticky Checkout CTA */}
      <div className="fixed bottom-[80px] md:bottom-6 inset-x-0 px-4 md:px-6 z-20 pointer-events-none">
        <div className="max-w-3xl mx-auto pointer-events-auto">
          <Button
            onClick={goToReview}
            size="lg"
            disabled={underMinimum}
            className="w-full shadow-sticky"
          >
            <span className="flex-1 text-left">Total</span>
            <span className="mono">{money(subtotal)}</span>
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
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-bg-secondary transition"
      >
        <span className="h-9 w-9 rounded-lg bg-brand-blue-tint text-brand-blue flex items-center justify-center">
          📅
        </span>
        <span className="flex-1 min-w-0">
          <span className="text-xs text-ink-secondary uppercase tracking-wide block">
            {isB2B ? "Delivery date" : "Pickup"}
          </span>
          <span className="text-sm font-medium">{display}</span>
        </span>
        <span className="text-ink-tertiary">{open ? "▾" : "›"}</span>
      </button>
      {open ? (
        <div className="px-4 py-3 bg-bg-secondary/50 animate-slide-up space-y-3">
          {isB2B ? (
            <>
              {nextDelivery ? (
                <p className="text-xs text-ink-secondary">
                  Earliest available: <strong>{dateLong(nextDelivery.deliveryDate)}</strong>
                </p>
              ) : null}
              <input
                type="date"
                className="input"
                value={deliveryDate ?? ""}
                onChange={(e) => onSetDelivery(e.target.value)}
              />
            </>
          ) : (
            <>
              <label className="block">
                <span className="text-xs text-ink-secondary uppercase tracking-wide">
                  Location
                </span>
                <select
                  className="input mt-1"
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
                <span className="text-xs text-ink-secondary uppercase tracking-wide">
                  Pickup date
                </span>
                <input
                  type="date"
                  className="input mt-1"
                  value={pickupDate ?? ""}
                  onChange={(e) => onSetPickup(e.target.value || null, pickupLocationId)}
                />
              </label>
            </>
          )}
        </div>
      ) : null}
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
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-bg-secondary transition"
      >
        <span className="h-9 w-9 rounded-lg bg-brand-blue-tint text-brand-blue flex items-center justify-center">
          💬
        </span>
        <span className="flex-1 min-w-0">
          <span className="text-xs text-ink-secondary uppercase tracking-wide block">
            Order note
          </span>
          <span className="text-sm font-medium text-ink-secondary">
            {note ? `“${note.slice(0, 50)}${note.length > 50 ? "…" : ""}”` : "Add a note (optional)"}
          </span>
        </span>
        <span className="text-ink-tertiary">{open ? "▾" : "›"}</span>
      </button>
      {open ? (
        <div className="px-4 py-3 bg-bg-secondary/50 animate-slide-up">
          <Textarea
            value={note}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Anything we should know? e.g. back-of-house delivery, cut thickness"
            rows={3}
          />
        </div>
      ) : null}
    </>
  );
}
