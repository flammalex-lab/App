"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart, type CartLine } from "@/lib/cart/store";
import { money, dateLong } from "@/lib/utils/format";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import type { PickupLocation } from "@/lib/supabase/types";

interface Props {
  isB2B: boolean;
  accountMinimum: number;
  nextDelivery: { deliveryDate: string; cutoffAt: string; pastCutoff: boolean } | null;
  pickupLocations: PickupLocation[];
  reorder: CartLine[] | null;
}

export function CartClient({ isB2B, accountMinimum, nextDelivery, pickupLocations, reorder }: Props) {
  const lines = useCart((s) => s.lines);
  const setQty = useCart((s) => s.setQty);
  const setNotes = useCart((s) => s.setNotes);
  const remove = useCart((s) => s.remove);
  const clear = useCart((s) => s.clear);
  const bulkSet = useCart((s) => s.bulkSet);

  // If reorder cookie was present, seed the cart once with those lines.
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    if (reorder && reorder.length) {
      const existing = lines;
      const byId = new Map<string, CartLine>();
      for (const l of existing) byId.set(l.productId, l);
      for (const l of reorder) byId.set(l.productId, l); // reorder overrides qty
      bulkSet(Array.from(byId.values()));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0), [lines]);

  const [deliveryDate, setDeliveryDate] = useState<string>(
    nextDelivery ? nextDelivery.deliveryDate.slice(0, 10) : ""
  );
  const [pickupLocationId, setPickupLocationId] = useState<string>(pickupLocations[0]?.id ?? "");
  const [pickupDate, setPickupDate] = useState<string>("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  const underMinimum = isB2B && accountMinimum > 0 && subtotal < accountMinimum;

  async function submit(paymentMethod: "invoice" | "stripe" | "venmo") {
    setErr(null);
    if (lines.length === 0) { setErr("Cart is empty."); return; }
    if (isB2B && !deliveryDate) { setErr("Pick a delivery date."); return; }
    if (!isB2B && (!pickupDate || !pickupLocationId)) { setErr("Pick a pickup date and location."); return; }
    if (underMinimum) { setErr(`Order minimum is ${money(accountMinimum)}.`); return; }

    setSubmitting(true);
    const res = await fetch("/api/orders/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderType: isB2B ? "b2b" : "dtc",
        paymentMethod,
        requestedDeliveryDate: isB2B ? deliveryDate : null,
        pickupDate: !isB2B ? pickupDate : null,
        pickupLocationId: !isB2B ? pickupLocationId : null,
        customerNotes,
        lines: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          notes: l.notes ?? null,
        })),
      }),
    });
    setSubmitting(false);
    if (!res.ok) { setErr((await res.json()).error ?? "Order failed"); return; }
    const { orderId, stripeUrl } = await res.json();
    clear();
    if (stripeUrl) window.location.href = stripeUrl;
    else router.push(`/orders/${orderId}`);
  }

  if (lines.length === 0) {
    return (
      <div className="card p-6 text-center">
        <p>Your cart is empty.</p>
        <Link href={isB2B ? "/guide" : "/catalog"} className="btn-primary text-sm mt-3 inline-flex">Browse</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card divide-y divide-black/5">
        {lines.map((l) => (
          <div key={l.productId} className="p-4 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-medium">{l.name}</div>
              <div className="text-xs text-ink-secondary">
                {l.packSize ? `${l.packSize} · ` : ""}
                <span className="mono">{money(l.unitPrice)}/{l.unit}</span>
              </div>
              <Textarea
                className="mt-2 min-h-[40px] text-sm"
                placeholder="Notes (optional)"
                value={l.notes ?? ""}
                onChange={(e) => setNotes(l.productId, e.target.value)}
              />
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-1">
                <button onClick={() => setQty(l.productId, l.quantity - 1)} className="h-8 w-8 rounded border border-black/10">−</button>
                <input
                  type="number"
                  min={0}
                  className="input w-16 text-center"
                  value={l.quantity}
                  onChange={(e) => setQty(l.productId, Number(e.target.value) || 0)}
                />
                <button onClick={() => setQty(l.productId, l.quantity + 1)} className="h-8 w-8 rounded border border-black/10">+</button>
              </div>
              <div className="mono text-sm">{money(l.unitPrice * l.quantity)}</div>
              <button onClick={() => remove(l.productId)} className="text-xs text-feedback-error underline">remove</button>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-4 space-y-3">
        {isB2B ? (
          <Field label="Requested delivery date" hint={nextDelivery ? `Next available: ${dateLong(nextDelivery.deliveryDate)}` : undefined}>
            <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
          </Field>
        ) : (
          <>
            <Field label="Pickup location">
              <select className="input" value={pickupLocationId} onChange={(e) => setPickupLocationId(e.target.value)}>
                {pickupLocations.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} — {p.pickup_window}</option>
                ))}
              </select>
            </Field>
            <Field label="Pickup date">
              <Input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} />
            </Field>
          </>
        )}
        <Field label="Order notes (optional)">
          <Textarea value={customerNotes} onChange={(e) => setCustomerNotes(e.target.value)} />
        </Field>
      </div>

      <div className="card p-4">
        <div className="flex justify-between text-sm">
          <span>Subtotal</span><span className="mono">{money(subtotal)}</span>
        </div>
        {underMinimum ? (
          <p className="text-sm text-feedback-error mt-2">
            Order minimum for your zone is {money(accountMinimum)} — {money(accountMinimum - subtotal)} more to meet it.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2 mt-4">
          {isB2B ? (
            <Button onClick={() => submit("invoice")} loading={submitting} size="lg">
              Place order (bill to account)
            </Button>
          ) : (
            <>
              <Button onClick={() => submit("stripe")} loading={submitting} size="lg">Pay with card</Button>
              <Button onClick={() => submit("venmo")} variant="secondary" loading={submitting}>Pay Venmo on pickup</Button>
            </>
          )}
          <button onClick={() => clear()} className="btn-ghost text-sm">Clear cart</button>
        </div>
        {err ? <p className="text-sm text-feedback-error mt-2">{err}</p> : null}
      </div>
    </div>
  );
}
