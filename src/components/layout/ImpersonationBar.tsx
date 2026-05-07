import Link from "next/link";
import { getImpersonation } from "@/lib/auth/impersonation";
import { createServiceClient } from "@/lib/supabase/server";

export async function ImpersonationBar() {
  const targetId = getImpersonation();
  if (!targetId) return null;
  const supa = createServiceClient();
  const { data } = await supa
    .from("profiles")
    .select("first_name,last_name,email,phone,account_id")
    .eq("id", targetId)
    .maybeSingle();
  const name = data ? `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() || data.email || data.phone : targetId;
  return (
    <div className="bg-accent-gold/20 text-[#6a4d06] text-sm px-4 py-2 flex items-center justify-between">
      <span>
        Viewing as <strong>{name}</strong>
      </span>
      <form action="/api/admin/impersonate/stop" method="post">
        <button className="underline text-xs">Stop viewing as buyer</button>
      </form>
    </div>
  );
}
