import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import { StoreNav } from "@/components/layout/StoreNav";
import type { Profile } from "@/lib/supabase/types";

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  // Resolve effective profile (admin may be impersonating)
  const impersonating = session.profile.role === "admin" ? getImpersonation() : null;
  let effective: Profile = session.profile;
  if (impersonating) {
    const svc = createServiceClient();
    const { data } = await svc.from("profiles").select("*").eq("id", impersonating).maybeSingle();
    if (data) effective = data as Profile;
  }

  if (effective.role === "admin") redirect("/dashboard");

  return (
    <div className="min-h-screen flex flex-col">
      {impersonating ? (
        <div className="bg-accent-gold/20 text-[#6a4d06] text-sm px-4 py-2 flex items-center justify-between">
          <span>
            Admin view — acting as {effective.first_name} {effective.last_name}
          </span>
          <form action="/api/admin/impersonate/stop" method="post">
            <button className="underline">Stop</button>
          </form>
        </div>
      ) : null}
      <StoreNav role={effective.role === "dtc_customer" ? "dtc_customer" : "b2b_buyer"} />
      <main className="flex-1 px-4 md:px-6 py-6 pb-24">{children}</main>
      <footer className="hidden md:block px-6 py-8 text-xs text-ink-secondary border-t border-black/5">
        © Fingerlakes Farms — ilovenyfarms.com
      </footer>
    </div>
  );
}
