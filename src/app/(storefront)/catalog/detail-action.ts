"use server";

import { getSession } from "@/lib/auth/session";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import type { Account, Product } from "@/lib/supabase/types";
import { isProductVisibleToAccount } from "@/lib/products/queries";
import { allowedGroupsFor, allowedCategoriesFor, type ProductGroup } from "@/lib/constants";
import { loadGroupedPacks } from "./[id]/packs";
import type { PackRow } from "./[id]/packs";

export type ProductDetailPayload =
  | {
      ok: true;
      product: Product;
      packs: PackRow[];
      groupedProductCount: number;
      isB2B: boolean;
      inGuide: boolean;
    }
  | { ok: false; reason: "unauthorized" | "not_found" | "hidden" };

/**
 * Load full product-detail data for the buyer-facing sheet modal.
 * Mirrors the auth + visibility + grouped-packs flow that used to live in
 * `/catalog/[id]/page.tsx`, repackaged as a server action so the
 * client-state ProductDetailSheet can call it without a route push.
 *
 * Returns the same shape on every call (no streaming, no Suspense
 * boundaries); the sheet renders a small skeleton until it resolves.
 */
export async function loadProductDetail(productId: string): Promise<ProductDetailPayload> {
  const session = await getSession();
  if (!session) return { ok: false, reason: "unauthorized" };

  const impersonating = session.profile.role === "admin" ? await getImpersonation() : null;
  const db = impersonating ? createServiceClient() : await createClient();

  const profileId = impersonating ?? session.userId;
  const { data: me } = await db.from("profiles").select("*").eq("id", profileId).maybeSingle();
  if (!me) return { ok: false, reason: "unauthorized" };

  const { data: product } = await db
    .from("products")
    .select("*")
    .eq("id", productId)
    .maybeSingle();
  if (!product) return { ok: false, reason: "not_found" };
  const p = product as Product;

  const { data: acctRow } = me.account_id
    ? await db.from("accounts").select("*").eq("id", me.account_id).maybeSingle()
    : { data: null as Account | null };
  const account = acctRow as Account | null;
  const isB2B = me.role === "b2b_buyer";

  // Visibility gate — same as /catalog/[id]/page.tsx
  if (!impersonating) {
    const buyerType = me.buyer_type ?? account?.buyer_type ?? null;
    const allowedGroups = allowedGroupsFor(buyerType);
    const allowedCats = allowedCategoriesFor(buyerType);
    const groupOk = p.product_group
      ? allowedGroups.includes(p.product_group as ProductGroup)
      : allowedCats.includes(p.category);
    const channelOk = isB2B ? p.available_b2b : p.available_dtc;
    const visibilityOk = await isProductVisibleToAccount(db, p, account?.id ?? null);
    if (!p.is_active || !channelOk || !groupOk || !visibilityOk) {
      return { ok: false, reason: "hidden" };
    }
  }

  const { packs, products: groupedProducts } = await loadGroupedPacks(db, p, {
    account,
    isB2B,
    impersonating: Boolean(impersonating),
  });

  // Is this product already in the buyer's order guide?
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
        .eq("product_id", productId)
        .maybeSingle();
      inGuide = Boolean(existing);
    }
  }

  return {
    ok: true,
    product: p,
    packs,
    groupedProductCount: groupedProducts.length,
    isB2B,
    inGuide,
  };
}
