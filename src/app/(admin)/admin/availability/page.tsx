import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/lib/supabase/types";
import { AvailabilityToggle } from "./AvailabilityToggle";
import { BRAND_LABELS, CATEGORY_LABELS } from "@/lib/constants";

export const metadata = { title: "Admin — Weekly availability" };

export default async function AvailabilityPage() {
  const db = await createClient();
  const { data } = await db.from("products").select("*").eq("is_active", true).order("category").order("sort_order");
  const grouped: Record<string, Product[]> = {};
  for (const p of (data as Product[] | null) ?? []) (grouped[p.category] ??= []).push(p);

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl mb-2">Weekly availability</h1>
      <p className="text-sm text-ink-secondary mb-4">
        Toggle what&apos;s in this week. Items that are off still appear in the catalog with a &ldquo;limited&rdquo; tag but can&apos;t be added to cart.
      </p>
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} className="mb-6">
          <h2 className="font-serif text-lg mb-2">{CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]}</h2>
          <div className="card divide-y divide-black/5">
            {items.map((p) => (
              <div key={p.id} className="p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-ink-secondary">{BRAND_LABELS[p.brand]} · {p.pack_size ?? ""}</div>
                </div>
                <AvailabilityToggle productId={p.id} initial={p.available_this_week} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
