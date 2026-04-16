"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/Brand";
import { dateLong, money } from "@/lib/utils/format";

export function OrderPlacedHero({
  orderNumber,
  deliveryDate,
  total,
  orderId,
}: {
  orderNumber: string;
  deliveryDate: string | null;
  total: number;
  orderId: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-brand-blue text-white overflow-hidden">
      {/* Texture layer — blue gradient w/ subtle diagonal lines */}
      <div
        className="absolute inset-0 opacity-80"
        style={{
          background:
            "linear-gradient(135deg, #0F4A8A 0%, #1763B5 50%, #2A9B46 120%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, rgba(255,255,255,0.6) 0, rgba(255,255,255,0.6) 1px, transparent 1px, transparent 14px)",
        }}
      />

      {/* Content */}
      <div className="relative flex-1 flex flex-col px-6 py-10 max-w-2xl mx-auto w-full">
        <div className="flex items-center gap-2 mb-auto">
          <BrandLogo size={44} />
          <span className="display text-lg tracking-tight">Fingerlakes Farms</span>
        </div>

        <div className={`transition-all duration-500 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <p className="text-sm uppercase tracking-widest opacity-80 mb-3">
            Order {orderNumber}
          </p>
          <h1 className="display text-5xl sm:text-6xl md:text-7xl leading-[0.95] uppercase tracking-tighter">
            Sent.<br />We&apos;ve got it.
          </h1>
          <div className="mt-8 space-y-2">
            {deliveryDate ? (
              <div className="flex items-baseline justify-between border-t border-white/20 pt-3">
                <span className="text-sm uppercase tracking-wide opacity-80">See you</span>
                <span className="font-semibold">{dateLong(deliveryDate)}</span>
              </div>
            ) : null}
            <div className="flex items-baseline justify-between border-t border-white/20 pt-3">
              <span className="text-sm uppercase tracking-wide opacity-80">Estimated total</span>
              <span className="mono font-semibold">{money(total)}</span>
            </div>
          </div>
          <p className="mt-4 text-xs opacity-70">
            We&apos;ll text you when it&apos;s on the way. Final invoice may adjust for actual weight.
          </p>
        </div>

        <div className={`mt-10 flex flex-col gap-2 transition-all duration-700 delay-150 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <Link
            href={`/orders/${orderId}`}
            className="block w-full rounded-md bg-white text-brand-blue font-medium py-3 text-center hover:bg-bg-secondary transition"
          >
            View order details
          </Link>
          <Link
            href="/guide"
            className="block w-full py-3 text-center text-white/90 hover:text-white transition text-sm"
          >
            Back to guide
          </Link>
        </div>
      </div>
    </div>
  );
}
