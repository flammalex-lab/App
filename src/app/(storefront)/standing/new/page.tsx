import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import type { Account, Product } from "@/lib/supabase/types";
import { visibleProductsQuery } from "@/lib/products/queries";
import { StandingOrderEditor } from "@/components/standing/StandingOrderEditor";

export const metadata = { title: "New standing order — Fingerlakes Farms" };

export default async function NewStandingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const impersonating = session.profile.role === "admin" ? getImpersonation() : null;
  const db = impersonating ? createServiceClient() : await createClient();
  const profileId = impersonating ?? session.userId;

  const { data: me } = await db.from("profiles").select("*").eq("id", profileId).maybeSingle();
  if (!me?.account_id) redirect("/standing");
  const { data: account } = await db.from("accounts").select("*").eq("id", me.account_id).maybeSingle();
  const a = account as Account;

  const buyerType = me.buyer_type ?? a.buyer_type ?? null;
  const { data: products } = await visibleProductsQuery(db, {
    buyerType,
    isB2B: me.role === "b2b_buyer",
  }).order("sort_order");

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl mb-1">New standing order</h1>
      <p className="text-sm text-ink-secondary mb-4">
        We&apos;ll stage an order on each scheduled day and text you to confirm before submitting.
      </p>
      <StandingOrderEditor
        standingOrderId={null}
        products={(products as Product[] | null) ?? []}
        initial={{
          name: "My weekly order",
          frequency: "weekly",
          days_of_week: [],
          require_confirmation: true,
          active: true,
          items: [],
        }}
      />
    </div>
  );
}
