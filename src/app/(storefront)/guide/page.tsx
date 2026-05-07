import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import type {
  Account,
  AccountPricing,
  OrderGuide,
  OrderGuideItem,
  Product,
} from "@/lib/supabase/types";
import { GuideClient } from "./GuideClient";
import { resolvePrice } from "@/lib/utils/pricing";
import { money } from "@/lib/utils/format";
import { EmptyState } from "@/components/ui/EmptyState";

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

  // Default order guide. Use limit(1) + order by created_at so legacy rows
  // with multiple defaults (pre-0010 dedupe) still resolve deterministically.
  const { data: guideRows } = await db
    .from("order_guides")
    .select("*")
    .eq("profile_id", profileId)
    .eq("is_default", true)
    .order("created_at", { ascending: true })
    .limit(1);
  const guide = ((guideRows as OrderGuide[] | null) ?? [])[0] ?? null;

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

  // Per-producer order frequency ranking. Sort the guide's producer
  // sections by:
  //   1. how often THIS buyer has ordered from each producer (sum of
  //      quantities across all their order_items for products of that
  //      producer);
  //   2. tie-break (and producers never ordered) by overall popularity
  //      across all customers.
  // Both maps are passed to GuideClient as sort hints.
  const buyerProducerRank: Record<string, number> = {};
  const globalProducerRank: Record<string, number> = {};
  if (items.length) {
    const guideProducers = Array.from(
      new Set(
        items
          .map((i) => i.product.producer?.trim())
          .filter((p): p is string => Boolean(p)),
      ),
    );
    if (guideProducers.length) {
      // Buyer's own order frequency per producer
      const { data: myItems } = await db
        .from("order_items")
        .select("quantity, product:products!inner(producer), orders!inner(profile_id)")
        .eq("orders.profile_id", profileId)
        .in("product.producer", guideProducers);
      for (const r of ((myItems as any[] | null) ?? [])) {
        const prod = r.product?.producer as string | undefined;
        if (!prod) continue;
        buyerProducerRank[prod] =
          (buyerProducerRank[prod] ?? 0) + Number(r.quantity ?? 0);
      }
      // Global popularity per producer (anyone, any time)
      const { data: allItems } = await db
        .from("order_items")
        .select("quantity, product:products!inner(producer)")
        .in("product.producer", guideProducers);
      for (const r of ((allItems as any[] | null) ?? [])) {
        const prod = r.product?.producer as string | undefined;
        if (!prod) continue;
        globalProducerRank[prod] =
          (globalProducerRank[prod] ?? 0) + Number(r.quantity ?? 0);
      }
    }
  }

  // Latest order to power "reorder last" card
  const { data: lastOrderRow } = await db
    .from("orders")
    .select("id, order_number, total, created_at")
    .eq("profile_id", profileId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  let lastOrder: { id: string; order_number: string; total: number; item_count: number; created_at: string } | null = null;
  if (lastOrderRow) {
    const { count } = await db
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("order_id", (lastOrderRow as any).id);
    lastOrder = {
      ...(lastOrderRow as any),
      item_count: count ?? 0,
    };
  }

  // Time-of-day greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = me.first_name ?? "Chef";

  return (
    <div className="max-w-screen-xl mx-auto pb-8">
      {/* Personal greeting — single compact line */}
      <div className="pt-1 pb-2 text-xs text-ink-secondary">
        {greeting}, <span className="font-medium text-ink-primary">{firstName}</span>.
      </div>

      {/* Reorder-last card */}
      {lastOrder ? (
        <section className="mb-3">
          <form action={`/api/orders/reorder?orderId=${lastOrder.id}`} method="post">
            <button
              type="submit"
              className="w-full card p-4 flex items-center gap-4 hover:shadow-lg transition text-left active:scale-[0.99]"
            >
              <div className="h-12 w-12 rounded-lg bg-brand-green-tint text-brand-green flex items-center justify-center text-xl shrink-0">
                ↻
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">Reorder last</div>
                <div className="text-xs text-ink-secondary mt-0.5">
                  {lastOrder.order_number} · {lastOrder.item_count} {lastOrder.item_count === 1 ? "item" : "items"} · {money(lastOrder.total)}
                </div>
              </div>
              <span className="text-ink-tertiary">→</span>
            </button>
          </form>
        </section>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          className="card md:mx-0"
          icon={<div className="text-5xl opacity-30">☰</div>}
          title="Nothing in your guide yet"
          body="Your rep will build this for you based on what you order. You can also browse the catalog and add items yourself."
          cta={{ href: "/catalog", label: "Browse the catalog" }}
        />
      ) : (
        <GuideClient
          items={items}
          buyerProducerRank={buyerProducerRank}
          globalProducerRank={globalProducerRank}
        />
      )}
    </div>
  );
}

export type GuideRow = OrderGuideItem & {
  product: Product;
  unitPrice: number | null;
  lastOrderedAt: string | null;
};
