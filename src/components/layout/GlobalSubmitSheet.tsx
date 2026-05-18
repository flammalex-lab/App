"use client";

import { useEffect, useState } from "react";
import { SubmitSheet } from "@/app/(storefront)/guide/SubmitSheet";
import { track } from "@/lib/analytics/track";

interface UpcomingDelivery {
  date: string;
  dayName: string;
}

/**
 * Globally-mounted SubmitSheet — owns the open/close state and listens
 * for the `flf:open-submit` window event the StickyCartBar dispatches.
 * Lets every storefront page (not just /guide) pop the submit/review
 * overlay when the cart pill is tapped.
 *
 * All data props are layout-stable: next-delivery + account-minimum +
 * delivery-fee + upcoming-deliveries are computed once at the
 * storefront layout level and threaded down. Cart contents come from
 * the global useCart store inside SubmitSheet itself.
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
    <SubmitSheet
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
