import type { StandingOrder, StandingOrderItem, Product, Account, AccountPricing, Profile } from "@/lib/supabase/types";
import { resolvePrice } from "@/lib/utils/pricing";
import { enqueueAndSend } from "@/lib/notifications/dispatch";

/**
 * Materialize a standing order into a draft order. If require_confirmation is
 * true, the buyer gets an SMS to confirm; otherwise it submits as pending.
 */
export async function runStandingOrder(svc: any, standingOrderId: string): Promise<{ ok: boolean; orderId?: string; error?: string }> {
  const { data: so } = await svc
    .from("standing_orders")
    .select("*, items:standing_order_items(*, product:products(*)), account:accounts(*), buyer:profiles!standing_orders_profile_id_fkey(*)")
    .eq("id", standingOrderId)
    .maybeSingle();
  if (!so) return { ok: false, error: "not found" };
  const s = so as StandingOrder & {
    items: (StandingOrderItem & { product: Product })[];
    account: Account;
    buyer: Profile;
  };
  if (!s.items?.length) return { ok: false, error: "no items" };

  // Resolve prices via account overrides
  const { data: overrides } = await svc.from("account_pricing").select("*").eq("account_id", s.account.id);
  const priced = s.items.map((it) => {
    const override = (overrides as AccountPricing[] | null)?.find((o) => o.product_id === it.product_id) ?? null;
    const unitPrice = resolvePrice(it.product, { account: s.account, customPrice: override, isB2B: true }) ?? 0;
    return { ...it, unitPrice };
  });
  const subtotal = round2(priced.reduce((acc, it) => acc + it.unitPrice * Number(it.quantity), 0));

  const { data: numRow } = await svc.rpc("generate_order_number");
  const order_number = (numRow as unknown as string) ?? `FLF-${Date.now()}`;

  const { data: order } = await svc
    .from("orders")
    .insert({
      order_number,
      order_type: "b2b",
      status: s.require_confirmation ? "draft" : "pending",
      profile_id: s.profile_id,
      account_id: s.account_id,
      standing_order_id: s.id,
      subtotal,
      total: subtotal,
      payment_method: "invoice",
    })
    .select("id")
    .single();
  if (!order) return { ok: false, error: "order create failed" };

  await svc.from("order_items").insert(priced.map((it) => ({
    order_id: (order as any).id,
    product_id: it.product_id,
    quantity: it.quantity,
    unit_price: it.unitPrice,
    line_total: round2(it.unitPrice * Number(it.quantity)),
    notes: it.notes,
  })));

  await svc.from("standing_orders").update({
    last_run_date: new Date().toISOString().slice(0, 10),
  }).eq("id", s.id);

  if (s.buyer.phone) {
    await enqueueAndSend({
      supabase: svc,
      profileId: s.profile_id,
      accountId: s.account_id,
      type: "standing_order_ready",
      channel: "sms",
      toAddress: s.buyer.phone,
      body: s.require_confirmation
        ? `FLF: standing order ${order_number} is staged — reply CONFIRM to submit or visit ${process.env.NEXT_PUBLIC_APP_URL}/orders/${(order as any).id}`
        : `FLF: standing order ${order_number} submitted automatically ($${subtotal.toFixed(2)}).`,
      relatedOrderId: (order as any).id,
      relatedStandingOrderId: s.id,
    });
  }

  return { ok: true, orderId: (order as any).id };
}

function round2(n: number): number { return Math.round(n * 100) / 100; }
