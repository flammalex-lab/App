/**
 * Seed demo data for testing the portal.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local.
 * Run with:  npx tsx scripts/seed-demo.ts [admin-email]
 *
 * Creates:
 *   - (optionally) promotes the given admin email to role=admin
 *   - Two demo accounts: Mighty Quinn's (active restaurant, NYC metro),
 *     West Side Market (active grocery, Finger Lakes)
 *   - Two demo buyers with phone numbers (can be impersonated by admin)
 *   - Default order guide per buyer populated with 6-8 items from the catalog
 *   - One standing order for Mighty Quinn's
 *   - Two sample activities
 *
 * Safe to re-run: uses upserts by name/phone where possible.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load .env.local manually (no dependency on dotenv)
try {
  const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const sb = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

async function main() {
  const adminEmail = process.argv[2];
  if (adminEmail) {
    console.log(`→ promoting ${adminEmail} to admin`);
    const { error } = await sb.from("profiles").update({ role: "admin" }).eq("email", adminEmail);
    if (error) console.warn("  (note)", error.message);
    else console.log("  ✓ admin promoted");
  }

  // Accounts
  const accounts = [
    {
      name: "Mighty Quinn's — Lower East Side",
      type: "restaurant",
      channel: "foodservice",
      pricing_tier: "standard",
      status: "active",
      primary_contact_name: "Chef Hugh",
      primary_contact_phone: "+15551112222",
      address_line1: "103 2nd Ave",
      city: "New York",
      state: "NY",
      zip: "10003",
      delivery_zone: "nyc_metro",
      delivery_day: "Tuesday, Friday",
      qb_customer_name: "Mighty Quinn's BBQ",
      qb_terms: "Net 30",
    },
    {
      name: "West Side Market",
      type: "grocery",
      channel: "retail",
      pricing_tier: "volume",
      status: "active",
      primary_contact_name: "Sally Benner",
      primary_contact_phone: "+15553334444",
      address_line1: "22 Fall St",
      city: "Seneca Falls",
      state: "NY",
      zip: "13148",
      delivery_zone: "finger_lakes",
      delivery_day: "Tuesday, Friday",
      qb_customer_name: "West Side Market",
      qb_terms: "Net 15",
    },
  ];

  const accountIds: Record<string, string> = {};
  for (const a of accounts) {
    // Upsert by name
    const { data: existing } = await sb.from("accounts").select("id").eq("name", a.name).maybeSingle();
    if (existing) {
      accountIds[a.name] = existing.id as string;
      await sb.from("accounts").update(a).eq("id", existing.id);
      console.log(`✓ account exists: ${a.name}`);
    } else {
      const { data: created, error } = await sb.from("accounts").insert(a).select("id").single();
      if (error) {
        console.error(`  failed to create ${a.name}:`, error.message);
        continue;
      }
      accountIds[a.name] = (created as any).id;
      console.log(`✓ account created: ${a.name}`);
    }
  }

  // Buyers: create auth users with phone, attach to account
  const buyers = [
    { phone: "+15551112223", first_name: "Hugh", last_name: "Mangum", account: "Mighty Quinn's — Lower East Side" },
    { phone: "+15553334445", first_name: "Sally", last_name: "Benner", account: "West Side Market" },
  ];

  const buyerProfileIds: Record<string, string> = {};
  for (const b of buyers) {
    const { data: list } = await sb.auth.admin.listUsers();
    const existing = list?.users.find((u) => u.phone === b.phone.replace(/^\+/, ""));
    let userId = existing?.id;
    if (!userId) {
      const { data: created, error } = await sb.auth.admin.createUser({
        phone: b.phone,
        phone_confirm: true,
        user_metadata: { first_name: b.first_name, last_name: b.last_name, role: "b2b_buyer" },
      });
      if (error || !created.user) {
        console.error(`  failed to create buyer ${b.phone}:`, error?.message);
        continue;
      }
      userId = created.user.id;
    }
    await sb.from("profiles").update({
      account_id: accountIds[b.account],
      role: "b2b_buyer",
      first_name: b.first_name,
      last_name: b.last_name,
    }).eq("id", userId);
    buyerProfileIds[b.account] = userId;
    console.log(`✓ buyer: ${b.first_name} ${b.last_name} (${b.phone}) on ${b.account}`);
  }

  // Order guide: add ~8 items to each buyer's default guide
  const { data: products } = await sb.from("products").select("*").eq("is_active", true).eq("available_b2b", true);
  const pickSkus = [
    "BF-STR-001", "BF-TOP-001", "BF-SHO-001", "BF-GRD-001",
    "PK-CHP-001", "PK-RIB-001", "EG-CSE-001", "DY-BTR-001",
  ];
  for (const [accountName, profileId] of Object.entries(buyerProfileIds)) {
    const { data: guides } = await sb
      .from("order_guides")
      .select("id")
      .eq("profile_id", profileId)
      .eq("is_default", true)
      .order("created_at", { ascending: true })
      .limit(1);
    const guide = guides?.[0];
    if (!guide) {
      console.warn(`  (no default guide for ${accountName}; trigger may not have fired)`);
      continue;
    }
    await sb.from("order_guide_items").delete().eq("order_guide_id", (guide as any).id);
    const toInsert = pickSkus
      .map((sku, idx) => {
        const p = products?.find((x: any) => x.sku === sku);
        if (!p) return null;
        return {
          order_guide_id: (guide as any).id,
          product_id: (p as any).id,
          suggested_qty: [4, 2, 3, 10, 6, 4, 2, 1][idx] ?? 2,
          par_levels: { tue: [6, 2, 4, 12, 8, 4, 2, 1][idx] ?? 4, fri: [8, 4, 6, 20, 12, 6, 3, 2][idx] ?? 6 },
          sort_order: idx * 10,
        };
      })
      .filter(Boolean) as any[];
    if (toInsert.length) {
      await sb.from("order_guide_items").insert(toInsert);
      console.log(`✓ guide seeded for ${accountName} (${toInsert.length} items)`);
    }
  }

  // Standing order for Mighty Quinn's: Tuesday + Friday, 4 strip loins + 12 lb ground
  const mqProfile = buyerProfileIds["Mighty Quinn's — Lower East Side"];
  const mqAccount = accountIds["Mighty Quinn's — Lower East Side"];
  if (mqProfile && mqAccount) {
    const { data: existing } = await sb.from("standing_orders").select("id").eq("profile_id", mqProfile).maybeSingle();
    let soId = (existing as any)?.id as string | undefined;
    if (!soId) {
      const { data: so } = await sb.from("standing_orders").insert({
        account_id: mqAccount,
        profile_id: mqProfile,
        name: "Tuesday + Friday usual",
        frequency: "weekly",
        days_of_week: ["Tuesday", "Friday"],
        active: true,
        require_confirmation: true,
      }).select("id").single();
      soId = (so as any)?.id;
    }
    if (soId) {
      await sb.from("standing_order_items").delete().eq("standing_order_id", soId);
      const strip = products?.find((p: any) => p.sku === "BF-STR-001");
      const ground = products?.find((p: any) => p.sku === "BF-GRD-001");
      if (strip && ground) {
        await sb.from("standing_order_items").insert([
          { standing_order_id: soId, product_id: (strip as any).id, quantity: 4 },
          { standing_order_id: soId, product_id: (ground as any).id, quantity: 12 },
        ]);
        console.log(`✓ standing order: ${soId}`);
      }
    }
  }

  // Activities
  for (const [name, aid] of Object.entries(accountIds)) {
    const { data: existing } = await sb.from("activities").select("id").eq("account_id", aid).limit(1).maybeSingle();
    if (existing) continue;
    await sb.from("activities").insert({
      account_id: aid,
      type: "sample_drop",
      subject: "Dropped off ribeye + strip loin samples",
      body: `Initial samples dropped at ${name}. Positive reception; send pricing sheet next week.`,
      follow_up_date: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10),
    });
    console.log(`✓ activity logged for ${name}`);
  }

  console.log("\nDone. Sign in as the admin user you promoted and try:");
  console.log("  • Dashboard → Recent orders (empty, expected)");
  console.log("  • Accounts → Mighty Quinn's → View as buyer → place an order");
  console.log("  • Standing orders → Tuesday + Friday usual → Run now");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
