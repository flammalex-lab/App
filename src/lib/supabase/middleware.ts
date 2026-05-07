import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    const path = request.nextUrl.pathname;
    if (path.startsWith("/api/health")) {
      return NextResponse.next({ request });
    }
    const missing = [
      !supabaseUrl && "NEXT_PUBLIC_SUPABASE_URL",
      !supabaseAnonKey && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ].filter(Boolean);
    return new NextResponse(configErrorHtml(missing as string[]), {
      status: 503,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(toSet: CookieToSet[]) {
          toSet.forEach(({ name, value }: CookieToSet) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }: CookieToSet) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh session; result is attached to response cookies.
  const { data } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic =
    path === "/" ||
    path.startsWith("/login") ||
    path.startsWith("/register") ||
    path.startsWith("/privacy") ||
    path.startsWith("/terms") ||
    path.startsWith("/auth") ||
    path.startsWith("/api/auth") ||
    path.startsWith("/api/sms/inbound") ||
    path.startsWith("/api/cron") ||
    path.startsWith("/api/stripe/webhook") ||
    path.startsWith("/_next") ||
    path.startsWith("/icons") ||
    path.startsWith("/images") ||
    path.endsWith("/manifest.json") ||
    path.endsWith("/sw.js") ||
    path.endsWith("/favicon.ico");

  if (!data.user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return response;
}

function configErrorHtml(missing: string[]): string {
  const rows = missing
    .map((name) => `<li><code>${name}</code></li>`)
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Portal not configured</title>
  <style>
    body { font: 16px/1.5 system-ui, sans-serif; max-width: 640px; margin: 10vh auto; padding: 0 24px; color: #1a2a3a; }
    h1 { font-size: 22px; margin: 0 0 12px; }
    code { background: #f3efe7; padding: 2px 6px; border-radius: 4px; font-size: 14px; }
    ol { padding-left: 20px; }
    li { margin: 8px 0; }
    .hint { color: #5a6673; font-size: 14px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e6e1d4; }
  </style>
</head>
<body>
  <h1>Portal not configured yet</h1>
  <p>The server can't reach Supabase because these environment variables aren't set on this deployment:</p>
  <ul>${rows}</ul>
  <ol>
    <li>In Vercel → <strong>Settings → Environment Variables</strong>, add the missing vars. Check all three environments (Production, Preview, Development).</li>
    <li>Copy the values from Supabase → <strong>Project Settings → API</strong>.</li>
    <li>In Vercel → <strong>Deployments</strong>, redeploy the latest build (uncheck "Use existing Build Cache").</li>
  </ol>
  <p class="hint">Diagnostics: <a href="/api/health">/api/health</a> returns a JSON report of every env var and database status.</p>
</body>
</html>`;
}
