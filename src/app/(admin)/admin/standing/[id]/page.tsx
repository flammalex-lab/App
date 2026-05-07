import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import type { Account, Product, Profile, StandingOrder, StandingOrderItem } from "@/lib/supabase/types";
import { adminPickerProductsQuery } from "@/lib/products/queries";
import { StandingOrderEditor } from "@/components/standing/StandingOrderEditor";

export default async function AdminStandingDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const svc = createServiceClient();

  const isNew = id === "new";
  const so = isNew
    ? null
    : (await svc.from("standing_orders").select("*").eq("id", id).maybeSingle()).data as StandingOrder | null;
  if (!isNew && !so) notFound();

  const items = isNew
    ? []
    : ((await svc.from("standing_order_items").select("*").eq("standing_order_id", id)).data as StandingOrderItem[] | null) ?? [];

  // Load all active accounts and their B2B buyers for the account picker
  const { data: accountRows } = await svc
    .from("accounts")
    .select("id, name, buyer_type, enabled_categories")
    .eq("status", "active")
    .order("name");
  const accountIds = (accountRows as any[] | null)?.map((a) => a.id) ?? [];
  const { data: buyerRows } = accountIds.length
    ? await svc.from("profiles").select("id, account_id, first_name, last_name").in("account_id", accountIds).eq("role", "b2b_buyer")
    : { data: [] as any[] };

  const accounts = (accountRows as any[] | null ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    buyer_type: a.buyer_type as string | null,
    enabled_categories: a.enabled_categories,
    buyers: ((buyerRows as any[] | null) ?? [])
      .filter((b) => b.account_id === a.id)
      .map((b) => ({ id: b.id, name: `${b.first_name ?? ""} ${b.last_name ?? ""}`.trim() || b.id })),
  }));

  // Scope product picker to the selected account's buyer_type if editing;
  // otherwise show the union (admin can assign any). Standing orders are
  // B2B-only so we keep the available_b2b filter.
  const selectedAccountBuyerType = so
    ? accounts.find((a) => a.id === so.account_id)?.buyer_type ?? null
    : null;
  const { data: products } = await adminPickerProductsQuery(svc, {
    buyerType: selectedAccountBuyerType,
    onlyAvailableB2B: true,
  }).order("sort_order");

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl mb-4">{isNew ? "New standing order" : "Edit standing order"}</h1>
      <StandingOrderEditor
        standingOrderId={isNew ? null : id}
        products={(products as Product[] | null) ?? []}
        initial={{
          name: so?.name ?? "Standing order",
          frequency: so?.frequency ?? "weekly",
          days_of_week: so?.days_of_week ?? [],
          require_confirmation: so?.require_confirmation ?? true,
          active: so?.active ?? true,
          items: items.map((i) => ({
            product_id: i.product_id,
            quantity: Number(i.quantity),
            notes: i.notes,
          })),
        }}
        adminContext={{
          accounts,
          accountId: so?.account_id ?? null,
          profileId: so?.profile_id ?? null,
        }}
      />
    </div>
  );
}
