import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import type { Account, Product } from "@/lib/supabase/types";
import { visibleProductsQuery } from "@/lib/products/queries";
import { StandingNewClient } from "./StandingNewClient";

export const metadata = { title: "New standing order — Fingerlakes Farms" };

/**
 * Resolve the buyer's default delivery days for pre-populating the
 * standing-order form. Prefer the account-level override
 * (accounts.delivery_days, added in 0030_account_delivery_days_override),
 * then fall back to the legacy singular accounts.delivery_day text
 * column when present. Returns an empty array when neither is set so the
 * client falls through to the disabled-save + helper-text branch.
 */
function pickDefaultDays(account: Account | null): string[] {
  if (!account) return [];
  const override = account.delivery_days;
  if (Array.isArray(override) && override.length > 0) {
    return override.filter((d): d is string => typeof d === "string" && d.length > 0);
  }
  const legacy = account.delivery_day;
  if (typeof legacy === "string" && legacy.trim()) return [legacy.trim()];
  return [];
}

export default async function NewStandingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const impersonating = session.profile.role === "admin" ? await getImpersonation() : null;
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
        Auto-submits on each scheduled day. Edit lines anytime — changes apply to the next run.
      </p>
      <StandingNewClient
        products={(products as Product[] | null) ?? []}
        initial={{
          name: "My weekly order",
          frequency: "weekly",
          days_of_week: pickDefaultDays(a),
          require_confirmation: true,
          active: true,
          items: [],
        }}
      />
    </div>
  );
}
