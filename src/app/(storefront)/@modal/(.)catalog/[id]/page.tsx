import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import type { Account, AccountPricing, PackOption, PriceListItem, Product } from "@/lib/supabase/types";
import { resolvePrice } from "@/lib/utils/pricing";
import { isProductVisibleToAccount } from "@/lib/products/queries";
import { allowedGroupsFor, allowedCategoriesFor, type ProductGroup } from "@/lib/constants";
import { defaultPackRow, optionPackRow, type PackRow } from "@/app/(storefront)/catalog/[id]/packs";
import { ProductModal } from "./ProductModal";

export default async function InterceptedProductDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const impersonating = session.profile.role === "admin" ? await getImpersonation() : null;
  const db = impersonating ? createServiceClient() : await createClient();

  const profileId = impersonating ?? session.userId;
  const { data: me } = await db.from("profiles").select("*").eq("id", profileId).maybeSingle();
  if (!me) redirect("/login");

  const { id } = await params;
  const { data: product } = await db.from("products").select("*").eq("id", id).maybeSingle();
  if (!product) notFound();
  const p = product as Product;

  const { data: acctRow } = me.account_id
    ? await db.from("accounts").select("*").eq("id", me.account_id).maybeSingle()
    : { data: null as Account | null };
  const account = acctRow as Account | null;
  const isB2B = me.role === "b2b_buyer";

  // Visibility gate — mirror /catalog/[id] so a crafted modal URL can't
  // bypass buyer_type / channel / is_active / private checks.
  if (!impersonating) {
    const buyerType = me.buyer_type ?? account?.buyer_type ?? null;
    const groupOk = p.product_group
      ? allowedGroupsFor(buyerType).includes(p.product_group as ProductGroup)
      : allowedCategoriesFor(buyerType).includes(p.category);
    const channelOk = isB2B ? p.available_b2b : p.available_dtc;
    const visibilityOk = await isProductVisibleToAccount(db, p, account?.id ?? null);
    if (!p.is_active || !channelOk || !groupOk || !visibilityOk) notFound();
  }

  const [overrideRes, listItemRes] = await Promise.all([
    account
      ? db
          .from("account_pricing")
          .select("*")
          .eq("account_id", account.id)
          .eq("product_id", id)
          .maybeSingle()
      : Promise.resolve({ data: null as AccountPricing | null }),
    account?.price_list_id
      ? db
          .from("price_list_items")
          .select("*")
          .eq("price_list_id", account.price_list_id)
          .eq("product_id", id)
          .maybeSingle()
      : Promise.resolve({ data: null as PriceListItem | null }),
  ]);
  const customPrice = overrideRes.data as AccountPricing | null;
  const priceListItem = listItemRes.data as PriceListItem | null;

  const defaultPrice = resolvePrice(p, { account, customPrice, priceListItem, isB2B });
  const packs: PackRow[] = [];
  if (defaultPrice != null) packs.push(defaultPackRow(p, defaultPrice));
  for (const opt of ((p.pack_options as PackOption[] | null) ?? [])) {
    const price = resolvePrice(
      { wholesale_price: opt.wholesale_price, retail_price: opt.retail_price },
      { account, customPrice, priceListItem, isB2B },
    );
    if (price != null) packs.push(optionPackRow(p, opt, price));
  }

  let inGuide = false;
  if (isB2B) {
    const { data: guideRows } = await db
      .from("order_guides")
      .select("id")
      .eq("profile_id", profileId)
      .eq("is_default", true);
    const guideId = (guideRows as { id: string }[] | null)?.[0]?.id;
    if (guideId) {
      const { data: existing } = await db
        .from("order_guide_items")
        .select("id")
        .eq("order_guide_id", guideId)
        .eq("product_id", id)
        .maybeSingle();
      inGuide = Boolean(existing);
    }
  }

  return (
    <ProductModal
      product={p}
      packs={packs}
      showAddToGuide={isB2B}
      inGuideInitial={inGuide}
    />
  );
}
