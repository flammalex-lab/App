import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import type { Account, OrderGuide, OrderGuideItem, Product, Profile } from "@/lib/supabase/types";
import { allowedCategoriesFor, allowedGroupsFor } from "@/lib/constants";
import { GuideEditor } from "./GuideEditor";

export default async function AdminGuideEditPage({
  params,
}: {
  params: Promise<{ id: string; profileId: string }>;
}) {
  await requireAdmin();
  const { id: accountId, profileId } = await params;
  const svc = createServiceClient();

  const [{ data: profile }, { data: account }, { data: guideRows }] = await Promise.all([
    svc.from("profiles").select("*").eq("id", profileId).maybeSingle(),
    svc.from("accounts").select("*").eq("id", accountId).maybeSingle(),
    svc
      .from("order_guides")
      .select("*")
      .eq("profile_id", profileId)
      .eq("is_default", true)
      .order("created_at", { ascending: true })
      .limit(1),
  ]);
  if (!profile || !account) notFound();
  const a = account as Account;
  const p = profile as Profile;

  // If no default guide yet, create one on the fly
  let guide = ((guideRows as OrderGuide[] | null) ?? [])[0] ?? null;
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

  // Filter the picker to what this buyer would see on the catalog: the
  // buyer's buyer_type (or the account's as a fallback) narrows by product
  // group/category. available_b2b is NOT required here — admin picking
  // happens before catalog flags are set, and anyway the guide is a
  // curated list that can include anything.
  const effectiveBuyerType = p.buyer_type ?? a.buyer_type ?? null;
  const allowedCats = allowedCategoriesFor(effectiveBuyerType);
  const allowedGroups = allowedGroupsFor(effectiveBuyerType);
  const orExpr = [
    allowedCats.length ? `category.in.(${allowedCats.join(",")})` : null,
    allowedGroups.length ? `product_group.in.(${allowedGroups.join(",")})` : null,
  ]
    .filter(Boolean)
    .join(",");
  const { data: products } = await svc
    .from("products")
    .select("*")
    .eq("is_active", true)
    .or(orExpr)
    .order("sort_order");

  return (
    <div className="max-w-3xl">
      <Link
        href={`/admin/accounts/${accountId}/buyers/${profileId}`}
        className="text-sm text-ink-secondary hover:underline"
      >
        ← {p.first_name} {p.last_name}
      </Link>
      <h1 className="display text-3xl mt-1 mb-1">
        Order guide — {p.first_name} {p.last_name}
      </h1>
      <p className="text-sm text-ink-secondary mb-4">
        Curate the list and par levels this buyer sees as their landing page.
        Product picker is scoped to the buyer&rsquo;s type
        {effectiveBuyerType ? <> ({effectiveBuyerType.replace("_", " ")})</> : null}.
      </p>
      <GuideEditor
        guideId={guide.id}
        initialItems={(items as (OrderGuideItem & { product: Product })[] | null) ?? []}
        allProducts={(products as Product[] | null) ?? []}
      />
    </div>
  );
}
