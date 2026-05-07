import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import { CartClient } from "./CartClient";
import { BackButton } from "@/components/layout/BackButton";
import type { Account, DeliveryZoneRow, PickupLocation } from "@/lib/supabase/types";
import { nextDeliveryForZone } from "@/lib/utils/cutoff";
import type { CartLine } from "@/lib/cart/store";

export const metadata = { title: "Cart — Fingerlakes Farms" };

export default async function CartPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const impersonating = session.profile.role === "admin" ? getImpersonation() : null;
  const db = impersonating ? createServiceClient() : await createClient();

  const profileId = impersonating ?? session.userId;
  const { data: me } = await db.from("profiles").select("*").eq("id", profileId).maybeSingle();
  if (!me) redirect("/login");
  const isB2B = me.role === "b2b_buyer";

  const { data: acctRow } = me.account_id
    ? await db.from("accounts").select("*").eq("id", me.account_id).maybeSingle()
    : { data: null };
  const account = acctRow as Account | null;

  let zone: DeliveryZoneRow | null = null;
  if (account?.delivery_zone) {
    const { data } = await db.from("delivery_zones").select("*").eq("zone", account.delivery_zone).maybeSingle();
    zone = data as DeliveryZoneRow | null;
  }
  const nextDel = zone ? nextDeliveryForZone(zone) : null;

  let pickups: PickupLocation[] = [];
  if (!isB2B) {
    const { data } = await db.from("pickup_locations").select("*").eq("active", true).order("sort_order");
    pickups = (data as PickupLocation[] | null) ?? [];
  }

  // If the user clicked "Reorder last", the API stashed the previous order's
  // line items in a short-lived cookie. Read it here and let the CartClient
  // clear it via /api/cart/consume-reorder after hydration — server
  // components in Next 14 can't mutate cookies directly.
  const cookieStore = cookies();
  let reorder: CartLine[] | null = null;
  const reorderCookie = cookieStore.get("flf-reorder")?.value;
  if (reorderCookie) {
    try {
      reorder = JSON.parse(reorderCookie) as CartLine[];
    } catch {
      reorder = null;
    }
  }

  return (
    <div className="overflow-x-clip">
      {/* Tighter Pepper-style side-panel feel. max-w-2xl keeps the cart
          column compact so the layout reads as a focused order summary,
          not a spacious page. The slide-in-right entrance reinforces
          the "flip back and forth" sensation. */}
      <div className="max-w-2xl mx-auto animate-slide-in-right">
        <div className="flex items-center justify-between pt-3 pb-1">
          <BackButton fallbackHref={isB2B ? "/guide" : "/catalog"} label="Keep shopping" />
          <h1 className="text-[15px] font-semibold tracking-tight text-ink-primary">
            Order summary
          </h1>
          <div className="w-[88px]" aria-hidden />
        </div>
        {account ? (
          <p className="text-[12px] text-ink-tertiary uppercase tracking-wider text-center mb-3">
            {account.name}
          </p>
        ) : null}
        <CartClient
          isB2B={isB2B}
          accountMinimum={account?.order_minimum ?? zone?.order_minimum ?? 0}
          deliveryFee={zone?.delivery_fee ?? 0}
          nextDelivery={
            nextDel
              ? {
                  deliveryDate: nextDel.deliveryDate.toISOString(),
                  cutoffAt: nextDel.cutoffAt.toISOString(),
                  pastCutoff: nextDel.pastCutoff,
                  deliveryDayName: nextDel.deliveryDayName,
                }
              : null
          }
          pickupLocations={pickups}
          reorder={reorder}
        />
      </div>
    </div>
  );
}
