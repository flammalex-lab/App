import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import type { Account, AccountPricing, PriceList, PriceListItem, Product } from "@/lib/supabase/types";
import { adminPickerProductsQuery } from "@/lib/products/queries";
import { AccountPricingEditor } from "./AccountPricingEditor";

export default async function AccountPricingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const svc = createServiceClient();

  const { data: account } = await svc.from("accounts").select("*").eq("id", id).maybeSingle();
  if (!account) notFound();
  const a = account as Account;

  const [{ data: overrides }, { data: products }, listResult, listItemsResult] = await Promise.all([
    svc.from("account_pricing").select("*").eq("account_id", id),
    adminPickerProductsQuery(svc, {
      buyerType: a.buyer_type,
      onlyAvailableB2B: true,
    }).order("sort_order"),
    a.price_list_id
      ? svc.from("price_lists").select("*").eq("id", a.price_list_id).maybeSingle()
      : Promise.resolve({ data: null as PriceList | null }),
    a.price_list_id
      ? svc.from("price_list_items").select("*").eq("price_list_id", a.price_list_id)
      : Promise.resolve({ data: [] as PriceListItem[] }),
  ]);

  return (
    <div className="max-w-3xl">
      <Link href={`/admin/accounts/${id}`} className="text-sm text-ink-secondary hover:underline">
        ← {a.name}
      </Link>
      <h1 className="text-3xl mt-1 mb-1">Account pricing</h1>
      <p className="text-sm text-ink-secondary mb-4">
        Account-specific overrides. Leave blank to fall through to{" "}
        {listResult.data ? (
          <>
            the assigned price list (
            <Link href={`/admin/price-lists/${a.price_list_id}`} className="underline">
              {(listResult.data as PriceList).name}
            </Link>
            ) or the tier multiplier.
          </>
        ) : (
          <>the tier multiplier.</>
        )}
      </p>
      <AccountPricingEditor
        accountId={id}
        tier={a.pricing_tier}
        products={(products as Product[] | null) ?? []}
        overrides={(overrides as AccountPricing[] | null) ?? []}
        priceList={listResult.data as PriceList | null}
        priceListItems={(listItemsResult.data as PriceListItem[] | null) ?? []}
      />
    </div>
  );
}
