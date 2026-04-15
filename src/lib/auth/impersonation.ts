import { cookies } from "next/headers";

const IMPERSONATION_COOKIE = "flf-impersonate";

/**
 * "View as buyer" — admin-only. The server sets a signed cookie containing
 * the target profile id; downstream pages read it via `getImpersonation()`.
 *
 * RLS is bypassed server-side using the service-role client scoped to the
 * target's data. Nothing on the client is given impersonation powers.
 */
export async function setImpersonation(targetProfileId: string | null) {
  const store = cookies();
  if (targetProfileId === null) {
    store.delete(IMPERSONATION_COOKIE);
    return;
  }
  store.set(IMPERSONATION_COOKIE, targetProfileId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 4, // 4 hours
  });
}

export function getImpersonation(): string | null {
  return cookies().get(IMPERSONATION_COOKIE)?.value ?? null;
}
