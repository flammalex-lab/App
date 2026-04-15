import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import type { Account, AccountPricing, Product } from "@/lib/supabase/types";
import { AccountPricingEditor } from "./AccountPricingEditor";

export default async function AccountPricingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const svc = createServiceClient();

  const { data: account } = await svc.from("accounts").select("*").eq("id", id).maybeSingle();
  if (!account) notFound();

  const [{ data: overrides }, { data: products }] = await Promise.all([
    svc.from("account_pricing").select("*").eq("account_id", id),
    svc
      .from("products")
      .select("*")
      .eq("is_active", true)
      .eq("available_b2b", true)
      .in("category", (account as Account).enabled_categories)
      .order("sort_order"),
  ]);

  return (
    <div className="max-w-3xl">
      <Link href={`/admin/accounts/${id}`} className="text-sm text-ink-secondary hover:underline">
        ← {(account as Account).name}
      </Link>
      <h1 className="text-3xl mt-1 mb-1">Account pricing</h1>
      <p className="text-sm text-ink-secondary mb-4">
        Custom prices for this account. Leave blank to use the tier price.
      </p>
      <AccountPricingEditor
        accountId={id}
        tier={(account as Account).pricing_tier}
        products={(products as Product[] | null) ?? []}
        overrides={(overrides as AccountPricing[] | null) ?? []}
      />
    </div>
  );
}
