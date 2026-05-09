import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Reject anything that isn't an internal, single-leading-slash path.
 * Blocks open-redirect vectors like `?next=@evil.com` (which reads as
 * userinfo and lands on evil.com) and `?next=//evil.com`.
 */
function safeRedirectTarget(next: string | null): string {
  if (!next) return "/";
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeRedirectTarget(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(`${origin}${next}`);
}
