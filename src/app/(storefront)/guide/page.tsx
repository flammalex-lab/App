import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import type { Account, OrderGuide, OrderGuideItem, Product, AccountPricing } from "@/lib/supabase/types";
import { GuideClient } from "./GuideClient";
import { resolvePrice } from "@/lib/utils/pricing";

export const metadata = { title: "Order guide — Fingerlakes Farms" };

export default async function GuidePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const impersonating = session.profile.role === "admin" ? getImpersonation() : null;
  const profileId = impersonating ?? session.userId;
  const db = impersonating ? createServiceClient() : await createClient();

  // Profile + account
  const { data: me } = await db.from("profiles").select("*").eq("id", profileId).maybeSingle();
  if (!me || me.role === "admin") redirect("/dashboard");
  if (me.role === "dtc_customer") redirect("/catalog");

  const { data: accountRow } = me.account_id
    ? await db.from("accounts").select("*").eq("id", me.account_id).maybeSingle()
    : { data: null as Account | null };
  const account = accountRow as Account | null;

  // Load default order guide for this buyer
  const { data: guideRow } = await db
    .from("order_guides")
    .select("*")
    .eq("profile_id", profileId)
    .eq("is_default", true)
    .maybeSingle();
  const guide = guideRow as OrderGuide | null;

  let items: (OrderGuideItem & { product: Product; unitPrice: number | null })[] = [];
  if (guide) {
    const { data: itemRows } = await db
      .from("order_guide_items")
      .select("*, product:products(*)")
      .eq("order_guide_id", guide.id)
      .order("sort_order", { ascending: true });

    // pricing overrides for this account
    const { data: overrides } = account
      ? await db.from("account_pricing").select("*").eq("account_id", account.id)
      : { data: [] as AccountPricing[] };

    items = (itemRows as any[] | null ?? []).map((row) => {
      const p = row.product as Product;
      const override = (overrides as AccountPricing[] | null)?.find((o) => o.product_id === p.id) ?? null;
      const unitPrice = resolvePrice(p, {
        account,
        customPrice: override,
        isB2B: true,
      });
      return { ...(row as OrderGuideItem), product: p, unitPrice };
    });
  }

  // Latest order to power "reorder last"
  const { data: lastOrder } = await db
    .from("orders")
    .select("id, order_number, created_at")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-end justify-between mb-4">
        <div>
          <h1 className="text-3xl">Your order guide</h1>
          {account ? <p className="text-ink-secondary text-sm">{account.name}</p> : null}
        </div>
        <div className="flex gap-2">
          {lastOrder ? (
            <form action={`/api/orders/reorder?orderId=${lastOrder.id}`} method="post">
              <button className="btn-secondary text-sm">Reorder last ({lastOrder.order_number})</button>
            </form>
          ) : null}
          <Link href="/catalog" className="btn-ghost text-sm">Browse catalog</Link>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="mb-2">Your guide is empty.</p>
          <p className="text-sm text-ink-secondary mb-4">Ask your rep to curate it, or add items from the catalog.</p>
          <Link href="/catalog" className="btn-primary text-sm">Browse catalog</Link>
        </div>
      ) : (
        <GuideClient items={items} />
      )}
    </div>
  );
}
