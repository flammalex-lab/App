import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import { cookies } from "next/headers";

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
    sku: r.product?.sku,
    name: r.product?.name,
    packSize: r.product?.pack_size,
    unit: r.product?.unit,
    unitPrice: Number(r.unit_price),
    quantity: Number(r.quantity),
    notes: r.notes ?? undefined,
  }));

  // Seed the client-side cart store via a cookie the cart page will honor.
  cookies().set("flf-reorder", JSON.stringify(lines), { httpOnly: false, path: "/", maxAge: 300 });
  return NextResponse.redirect(new URL("/cart?reorder=1", request.url), { status: 303 });
}
