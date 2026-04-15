import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import type { OrderGuide, OrderGuideItem, Product, Profile } from "@/lib/supabase/types";
import { GuideEditor } from "./GuideEditor";

export default async function AdminGuideEditPage({
  params,
}: {
  params: Promise<{ id: string; profileId: string }>;
}) {
  await requireAdmin();
  const { id: accountId, profileId } = await params;
  const svc = createServiceClient();

  const [{ data: profile }, { data: account }, { data: guideRow }] = await Promise.all([
    svc.from("profiles").select("*").eq("id", profileId).maybeSingle(),
    svc.from("accounts").select("name, enabled_categories").eq("id", accountId).maybeSingle(),
    svc.from("order_guides").select("*").eq("profile_id", profileId).eq("is_default", true).maybeSingle(),
  ]);
  if (!profile || !account) notFound();

  // If no default guide yet, create one on the fly
  let guide = guideRow as OrderGuide | null;
  if (!guide) {
    const { data: created } = await svc
      .from("order_guides")
      .insert({ profile_id: profileId, name: "My order guide", is_default: true })
      .select("*")
      .single();
    guide = created as OrderGuide;
  }

  const { data: items } = await svc
    .from("order_guide_items")
    .select("*, product:products(*)")
    .eq("order_guide_id", guide.id)
    .order("sort_order");

  const { data: products } = await svc
    .from("products")
    .select("*")
    .eq("is_active", true)
    .in("category", (account as any).enabled_categories)
    .eq("available_b2b", true)
    .order("sort_order");

  return (
    <div className="max-w-3xl">
      <Link href={`/admin/accounts/${accountId}`} className="text-sm text-ink-secondary hover:underline">
        ← {(account as any).name}
      </Link>
      <h1 className="text-3xl mt-1 mb-1">
        Order guide — {(profile as Profile).first_name} {(profile as Profile).last_name}
      </h1>
      <p className="text-sm text-ink-secondary mb-4">
        Curate the list and par levels this buyer sees as their landing page.
      </p>
      <GuideEditor
        guideId={guide.id}
        initialItems={(items as (OrderGuideItem & { product: Product })[] | null) ?? []}
        allProducts={(products as Product[] | null) ?? []}
      />
    </div>
  );
}
