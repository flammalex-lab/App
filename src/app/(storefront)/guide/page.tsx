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
    <div className="max-w-3xl mx-auto pb-8">
      {/* Personal greeting — single compact line */}
      <div className="px-4 md:px-0 pt-1 pb-2 text-xs text-ink-secondary">
        {greeting}, <span className="font-medium text-ink-primary">{firstName}</span>.
      </div>

      {/* Reorder-last card */}
      {lastOrder ? (
        <section className="px-4 md:px-0 mb-3">
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
        <div className="card p-8 text-center mx-4 md:mx-0">
          <div className="text-5xl mb-3 opacity-30">☰</div>
          <h2 className="text-xl font-serif mb-2">No items in your guide yet</h2>
          <p className="text-sm text-ink-secondary mb-5 max-w-sm mx-auto">
            Your rep at Fingerlakes Farms will build this for you based on what you order.
            You can also browse the full catalog and add items yourself.
          </p>
          <Link href="/catalog" className="btn-primary text-sm">Browse the catalog</Link>
        </div>
      ) : (
        <GuideClient items={items} />
      )}
    </div>
  );
}

export type GuideRow = OrderGuideItem & {
  product: Product;
  unitPrice: number | null;
  lastOrderedAt: string | null;
};
