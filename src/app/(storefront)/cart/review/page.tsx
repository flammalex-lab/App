import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import { ReviewClient } from "./ReviewClient";
import type { Account, PickupLocation } from "@/lib/supabase/types";

export const metadata = { title: "Review order — Fingerlakes Farms" };

export default async function ReviewPage() {
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
    : { data: null as Account | null };
  const account = acctRow as Account | null;

  let pickups: PickupLocation[] = [];
  if (!isB2B) {
    const { data } = await db.from("pickup_locations").select("*").eq("active", true).order("sort_order");
    pickups = (data as PickupLocation[] | null) ?? [];
  }

  return (
    <div className="max-w-2xl mx-auto pt-6 pb-8">
      <ReviewClient
        isB2B={isB2B}
        accountName={account?.name ?? null}
        pickupLocations={pickups}
      />
    </div>
  );
}
