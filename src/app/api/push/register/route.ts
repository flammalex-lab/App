import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

// Native Capacitor app sends { token, platform } on registration. We
// upsert against (profile_id, token) so re-launches of the installed app
// don't duplicate rows when iOS / FCM hands back the same token.

const PLATFORMS = new Set(["ios", "android"]);
const MAX_TOKEN_LEN = 512;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { token?: unknown; platform?: unknown }
    | null;
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const platform = typeof body?.platform === "string" ? body.platform : "";
  if (!token || token.length > MAX_TOKEN_LEN || !PLATFORMS.has(platform)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const supabase = await createClient();
  // device_tokens is defined in migration 0037 but not yet present in the
  // generated database.types.ts (regen after the migration lands). Casting
  // the table name keeps the typed client elsewhere intact.
  const { error } = await (supabase as unknown as {
    from: (table: string) => {
      upsert: (
        row: Record<string, unknown>,
        opts: { onConflict: string },
      ) => Promise<{ error: { message: string } | null }>;
    };
  })
    .from("device_tokens")
    .upsert(
      {
        profile_id: session.userId,
        token,
        platform,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "profile_id,token" },
    );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
