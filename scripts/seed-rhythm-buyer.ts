/**
 * Seed a dummy B2B buyer with enough Friday-delivered order history
 * to make /guide's rhythm-driven draft (PR #107) render meaningfully.
 *
 * For running on a dev machine. The shared seed logic lives at
 * src/lib/seed/rhythm-buyer.ts and is also exposed via
 * /api/admin/seed-rhythm-buyer for production seeding without CLI access.
 *
 * Run: npx tsx scripts/seed-rhythm-buyer.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { seedRhythmBuyer, BUYER_EMAIL, BUYER_PASSWORD } from "../src/lib/seed/rhythm-buyer";

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

const sb = createClient(URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log("→ Seeding rhythm-demo buyer + history…");
  try {
    const result = await seedRhythmBuyer(sb);
    if (result.ordersWiped > 0) console.log(`  ✓ wiped ${result.ordersWiped} prior demo orders`);
    console.log(`  ✓ picked ${result.productsPicked} products`);
    for (const o of result.ordersSeeded) {
      console.log(`  ✓ ${o.orderNumber} · deliver ${o.deliveryDate} · ${o.lines} lines · $${o.total}`);
    }
    console.log("\n✅ Done. Sign in:");
    console.log(`   email:    ${BUYER_EMAIL}`);
    console.log(`   password: ${BUYER_PASSWORD}`);
    console.log("   Then /guide should open as a populated draft for the next Friday.");
  } catch (e) {
    console.error("Seed failed:", e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
