import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function createClient() {
  const cookieStore = cookies();
  return createServerClient(
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
              // eslint-disable-next-line no-console
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
export function createServiceClient() {
  const { createClient: createPlain } = require("@supabase/supabase-js");
  return createPlain(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
