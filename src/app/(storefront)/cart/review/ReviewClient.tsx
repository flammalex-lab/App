"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart/store";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { money, dateLong } from "@/lib/utils/format";
import type { PickupLocation } from "@/lib/supabase/types";

interface Props {
  isB2B: boolean;
  accountName: string | null;
  pickupLocations: PickupLocation[];
}

export function ReviewClient({ isB2B, accountName, pickupLocations }: Props) {
  const router = useRouter();
  const toast = useToast();
  const lines = useCart((s) => s.lines);
  const deliveryDate = useCart((s) => s.deliveryDate);
  const pickupDate = useCart((s) => s.pickupDate);
  const pickupLocationId = useCart((s) => s.pickupLocationId);
  const orderNote = useCart((s) => s.orderNote);
  const clear = useCart((s) => s.clear);

  const [placing, setPlacing] = useState(false);
  const [itemsOpen, setItemsOpen] = useState(false);

  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const pickup = pickupLocations.find((p) => p.id === pickupLocationId) ?? null;

  if (lines.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-ink-secondary mb-4">Nothing to review — your cart is empty.</p>
        <Link href="/guide" className="btn-primary text-sm">Back to guide</Link>
      </div>
    );
  }

  async function placeOrder(paymentMethod: "invoice" | "stripe" | "venmo") {
    setPlacing(true);
    const res = await fetch("/api/orders/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderType: isB2B ? "b2b" : "dtc",
        paymentMethod,
        requestedDeliveryDate: isB2B ? deliveryDate : null,
        pickupDate: !isB2B ? pickupDate : null,
        pickupLocationId: !isB2B ? pickupLocationId : null,
        customerNotes: orderNote,
        lines: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          notes: l.notes ?? null,
        })),
      }),
    });
    setPlacing(false);
    if (!res.ok) {
      toast.push((await res.json()).error ?? "Order failed", "error");
      return;
    }
    const { orderId, stripeUrl } = await res.json();
    clear();
    if (stripeUrl) {
      window.location.href = stripeUrl;
    } else {
      router.push(`/orders/${orderId}?placed=1`);
    }
  }

  return (
    <>
      <Link href="/cart" className="text-sm text-ink-secondary hover:underline">
        ← Back to cart
      </Link>
      <h1 className="display text-3xl uppercase tracking-tight text-brand-blue mt-2 mb-6">
        Looking good — ready?
      </h1>

      {accountName ? (
        <div className="text-sm text-ink-secondary mb-3">{accountName}</div>
      ) : null}

      {/* When */}
      <section className="card p-4 mb-3">
        <div className="flex items-start gap-3">
          <span className="h-10 w-10 rounded-lg bg-brand-blue-tint text-brand-blue flex items-center justify-center text-lg">
            📅
          </span>
          <div>
            <div className="text-xs text-ink-secondary uppercase tracking-wide">
              {isB2B ? "Delivery" : "Pickup"}
            </div>
            <div className="text-base font-medium">
              {isB2B
                ? deliveryDate
                  ? dateLong(deliveryDate)
                  : "—"
                : pickupDate
                ? dateLong(pickupDate)
                : "—"}
            </div>
            {pickup ? (
              <div className="text-sm text-ink-secondary mt-0.5">
                {pickup.name} · {pickup.pickup_window}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* Order note */}
      {orderNote ? (
        <section className="card p-4 mb-3">
          <div className="text-xs text-ink-secondary uppercase tracking-wide mb-1">Note</div>
          <p className="text-sm">{orderNote}</p>
        </section>
      ) : null}

      {/* Order summary */}
      <section className="card overflow-hidden mb-3">
        <button
          onClick={() => setItemsOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-bg-secondary transition"
        >
          <span className="font-serif text-lg">Your items ({lines.length})</span>
          <span className="text-ink-tertiary">{itemsOpen ? "▾" : "›"}</span>
        </button>
        {itemsOpen ? (
          <ul className="divide-y divide-black/5 animate-slide-up">
            {lines.map((l) => (
              <li key={l.productId} className="flex items-start p-3 text-sm">
                <div className="mono text-center w-10 font-semibold">{l.quantity}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{l.name}</div>
                  <div className="text-xs text-ink-secondary">
                    {l.packSize ? `${l.packSize} · ` : ""}
                    <span className="mono">{money(l.unitPrice)} / {l.unit}</span>
                  </div>
                  {l.notes ? (
                    <div className="text-xs text-ink-tertiary italic mt-1">“{l.notes}”</div>
                  ) : null}
                </div>
                <div className="mono text-sm font-semibold shrink-0">
                  {money(l.unitPrice * l.quantity)}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* Total */}
      <section className="mb-6 px-1">
        <div className="flex items-baseline justify-between">
          <span className="font-serif text-xl">Estimated order total</span>
          <span className="mono text-2xl font-semibold">{money(subtotal)}</span>
        </div>
        <p className="text-xs text-ink-tertiary mt-1">
          Prices may be subject to change based on final weight at delivery.
        </p>
      </section>

      {/* Order now */}
      {isB2B ? (
        <Button
          onClick={() => placeOrder("invoice")}
          size="lg"
          loading={placing}
          className="w-full uppercase tracking-wide"
        >
          Order now
        </Button>
      ) : (
        <div className="space-y-2">
          <Button
            onClick={() => placeOrder("stripe")}
            size="lg"
            loading={placing}
            className="w-full uppercase tracking-wide"
          >
            Pay with card
          </Button>
          <Button
            onClick={() => placeOrder("venmo")}
            variant="secondary"
            size="lg"
            loading={placing}
            className="w-full"
          >
            Pay Venmo on pickup
          </Button>
        </div>
      )}
    </>
  );
}
