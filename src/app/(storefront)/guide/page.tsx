import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import type {
  Account,
  AccountPricing,
  Category,
  DeliveryZoneRow,
  OrderGuide,
  OrderGuideItem,
  Product,
} from "@/lib/supabase/types";
import { GuideClient } from "./GuideClient";
import { resolvePrice } from "@/lib/utils/pricing";
import { nextDeliveryForZone } from "@/lib/utils/cutoff";
import { countdown } from "@/lib/utils/format";

export const metadata = { title: "Order guide — Fingerlakes Farms" };

export default async function GuidePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const impersonating = session.profile.role === "admin" ? getImpersonation() : null;
  const profileId = impersonating ?? session.userId;
  const db = impersonating ? createServiceClient() : await createClient();

  const { data: me } = await db.from("profiles").select("*").eq("id", profileId).maybeSingle();
  if (!me || me.role === "admin") redirect("/dashboard");
  if (me.role === "dtc_customer") redirect("/catalog");

  const { data: accountRow } = me.account_id
    ? await db.from("accounts").select("*").eq("id", me.account_id).maybeSingle()
    : { data: null as Account | null };
  const account = accountRow as Account | null;

  // Cutoff / delivery context for the hero band
  let zone: DeliveryZoneRow | null = null;
  if (account?.delivery_zone) {
    const { data: z } = await db.from("delivery_zones").select("*").eq("zone", account.delivery_zone).maybeSingle();
    zone = z as DeliveryZoneRow | null;
  }
  const nextDel = zone ? nextDeliveryForZone(zone) : null;

  // Default order guide
  const { data: guideRow } = await db
    .from("order_guides")
    .select("*")
    .eq("profile_id", profileId)
    .eq("is_default", true)
    .maybeSingle();
  const guide = guideRow as OrderGuide | null;

  let items: GuideRow[] = [];
  if (guide) {
    const { data: itemRows } = await db
      .from("order_guide_items")
      .select("*, product:products(*)")
      .eq("order_guide_id", guide.id)
      .order("sort_order", { ascending: true });

    const { data: overrides } = account
      ? await db.from("account_pricing").select("*").eq("account_id", account.id)
      : { data: [] as AccountPricing[] };

    // Last-ordered lookup — find the most recent order_items row for each product
    // by this buyer. Cheap for now, bounded by the size of the guide.
    const productIds = (itemRows as any[] | null ?? []).map((r) => r.product_id);
    const lastOrderedByProduct: Record<string, string> = {};
    if (productIds.length) {
      const { data: recentItems } = await db
        .from("order_items")
        .select("product_id, order:orders!inner(profile_id, created_at)")
        .eq("order.profile_id", profileId)
        .in("product_id", productIds);
      for (const row of ((recentItems as any[] | null) ?? [])) {
        const pid = row.product_id as string;
        const ts = row.order?.created_at as string;
        if (!ts) continue;
        if (!lastOrderedByProduct[pid] || ts > lastOrderedByProduct[pid]) {
          lastOrderedByProduct[pid] = ts;
        }
      }
    }

    items = (itemRows as any[] | null ?? []).map((row) => {
      const p = row.product as Product;
      const override = (overrides as AccountPricing[] | null)?.find((o) => o.product_id === p.id) ?? null;
      const unitPrice = resolvePrice(p, { account, customPrice: override, isB2B: true });
      return {
        ...(row as OrderGuideItem),
        product: p,
        unitPrice,
        lastOrderedAt: lastOrderedByProduct[p.id] ?? null,
      };
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

  const categories = Array.from(new Set(items.map((r) => r.product.category))) as Category[];

  return (
    <div className="max-w-3xl mx-auto pb-8">
      {/* Supplier-identity + cutoff hero */}
      <section className="px-4 md:px-0 pt-4 pb-5">
        <div className="flex items-baseline justify-between gap-3 mb-1">
          <h1 className="display text-3xl sm:text-4xl">Your order guide</h1>
          {lastOrder ? (
            <form action={`/api/orders/reorder?orderId=${lastOrder.id}`} method="post" className="shrink-0">
              <button className="btn-secondary text-xs py-1.5 px-3">
                Reorder last
              </button>
            </form>
          ) : null}
        </div>
        {account ? (
          <p className="text-ink-secondary text-sm">{account.name}</p>
        ) : null}
        {nextDel ? (
          <div className="mt-3 rounded-xl bg-brand-blue-tint border border-brand-blue/10 px-4 py-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-ink-secondary">Next delivery</div>
                <div className="font-semibold text-brand-blue-dark mt-0.5">
                  {nextDel.deliveryDayName}, {nextDel.deliveryDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </div>
              </div>
              <div className="text-right">
                <div className="text-ink-secondary">Cutoff</div>
                <div className="mono font-semibold text-brand-blue-dark mt-0.5">
                  {countdown(nextDel.cutoffAt.getTime() - Date.now())}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {items.length === 0 ? (
        <div className="card p-8 text-center mx-4 md:mx-0">
          <div className="text-5xl mb-3 opacity-40">☰</div>
          <h2 className="text-xl font-serif mb-2">Your guide is empty</h2>
          <p className="text-sm text-ink-secondary mb-5 max-w-sm mx-auto">
            Your rep will usually curate this based on a first conversation — it becomes your
            one-tap reorder list. You can also browse the catalog and add items yourself.
          </p>
          <Link href="/catalog" className="btn-primary text-sm">Browse catalog</Link>
        </div>
      ) : (
        <GuideClient items={items} categories={categories} />
      )}
    </div>
  );
}

export type GuideRow = OrderGuideItem & {
  product: Product;
  unitPrice: number | null;
  lastOrderedAt: string | null;
};
