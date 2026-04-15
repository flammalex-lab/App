import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import type { Account, Product, StandingOrder, StandingOrderItem } from "@/lib/supabase/types";
import { StandingOrderEditor } from "@/components/standing/StandingOrderEditor";

export default async function StandingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  const impersonating = session.profile.role === "admin" ? getImpersonation() : null;
  const db = impersonating ? createServiceClient() : await createClient();
  const profileId = impersonating ?? session.userId;

  const { data: so } = await db.from("standing_orders").select("*").eq("id", id).maybeSingle();
  if (!so) notFound();
  if ((so as StandingOrder).profile_id !== profileId && session.profile.role !== "admin") redirect("/standing");

  const { data: me } = await db.from("profiles").select("*").eq("id", (so as StandingOrder).profile_id).maybeSingle();
  const { data: account } = me?.account_id
    ? await db.from("accounts").select("*").eq("id", me.account_id).maybeSingle()
    : { data: null as Account | null };

  const { data: items } = await db.from("standing_order_items").select("*").eq("standing_order_id", id);
  const { data: products } = await db
    .from("products")
    .select("*")
    .eq("is_active", true)
    .eq("available_b2b", true)
    .in("category", (account as Account | null)?.enabled_categories ?? ["beef", "pork", "eggs", "dairy", "produce"])
    .order("sort_order");

  const s = so as StandingOrder;
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl mb-4">Edit standing order</h1>
      <StandingOrderEditor
        standingOrderId={id}
        products={(products as Product[] | null) ?? []}
        initial={{
          name: s.name ?? "",
          frequency: s.frequency,
          days_of_week: s.days_of_week,
          require_confirmation: s.require_confirmation,
          active: s.active,
          items: ((items as StandingOrderItem[] | null) ?? []).map((i) => ({
            product_id: i.product_id,
            quantity: Number(i.quantity),
            notes: i.notes,
          })),
        }}
      />
    </div>
  );
}
