import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import { CartClient } from "./CartClient";
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
  // line items in a short-lived cookie. Read, then clear.
  const cookieStore = cookies();
  let reorder: CartLine[] | null = null;
  const reorderCookie = cookieStore.get("flf-reorder")?.value;
  if (reorderCookie) {
    try {
      reorder = JSON.parse(reorderCookie) as CartLine[];
    } catch {
      reorder = null;
    }
    cookieStore.delete("flf-reorder");
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl mb-4">Cart</h1>
      <CartClient
        isB2B={isB2B}
        accountMinimum={account?.order_minimum ?? zone?.order_minimum ?? 0}
        nextDelivery={
          nextDel
            ? { deliveryDate: nextDel.deliveryDate.toISOString(), cutoffAt: nextDel.cutoffAt.toISOString(), pastCutoff: nextDel.pastCutoff }
            : null
        }
        pickupLocations={pickups}
        reorder={reorder}
      />
    </div>
  );
}
