import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import type { NotificationPrefs } from "@/lib/supabase/types";

const KEYS: (keyof NotificationPrefs)[] = [
  "push_order_tracking",
  "email_order_confirmation",
  "email_new_chat",
  "email_payments",
  "sms_cutoff_warning",
];

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json()) as Partial<NotificationPrefs>;
  const next = { ...(session.profile.notification_prefs ?? {}) } as Record<string, boolean>;
  for (const k of KEYS) {
    if (typeof body[k] === "boolean") next[k] = body[k] as boolean;
  }

  const svc = createServiceClient();
  const { error } = await svc
    .from("profiles")
    .update({ notification_prefs: next })
    .eq("id", session.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, notification_prefs: next });
}
