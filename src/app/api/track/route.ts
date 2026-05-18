import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { requireSameOrigin } from "@/lib/auth/same-origin";
import type { TablesInsert } from "@/lib/supabase/database.types";

// Buyer-facing event ingestion. Accepts a single event or a batch; the
// client tracker in lib/analytics/track.ts always sends a batch even for
// one event to keep the wire shape stable.
//
// We resolve profile_id + account_id server-side from the active session
// rather than trusting the client. RLS would catch a mismatched
// profile_id under buyer auth too, but the service client bypasses RLS,
// so we enforce in code.

interface BodyEvent {
  event?: unknown;
  properties?: unknown;
  path?: unknown;
  sessionId?: unknown;
}
interface Body {
  events?: unknown;
}

const MAX_EVENTS = 20;
const MAX_EVENT_NAME = 80;
const MAX_PATH = 500;
const MAX_PROPS_BYTES = 4_000; // jsonb soft cap per event

export async function POST(request: Request) {
  const originGate = requireSameOrigin(request);
  if (originGate) return originGate;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const events = Array.isArray(body.events) ? body.events : [];
  if (events.length === 0) return new NextResponse(null, { status: 204 });
  if (events.length > MAX_EVENTS) {
    return NextResponse.json({ error: "too many events" }, { status: 400 });
  }

  const session = await getSession();
  const profileId = session?.profile.id ?? null;
  const accountId = session?.profile.account_id ?? null;
  const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null;

  const rows: TablesInsert<"buyer_events">[] = [];

  for (const raw of events as BodyEvent[]) {
    if (!raw || typeof raw !== "object") continue;
    const name = typeof raw.event === "string" ? raw.event.slice(0, MAX_EVENT_NAME) : null;
    if (!name) continue;
    const props =
      raw.properties && typeof raw.properties === "object" && !Array.isArray(raw.properties)
        ? (raw.properties as Record<string, unknown>)
        : {};
    // Cap properties size to avoid an unbounded jsonb write from a buggy
    // caller. Anything past the cap drops the event rather than truncating
    // mid-key.
    if (JSON.stringify(props).length > MAX_PROPS_BYTES) continue;
    const path =
      typeof raw.path === "string" ? raw.path.slice(0, MAX_PATH) : null;
    const sessionId =
      typeof raw.sessionId === "string" ? raw.sessionId.slice(0, 100) : null;
    rows.push({
      profile_id: profileId,
      account_id: accountId,
      event_name: name,
      properties: props as never,
      path,
      session_id: sessionId,
      user_agent: userAgent,
    });
  }
  if (rows.length === 0) return new NextResponse(null, { status: 204 });

  const svc = createServiceClient();
  const { error } = await svc.from("buyer_events").insert(rows);
  if (error) {
    // Don't leak DB error strings to the client. Best-effort log; the
    // tracker swallows errors anyway.
    console.warn("[/api/track] insert failed:", error.message);
    return new NextResponse(null, { status: 204 });
  }
  return new NextResponse(null, { status: 204 });
}
