import Link from "next/link";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import { resolveActiveAccount } from "@/lib/auth/active-account";
import { StoreNav } from "@/components/layout/StoreNav";
import { StickyCartBar } from "@/components/layout/StickyCartBar";
import { CartHydrationGate } from "@/components/CartHydrationGate";
import { CutoffClock } from "@/components/CutoffClock";
import { nextDeliveryForZone } from "@/lib/utils/cutoff";
import { effectiveOrderMinimum } from "@/lib/utils/order-minimum";
import { BUSINESS_TIMEZONE } from "@/lib/constants";
import type { Account, DeliveryZone, DeliveryZoneRow, Profile } from "@/lib/supabase/types";
import { ProductDetailSheet } from "@/components/products/ProductDetailSheet";

// M20: impersonation profile re-fetch. Wrapped in React `cache()` so any
// other helper that needs the same impersonated profile in the same
// request reuses this read instead of issuing a fresh round-trip.
const fetchImpersonatedProfile = cache(async (impersonatedId: string) => {
  const svc = createServiceClient();
  const { data } = await svc
    .from("profiles")
    .select("*")
    .eq("id", impersonatedId)
    .maybeSingle();
  return (data as Profile | null) ?? null;
});

// M20: delivery_zones is admin-curated and effectively static between
// admin edits — wrap the per-zone lookup in `unstable_cache` so the
// storefront layout doesn't pay for a fresh round-trip on every nav.
// Tagged "delivery-zones" so a future admin save path can invalidate
// the whole set (no obvious save path exists yet, hence no invalidation
// call here); 1h revalidate is a defensive fallback.
const fetchDeliveryZone = (zoneKey: string) =>
  unstable_cache(
    async () => {
      // RLS on delivery_zones is `select using (true)` (see 0002_rls.sql) —
      // regular authed client is sufficient. Use the service client here
      // since unstable_cache runs outside the per-request cookie context.
      const svc = createServiceClient();
      const { data } = await svc
        .from("delivery_zones")
        .select("*")
        .eq("zone", zoneKey as DeliveryZone)
        .maybeSingle();
      return data;
    },
    ["delivery-zone", zoneKey],
    { tags: ["delivery-zones"], revalidate: 3600 },
  )();

export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const impersonating = session.profile.role === "admin" ? await getImpersonation() : null;
  let effective: Profile = session.profile;
  if (impersonating) {
    const data = await fetchImpersonatedProfile(impersonating);
    if (data) effective = data;
  }

  if (effective.role === "admin") redirect("/dashboard");

  const { active: activeAccount, memberships } = await resolveActiveAccount(
    effective.id,
    effective.account_id,
  );

  let zone: DeliveryZoneRow | null = null;
  if (activeAccount?.delivery_zone) {
    zone = await fetchDeliveryZone(activeAccount.delivery_zone);
  }

  const nextDel = zone
    ? nextDeliveryForZone(zone, new Date(), BUSINESS_TIMEZONE, activeAccount?.delivery_days)
    : null;
  const serialized = nextDel
    ? {
        deliveryDate: nextDel.deliveryDate.toISOString(),
        cutoffAt: nextDel.cutoffAt.toISOString(),
        deliveryDayName: nextDel.deliveryDayName,
        pastCutoff: nextDel.pastCutoff,
      }
    : null;
  // Pill state inputs — minimum + fee are layout-stable, so we resolve them
  // once at the layout level instead of refetching on /guide.
  const accountMinimum = effectiveOrderMinimum(activeAccount as Account | null, zone);
  const deliveryFee = zone?.delivery_fee ?? 0;

  return (
    <div className="min-h-screen flex flex-col">
      {/* H13: rebind the persisted cart to this buyer's localStorage
          slot before any cart-reading component reads it. Admin
          impersonating a buyer? Scope to the impersonated profile so
          the cart they build belongs to that buyer, not the admin. */}
      <CartHydrationGate userId={effective.id} />
      {impersonating ? (
        <div className="bg-accent-gold/25 text-[#6a4d06] text-[11px] px-3 py-0.5 flex items-center justify-center gap-2 border-b border-accent-gold/30">
          <span>
            Admin view · acting as {effective.first_name} {effective.last_name}
          </span>
          <form action="/api/admin/impersonate/stop" method="post">
            <button className="underline font-semibold">Stop</button>
          </form>
        </div>
      ) : null}
      {effective.role === "b2b_buyer" ? (
        <div className="hidden md:block">
          <CutoffClock next={serialized} />
        </div>
      ) : null}
      <StoreNav
        profile={effective}
        activeAccount={activeAccount}
        memberships={memberships}
        next={serialized}
      />
      {/* overflow-x-clip on main so the bleed-out scroll strips
          (-mx-4 inside ScrollStrip / CategoryChips) don't cause the
          whole page to scroll horizontally. The strips themselves
          still scroll internally via overflow-x-auto. */}
      <main className="flex-1 px-4 md:px-6 lg:px-8 py-1 pb-32 overflow-x-clip">
        {children}
      </main>
      <StickyCartBar
        next={serialized}
        accountMinimum={accountMinimum}
        deliveryFee={deliveryFee}
      />
      <ProductDetailSheet />
      <footer className="hidden md:block border-t border-black/[0.06] mt-8 bg-white">
        <div className="max-w-screen-xl mx-auto px-6 lg:px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
          <div className="col-span-2 md:col-span-1">
            <div className="display text-base tracking-tight">Fingerlakes Farms</div>
            <p className="text-xs text-ink-secondary mt-2 leading-relaxed max-w-xs">
              Local connection to great-tasting, healthy food from the
              Finger Lakes region. Trust our process. Trust your food.
            </p>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-tertiary mb-2">
              Shop
            </div>
            <ul className="space-y-1.5 text-ink-secondary">
              <li><Link href="/catalog" className="hover:text-ink-primary">Catalog</Link></li>
              <li><Link href="/guide" className="hover:text-ink-primary">My order guide</Link></li>
              <li><Link href="/orders" className="hover:text-ink-primary">My orders</Link></li>
              <li><Link href="/standing" className="hover:text-ink-primary">Standing orders</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-tertiary mb-2">
              Support
            </div>
            <ul className="space-y-1.5 text-ink-secondary">
              <li><a href="mailto:orders@ilovenyfarms.com" className="hover:text-ink-primary">Email any questions to orders@ilovenyfarms.com</a></li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-tertiary mb-2">
              Legal
            </div>
            <ul className="space-y-1.5 text-ink-secondary">
              <li><Link href="/privacy" className="hover:text-ink-primary">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-ink-primary">Terms</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-black/[0.06]">
          <div className="max-w-screen-xl mx-auto px-6 lg:px-8 py-4 text-xs text-ink-tertiary flex flex-wrap justify-between gap-2">
            <span>© {new Date().getFullYear()} Fingerlakes Farms · ilovenyfarms.com</span>
            <span>Seneca Falls, NY</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
