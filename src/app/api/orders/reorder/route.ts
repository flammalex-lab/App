import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const orderId = new URL(request.url).searchParams.get("orderId");
  if (!orderId) return NextResponse.json({ error: "missing orderId" }, { status: 400 });

  const impersonating = session.profile.role === "admin" ? getImpersonation() : null;
  const db = impersonating ? createServiceClient() : await createClient();

  const { data: items } = await db
    .from("order_items")
    .select("*, product:products(*)")
    .eq("order_id", orderId);

  const lines = ((items as any[]) ?? []).map((r) => ({
    productId: r.product_id,
    variantKey: r.pack_variant_key ?? null,
    variantSku: r.pack_variant_sku ?? null,
    sku: r.product?.sku ?? null,
    name: r.product?.name,
    packSize: r.product?.pack_size,
    unit: r.product?.unit,
    unitPrice: Number(r.unit_price),
    priceByWeight: Boolean(r.product?.price_by_weight),
    quantity: Number(r.quantity),
    notes: r.notes ?? undefined,
  }));

  // Build the redirect response and set the cookie directly on it.
  // (Using cookies() from next/headers inside a route handler that also
  // returns NextResponse.redirect() can fail — Next 14 treats the store
  // as immutable in that path. Setting on the response is always OK.)
  const response = NextResponse.redirect(new URL("/cart?reorder=1", request.url), {
    status: 303,
  });
  response.cookies.set("flf-reorder", JSON.stringify(lines), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 300,
  });
  return response;
}
