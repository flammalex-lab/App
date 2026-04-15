import type { Account, Order, OrderItem, Product, QBSetting } from "@/lib/supabase/types";
import type { AccountingInvoice, AccountingLineItem } from "./types";

/**
 * Convert a portal Order (with items + products + account) into an
 * AccountingInvoice ready for the service layer.
 */
export function buildInvoice(input: {
  order: Order;
  items: (OrderItem & { product: Pick<Product, "category" | "name" | "pack_size" | "qb_income_account"> })[];
  account: Pick<Account, "name" | "qb_customer_name" | "qb_terms"> | null;
  parentAccount?: Pick<Account, "name" | "qb_customer_name"> | null;
  settings: QBSetting[];
}): AccountingInvoice {
  const { order, items, account, parentAccount, settings } = input;
  const kv = Object.fromEntries(settings.map((s) => [s.key, s.value]));

  const customerName = (() => {
    const child = account?.qb_customer_name ?? account?.name ?? "Unknown";
    if (parentAccount?.qb_customer_name) return `${parentAccount.qb_customer_name}:${child}`;
    return child;
  })();

  const terms = account?.qb_terms ?? kv["default_terms"] ?? "Net 30";
  const arAccount = kv["ar_account"] ?? "Accounts Receivable";

  const lines: AccountingLineItem[] = items.map((it) => {
    const catAccount = kv[`income_account.${it.product.category}`] ?? "Sales";
    const incomeAccount = it.product.qb_income_account ?? catAccount;
    return {
      description: [it.product.name, it.product.pack_size].filter(Boolean).join(" "),
      quantity: Number(it.quantity),
      unitPrice: Number(it.unit_price),
      amount: round2(Number(it.line_total)),
      incomeAccount,
      memo: it.notes ?? null,
    };
  });

  return {
    id: order.id,
    refNumber: order.order_number,
    customerName,
    date: new Date(order.created_at),
    shipDate: order.requested_delivery_date ? new Date(order.requested_delivery_date) : null,
    terms,
    arAccount,
    lines,
    memo: order.internal_notes ?? null,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
