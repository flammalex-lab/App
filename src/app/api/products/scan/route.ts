import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import { resolveActiveAccount } from "@/lib/auth/active-account";
import { allowedGroupsFor } from "@/lib/constants";
import type { Product } from "@/lib/supabase/types";
import { resolvePrice } from "@/lib/utils/pricing";

/**
 * Look up a product by scanned barcode. Matches UPC first, SKU second.
 * Respects the buyer's allowed product groups so a buyer who can only
 * see produce can't accidentally add a random meat item by scanning it.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const code = (searchParams.get("code") ?? "").trim();
  if (!code) return NextResponse.json({ error: "missing code" }, { status: 400 });

  const impersonating = session.profile.role === "admin" ? getImpersonation() : null;
  const profileId = impersonating ?? session.userId;
  const db = impersonating ? createServiceClient() : await createClient();

  const { data: meRow } = await db
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .maybeSingle();
  if (!meRow) return NextResponse.json({ error: "profile not found" }, { status: 404 });
  const me = meRow as any;

  // Lookup: UPC match first, then SKU. Case-insensitive for both.
  const { data: candidatesRaw } = await db
    .from("products")
    .select("*")
    .or(`upc.ilike.${code},sku.ilike.${code}`)
    .eq("is_active", true);
  const candidates = (candidatesRaw as Product[] | null) ?? [];
  if (candidates.length === 0) {
    return NextResponse.json({ ok: false, reason: "not_found", code }, { status: 404 });
  }

  // Prefer UPC match if one exists; else first SKU match.
  const upcMatch = candidates.find(
    (p) => p.upc && p.upc.toLowerCase() === code.toLowerCase(),
  );
  const product = upcMatch ?? candidates[0];

  // Respect buyer_type scope so a produce-only buyer scanning a meat UPC
  // gets a clean rejection instead of silently adding out-of-scope items
  // to their cart. Also enforce the channel gate here — the UPC lookup
  // itself doesn't filter on available_b2b/available_dtc since we want a
  // clear "not available in your channel" response rather than "not found."
  const { active } = await resolveActiveAccount(profileId, me.account_id);
  const effectiveBuyerType = me.buyer_type ?? active?.buyer_type ?? null;
  const allowed = allowedGroupsFor(effectiveBuyerType);
  const isB2B = me.role === "b2b_buyer";
  const channelOk = isB2B ? product.available_b2b : product.available_dtc;
  if (!channelOk) {
    return NextResponse.json(
      { ok: false, reason: "not_available", productName: product.name },
      { status: 403 },
    );
  }
  if (
    isB2B &&
    product.product_group &&
    !allowed.includes(product.product_group as any)
  ) {
    return NextResponse.json(
      {
        ok: false,
        reason: "out_of_scope",
        productName: product.name,
        productGroup: product.product_group,
      },
      { status: 403 },
    );
  }

  // Price resolution — same logic as catalog / guide.
  const account = active;
  const { data: overrideRaw } = account
    ? await db
        .from("account_pricing")
        .select("*")
        .eq("account_id", account.id)
        .eq("product_id", product.id)
        .maybeSingle()
    : { data: null as any };
  const customPrice = overrideRaw;
  const unitPrice = resolvePrice(product, { account, customPrice, isB2B });

  return NextResponse.json({
    ok: true,
    product: {
      id: product.id,
      sku: product.sku,
      upc: product.upc,
      name: product.name,
      pack_size: product.pack_size,
      unit: product.unit,
      image_url: product.image_url,
      price_by_weight: product.price_by_weight,
      unitPrice,
    },
  });
}
