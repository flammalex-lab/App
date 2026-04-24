import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import { resolveActiveAccount } from "@/lib/auth/active-account";
import { StoreNav } from "@/components/layout/StoreNav";
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
      {modal}
      <footer className="hidden md:block px-6 py-8 text-xs text-ink-secondary border-t border-black/5">
        © Fingerlakes Farms — ilovenyfarms.com
      </footer>
    </div>
  );
}
