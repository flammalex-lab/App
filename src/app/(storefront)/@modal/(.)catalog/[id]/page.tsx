import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import type { Account, AccountPricing, PackOption, Product } from "@/lib/supabase/types";
import { resolvePrice } from "@/lib/utils/pricing";
import { defaultPackRow, optionPackRow, type PackRow } from "@/app/(storefront)/catalog/[id]/packs";
import { ProductModal } from "./ProductModal";

export default async function InterceptedProductDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const impersonating = session.profile.role === "admin" ? getImpersonation() : null;
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

  const { data: override } = account
    ? await db
        .from("account_pricing")
        .select("*")
        .eq("account_id", account.id)
        .eq("product_id", id)
        .maybeSingle()
    : { data: null as AccountPricing | null };
  const customPrice = override as AccountPricing | null;

  const defaultPrice = resolvePrice(p, { account, customPrice, isB2B });
  const packs: PackRow[] = [];
  if (defaultPrice != null) packs.push(defaultPackRow(p, defaultPrice));
  for (const opt of ((p.pack_options as PackOption[] | null) ?? [])) {
    const price = resolvePrice(
      { wholesale_price: opt.wholesale_price, retail_price: opt.retail_price },
      { account, customPrice, isB2B },
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
