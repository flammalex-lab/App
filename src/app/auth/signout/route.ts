import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Force the SW + caches to be cleared client-side via a query param the
  // PWARegister picks up on next mount. Server-side we can only ask the
  // browser nicely; the actual unregister has to run in the SW context.
  return NextResponse.redirect(new URL("/login?signedout=1", request.url), { status: 303 });
}
