import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createPlain, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function createClient(): Promise<SupabaseClient<Database>> {
  // Next 15+: cookies() is async.
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(toSet: CookieToSet[]) {
          try {
            toSet.forEach(({ name, value, options }: CookieToSet) =>
              cookieStore.set(name, value, options),
            );
          } catch (e) {
            // Setting cookies from a Server Component is fine to ignore (middleware refreshes).
            // But in a Route Handler / Server Action we *need* the cookies to land — log so we notice.
            if (process.env.NODE_ENV !== "production") {
              console.warn("[supabase server] cookie set failed:", e);
            }
          }
        },
      },
    },
  );
}

/**
 * Service-role client. Bypasses RLS. Use only in server-only code paths
 * (API routes, cron jobs) where you've verified caller authorization.
 */
export function createServiceClient(): SupabaseClient<Database> {
  return createPlain<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
