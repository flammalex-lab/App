import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/utils/phone";

interface Row {
  name: string;
  phone?: string;
  email?: string;
  terms?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  zip?: string;
}

export async function POST(request: Request) {
  try { await requireAdmin(); } catch { return NextResponse.json({ error: "admin only" }, { status: 403 }); }
  const { rows } = (await request.json()) as { rows: Row[] };
  const svc = createServiceClient();
  let created = 0;
  let skipped = 0;
  for (const r of rows) {
    const { data: existing } = await svc.from("accounts").select("id").eq("qb_customer_name", r.name).maybeSingle();
    if (existing) { skipped++; continue; }
    await svc.from("accounts").insert({
      name: r.name,
      type: "restaurant",
      channel: "foodservice",
      status: "active",
      qb_customer_name: r.name,
      qb_terms: r.terms || null,
      primary_contact_phone: normalizePhone(r.phone ?? "") ?? null,
      primary_contact_email: r.email || null,
      address_line1: r.addressLine1 || null,
      city: r.city || null,
      state: r.state || "NY",
      zip: r.zip || null,
    });
    created++;
  }
  return NextResponse.json({ created, skipped });
}
