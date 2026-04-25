"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart/store";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { money, dateLong } from "@/lib/utils/format";
import { LineItem } from "@/components/products/LineItem";
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
  // Items default to OPEN — buyer should clearly see what they're confirming
  // before tapping "Order now". Toggle still available to collapse.
  const [itemsOpen, setItemsOpen] = useState(true);

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
      <h1 className="display text-2xl md:text-3xl tracking-tight mt-2 mb-1">
        Review your order
      </h1>
      {accountName ? (
        <p className="text-[13px] text-ink-secondary mb-5">{accountName}</p>
      ) : (
        <div className="mb-5" />
      )}

      {/* When */}
      <section className="card p-4 mb-3">
        <div className="flex items-start gap-3">
          <span aria-hidden className="h-10 w-10 rounded-lg bg-brand-blue-tint text-brand-blue flex items-center justify-center text-lg">
            📅
          </span>
          <div>
            <div className="text-[11px] text-ink-secondary uppercase tracking-wide font-medium">
              {isB2B ? "Delivery" : "Pickup"}
            </div>
            <div className="text-[16px] font-medium leading-snug">
              {isB2B
                ? deliveryDate
                  ? dateLong(deliveryDate)
                  : "—"
                : pickupDate
                ? dateLong(pickupDate)
                : "—"}
            </div>
            {pickup ? (
              <div className="text-[13px] text-ink-secondary mt-0.5">
                {pickup.name} · {pickup.pickup_window}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* Order note */}
      {orderNote ? (
        <section className="card p-4 mb-3">
          <div className="text-[11px] text-ink-secondary uppercase tracking-wide font-medium mb-1">
            Note
          </div>
          <p className="text-[14px] leading-relaxed">{orderNote}</p>
        </section>
      ) : null}

      {/* Order summary */}
      <section className="card overflow-hidden mb-3">
        <button
          onClick={() => setItemsOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-bg-secondary transition-colors duration-150"
        >
          <span className="display text-lg">Your items ({lines.length})</span>
          <span className="text-ink-tertiary text-xl">{itemsOpen ? "▾" : "›"}</span>
        </button>
        {itemsOpen ? (
          <div className="divide-y divide-black/5 animate-slide-up">
            {lines.map((l) => (
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
                  variantLabel: l.variantLabel ?? null,
                }}
                mode="review"
              />
            ))}
          </div>
        ) : null}
      </section>

      {/* Total */}
      <section className="mb-6 px-1">
        <div className="flex items-baseline justify-between">
          <span className="display text-lg tracking-tight">Estimated total</span>
          <span className="tabular text-2xl font-semibold">{money(subtotal)}</span>
        </div>
        <p className="text-[12px] text-ink-tertiary mt-1">
          Prices may be subject to change based on final weight at delivery.
        </p>
      </section>

      {/* Order now */}
      {isB2B ? (
        <Button
          onClick={() => placeOrder("invoice")}
          size="lg"
          loading={placing}
          className="w-full"
        >
          Order now
        </Button>
      ) : (
        <div className="space-y-2">
          <Button
            onClick={() => placeOrder("stripe")}
            size="lg"
            loading={placing}
            className="w-full"
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
