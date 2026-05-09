import { cookies } from "next/headers";
import {
  IMPERSONATION_TTL_SECONDS,
  signImpersonationToken,
  verifyImpersonationToken,
} from "@/lib/auth/impersonation-token";

const IMPERSONATION_COOKIE = "flf-impersonate";

/**
 * "View as buyer" — admin-only. The cookie carries an HMAC-signed payload
 * (see `impersonation-token.ts`) so a stolen-but-tampered cookie can't
 * impersonate a different profile or extend its own lifetime.
 *
 * RLS is still bypassed server-side via the service-role client scoped to
 * the target's data; nothing on the client receives impersonation powers.
 */
export async function setImpersonation(targetProfileId: string | null) {
  const store = await cookies();
  if (targetProfileId === null) {
    store.delete(IMPERSONATION_COOKIE);
    return;
  }
  const expiresAt = Math.floor(Date.now() / 1000) + IMPERSONATION_TTL_SECONDS;
  const value = signImpersonationToken(targetProfileId, expiresAt);
  store.set(IMPERSONATION_COOKIE, value, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // Cookie maxAge matches the embedded expiry so a tampered payload
    // can't extend the session past what the signature authorizes.
    maxAge: IMPERSONATION_TTL_SECONDS,
  });
}

export async function getImpersonation(): Promise<string | null> {
  const raw = (await cookies()).get(IMPERSONATION_COOKIE)?.value;
  if (!raw) return null;
  return verifyImpersonationToken(raw);
}
