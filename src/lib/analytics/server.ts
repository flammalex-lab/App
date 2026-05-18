import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// Server-side counterpart to lib/analytics/track. Used by route handlers
// when an event is best recorded from the server (e.g. order_placed,
// where we trust the server more than the client to know what happened).
// Never throws — analytics failures must not affect the surrounding op.

export interface TrackServerOpts {
  event: string;
  profileId?: string | null;
  accountId?: string | null;
  properties?: Record<string, unknown>;
  path?: string | null;
  sessionId?: string | null;
}

export async function trackServer(
  svc: SupabaseClient<Database>,
  opts: TrackServerOpts,
): Promise<void> {
  try {
    await svc.from("buyer_events").insert({
      profile_id: opts.profileId ?? null,
      account_id: opts.accountId ?? null,
      event_name: opts.event,
      properties: (opts.properties ?? {}) as never,
      path: opts.path ?? null,
      session_id: opts.sessionId ?? null,
    });
  } catch (e) {
    console.warn("[trackServer] insert failed:", e);
  }
}
