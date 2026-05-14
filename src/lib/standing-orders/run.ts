import { revalidateTag } from "next/cache";
import type { StandingOrder, StandingOrderItem, Product, Account, Profile } from "@/lib/supabase/types";
import { loadPricingContext, priceForProduct } from "@/lib/utils/pricing";
import { enqueueAndSend } from "@/lib/notifications/dispatch";
import { buyerHistoryTag } from "@/lib/products/buyer-history";

export type RunStandingOrderResult =
  | { ok: true; orderId: string }
  | { ok: false; error: string; orderId?: string };

/**
 * Materialize a standing order into a draft order. If require_confirmation is
 * true, the buyer gets an SMS to confirm; otherwise it submits as pending.
 *
 * Failure semantics: every supabase write is error-checked. If `order_items`
 * insert fails after `orders` succeeded we try a compensating delete on the
 * orphan header (returning the orderId in the error result so the caller can
 * also attempt cleanup if RLS blocks the service-role delete). If
 * `standing_orders.update(last_run_date)` fails we bail with `ok:false` —
 * better to re-run next cycle than to silently lose state.
 */
export async function runStandingOrder(svc: any, standingOrderId: string): Promise<RunStandingOrderResult> {
  const { data: so, error: soErr } = await svc
    .from("standing_orders")
    .select("*, items:standing_order_items(*, product:products(*)), account:accounts(*), buyer:profiles!standing_orders_profile_id_fkey(*)")
    .eq("id", standingOrderId)
    .maybeSingle();
  if (soErr) return { ok: false, error: `standing order load failed: ${soErr.message ?? String(soErr)}` };
  if (!so) return { ok: false, error: "not found" };
  const s = so as StandingOrder & {
    items: (StandingOrderItem & { product: Product })[];
    account: Account;
    buyer: Profile;
  };
  if (!s.items?.length) return { ok: false, error: "no items" };

  // Resolve prices: overrides → assigned price list → tier. If any item is
  // unpriceable we bail out instead of silently materializing a $0 line —
  // better the run fails loudly than the customer gets a free order.
  const pricingCtx = await loadPricingContext(svc, s.account, true);
  const priced = s.items.map((it) => {
    const unitPrice = priceForProduct(it.product, pricingCtx);
    return { ...it, unitPrice };
  });
  const unpriceable = priced.find((it) => it.unitPrice == null);
  if (unpriceable) {
    return { ok: false, error: `pricing missing for ${unpriceable.product?.name ?? unpriceable.product_id}` };
  }
  const subtotal = round2(priced.reduce((acc, it) => acc + (it.unitPrice as number) * Number(it.quantity), 0));

  const { data: numRow, error: numErr } = await svc.rpc("generate_order_number");
  if (numErr) return { ok: false, error: `order number rpc failed: ${numErr.message ?? String(numErr)}` };
  const order_number = (numRow as unknown as string) ?? `FLF-${Date.now()}`;

  const { data: order, error: orderErr } = await svc
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
  if (orderErr || !order) {
    return { ok: false, error: `order create failed: ${orderErr?.message ?? "no row returned"}` };
  }
  const newOrderId = (order as any).id as string;

  const { error: itemsErr } = await svc.from("order_items").insert(priced.map((it) => ({
    order_id: newOrderId,
    product_id: it.product_id,
    quantity: it.quantity,
    unit_price: it.unitPrice as number,
    line_total: round2((it.unitPrice as number) * Number(it.quantity)),
    notes: it.notes,
  })));
  if (itemsErr) {
    // Compensating action: try to delete the just-created header so we don't
    // leave an orphan order with no line items. If the delete also fails
    // (RLS, etc.) surface the orderId in the result so the caller can clean
    // up out-of-band.
    const { error: cleanupErr } = await svc.from("orders").delete().eq("id", newOrderId);
    if (cleanupErr) {
      console.error(
        `[runStandingOrder] order_items insert failed and cleanup delete also failed for order ${newOrderId}:`,
        cleanupErr,
      );
      return {
        ok: false,
        error: `order_items insert failed: ${itemsErr.message ?? String(itemsErr)}; cleanup delete failed: ${cleanupErr.message ?? String(cleanupErr)}`,
        orderId: newOrderId,
      };
    }
    return { ok: false, error: `order_items insert failed: ${itemsErr.message ?? String(itemsErr)}` };
  }

  // The buyer just gained a new order's worth of items via the cron —
  // bust their cached buyer-history aggregate.
  revalidateTag(buyerHistoryTag(s.profile_id), "max");

  const { error: updateErr } = await svc.from("standing_orders").update({
    last_run_date: new Date().toISOString().slice(0, 10),
  }).eq("id", s.id);
  if (updateErr) {
    // We've already written the order + items, so don't roll those back. But
    // surface the failure so the caller knows the run isn't fully recorded.
    // Cron will retry next cycle since next_run_date won't have been advanced.
    console.error(
      `[runStandingOrder] last_run_date update failed for standing order ${s.id} (order ${newOrderId}):`,
      updateErr,
    );
    return {
      ok: false,
      error: `last_run_date update failed: ${updateErr.message ?? String(updateErr)}`,
      orderId: newOrderId,
    };
  }

  if (s.buyer.phone) {
    await enqueueAndSend({
      supabase: svc,
      profileId: s.profile_id,
      accountId: s.account_id,
      type: "standing_order_ready",
      channel: "sms",
      toAddress: s.buyer.phone,
      body: s.require_confirmation
        ? `FLF: standing order ${order_number} is staged — reply CONFIRM to submit or visit ${process.env.NEXT_PUBLIC_APP_URL}/orders/${newOrderId}`
        : `FLF: standing order ${order_number} submitted automatically ($${subtotal.toFixed(2)}).`,
      relatedOrderId: newOrderId,
      relatedStandingOrderId: s.id,
    });
  }

  return { ok: true, orderId: newOrderId };
}

function round2(n: number): number { return Math.round(n * 100) / 100; }
