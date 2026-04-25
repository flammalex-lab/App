import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import { resolveActiveAccount } from "@/lib/auth/active-account";
import { StoreNav } from "@/components/layout/StoreNav";
import { StickyCartBar } from "@/components/layout/StickyCartBar";
import { CutoffClock } from "@/components/CutoffClock";
import { nextDeliveryForZone } from "@/lib/utils/cutoff";
import type { DeliveryZoneRow, Profile } from "@/lib/supabase/types";

export default async function StorefrontLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const impersonating = session.profile.role === "admin" ? getImpersonation() : null;
  let effective: Profile = session.profile;
  if (impersonating) {
    const svc = createServiceClient();
    const { data } = await svc.from("profiles").select("*").eq("id", impersonating).maybeSingle();
    if (data) effective = data as Profile;
  }

  if (effective.role === "admin") redirect("/dashboard");

  const { active: activeAccount, memberships } = await resolveActiveAccount(
    effective.id,
    effective.account_id,
  );

  let zone: DeliveryZoneRow | null = null;
  if (activeAccount?.delivery_zone) {
    const svc = createServiceClient();
    const { data: z } = await svc
      .from("delivery_zones")
      .select("*")
      .eq("zone", activeAccount.delivery_zone)
      .maybeSingle();
    zone = (z as DeliveryZoneRow) ?? null;
  }

  const nextDel = zone ? nextDeliveryForZone(zone) : null;
  const serialized = nextDel
    ? {
        deliveryDate: nextDel.deliveryDate.toISOString(),
        cutoffAt: nextDel.cutoffAt.toISOString(),
        deliveryDayName: nextDel.deliveryDayName,
      }
    : null;

  return (
    <div className="min-h-screen flex flex-col">
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
      {effective.role === "b2b_buyer" ? <CutoffClock next={serialized} /> : null}
      <StoreNav
        profile={effective}
        activeAccount={activeAccount}
        memberships={memberships}
      />
      <main className="flex-1 px-0 md:px-6 lg:px-8 py-1 pb-32">{children}</main>
      <StickyCartBar />
      {modal}
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
              <li><a href="/catalog" className="hover:text-ink-primary">Catalog</a></li>
              <li><a href="/guide" className="hover:text-ink-primary">My order guide</a></li>
              <li><a href="/orders" className="hover:text-ink-primary">My orders</a></li>
              <li><a href="/standing" className="hover:text-ink-primary">Standing orders</a></li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-tertiary mb-2">
              Support
            </div>
            <ul className="space-y-1.5 text-ink-secondary">
              <li><a href="/chat" className="hover:text-ink-primary">Chat with your rep</a></li>
              <li><a href="mailto:alex@ilovenyfarms.com" className="hover:text-ink-primary">alex@ilovenyfarms.com</a></li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-tertiary mb-2">
              Legal
            </div>
            <ul className="space-y-1.5 text-ink-secondary">
              <li><a href="/privacy" className="hover:text-ink-primary">Privacy Policy</a></li>
              <li><a href="/terms" className="hover:text-ink-primary">Terms</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-black/[0.06]">
          <div className="max-w-screen-xl mx-auto px-6 lg:px-8 py-4 text-xs text-ink-tertiary flex flex-wrap justify-between gap-2">
            <span>© {new Date().getFullYear()} Fingerlakes Farms · ilovenyfarms.com</span>
            <span>Made in the Finger Lakes, NY</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
