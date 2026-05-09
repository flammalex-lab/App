import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import type { Account, PriceList, PriceListItem, Product } from "@/lib/supabase/types";
import { adminPickerProductsQuery } from "@/lib/products/queries";
import { PriceListEditor } from "./PriceListEditor";

export default async function PriceListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const svc = createServiceClient();

  // Always pull every B2B-available product so admins can build new lines.
  // Buyer-type isn't applied here — a price list isn't account-scoped.
  const productsP = adminPickerProductsQuery(svc, {
    buyerType: null,
    onlyAvailableB2B: true,
  }).order("name", { ascending: true });

  if (id === "new") {
    const { data: products } = await productsP;
    return (
      <div className="max-w-3xl">
        <Link href="/admin/price-lists" className="text-sm text-ink-secondary hover:underline">
          ← Price lists
        </Link>
        <h1 className="text-3xl mt-1 mb-1">New price list</h1>
        <PriceListEditor
          list={null}
          items={[]}
          accountsUsing={[]}
          products={(products as Product[] | null) ?? []}
        />
      </div>
    );
  }

  const [{ data: list }, { data: items }, { data: accountsUsing }, { data: products }] =
    await Promise.all([
      svc.from("price_lists").select("*").eq("id", id).maybeSingle(),
      svc.from("price_list_items").select("*").eq("price_list_id", id),
      svc.from("accounts").select("id, name").eq("price_list_id", id).order("name"),
      productsP,
    ]);

  if (!list) notFound();

  return (
    <div className="max-w-3xl">
      <Link href="/admin/price-lists" className="text-sm text-ink-secondary hover:underline">
        ← Price lists
      </Link>
      <h1 className="text-3xl mt-1 mb-1">{(list as PriceList).name}</h1>
      <PriceListEditor
        list={list as PriceList}
        items={(items as PriceListItem[] | null) ?? []}
        accountsUsing={
          ((accountsUsing as Pick<Account, "id" | "name">[] | null) ?? [])
        }
        products={(products as Product[] | null) ?? []}
      />
    </div>
  );
}
