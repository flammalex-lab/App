/**
 * Shared CSRF / cross-origin gate for state-mutating routes.
 *
 * Supabase auth cookies are issued with `SameSite=Lax`, which means a
 * top-level cross-site form POST will carry them. That's enough for an
 * attacker page to make an authenticated POST to any of our routes
 * unless we explicitly verify the request came from our own origin.
 *
 * The check uses three signals, in priority order:
 *   1. Origin header — modern browsers send this on every POST.
 *   2. Referer header — older browsers / odd clients.
 *   3. Sec-Fetch-Site=same-origin — Fetch Metadata header that browsers
 *      send untouched even when overzealous corporate proxies / privacy
 *      extensions strip Origin and Referer.
 *
 * If all three are missing the request is rejected as suspicious — that's
 * the right default for a state-mutating endpoint, but it can bite
 * legitimate users behind unusual proxies. The error response says
 * "Cross-origin request rejected" so an operator seeing it can recognize
 * the cause.
 *
 * This policy was lifted verbatim from
 * `src/app/api/admin/impersonate/start/route.ts`, which had the only
 * pre-existing implementation. Don't tighten or loosen it here without
 * thinking through every caller.
 */
export function isSameOrigin(request: Request): boolean {
  const reqUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === reqUrl.host;
    } catch {
      return false;
    }
  }
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).host === reqUrl.host;
    } catch {
      return false;
    }
  }
  // Fetch Metadata fallback for proxies that strip Origin + Referer.
  // browsers send this header on every fetch they originate; an attacker
  // site cannot forge "same-origin" for a cross-site POST.
  if (request.headers.get("sec-fetch-site") === "same-origin") {
    return true;
  }
  return false;
}

/**
 * Convenience wrapper: returns null when the request is same-origin (so
 * the caller falls through to its normal handler), or a 403 Response
 * when it isn't. Intended to be the first line of every state-mutating
 * route handler:
 *
 *   const gate = requireSameOrigin(request);
 *   if (gate) return gate;
 */
export function requireSameOrigin(request: Request): Response | null {
  if (isSameOrigin(request)) return null;
  return new Response("Cross-origin request rejected", { status: 403 });
}
