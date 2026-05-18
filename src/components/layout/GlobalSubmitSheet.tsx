"use client";

import { useEffect, useState } from "react";
import { CartSheet } from "@/components/cart/CartSheet";
import { track } from "@/lib/analytics/track";

interface UpcomingDelivery {
  date: string;
  dayName: string;
}

/**
 * Globally-mounted CartSheet — owns the open/close state and listens
 * for the `flf:open-submit` window event the StickyCartBar dispatches.
 * Lets every storefront page pop the cart sheet when the cart pill is
 * tapped, with the brief's full composite-P gesture.
 *
 * The old SubmitSheet (which only handled commit, not editing) has
 * been replaced by CartSheet — one sheet handles both editing and
 * committing in the same place, eliminating the /cart → /cart/review
 * route hop on mobile.
 *
 * Layout-stable props (next-delivery + minimum + fee + upcoming) come
 * from the storefront layout. Cart contents from the global useCart
 * store inside CartSheet.
 */
export function GlobalSubmitSheet({
  deliveryDayName,
  accountMinimum,
  deliveryFee,
  pastCutoff,
  upcomingDeliveries,
}: {
  deliveryDayName: string | null;
  accountMinimum: number;
  deliveryFee: number;
  pastCutoff: boolean;
  upcomingDeliveries: UpcomingDelivery[];
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    function handler() {
      setOpen(true);
    }
    window.addEventListener("flf:open-submit", handler);
    return () => window.removeEventListener("flf:open-submit", handler);
  }, []);
  return (
    <CartSheet
      open={open}
      onClose={() => {
        track("submit_sheet_dismissed", {});
        setOpen(false);
      }}
      deliveryDayName={deliveryDayName}
      accountMinimum={accountMinimum}
      deliveryFee={deliveryFee}
      pastCutoff={pastCutoff}
      upcomingDeliveries={upcomingDeliveries}
    />
  );
}

