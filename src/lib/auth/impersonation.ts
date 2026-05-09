import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

const IMPERSONATION_COOKIE = "flf-impersonate";
const TTL_SECONDS = 60 * 60 * 4; // 4 hours

/**
 * "View as buyer" — admin-only. The cookie carries an HMAC-signed payload
 * `<targetProfileId>|<expiresAt>|<sig>` so a stolen-but-tampered cookie
 * can't impersonate a different profile or extend its own lifetime.
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
  const expiresAt = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const value = signPayload(`${targetProfileId}|${expiresAt}`);
  store.set(IMPERSONATION_COOKIE, value, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

export async function getImpersonation(): Promise<string | null> {
  const raw = (await cookies()).get(IMPERSONATION_COOKIE)?.value;
  if (!raw) return null;
  return verifyPayload(raw);
}

function impersonationSecret(): string | null {
  const explicit = process.env.IMPERSONATION_SECRET;
  if (explicit) return explicit;
  const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;
  if (fallback && !warnedAboutFallback) {
    warnedAboutFallback = true;
    // Fail loud so the operator notices: rotating the service-role key
    // would silently invalidate every impersonation cookie, and anyone
    // with read access to the SR key (env dumps, leaked deploy logs)
    // could forge a valid cookie.
    console.warn(
      "[impersonation] IMPERSONATION_SECRET is unset — falling back to SUPABASE_SERVICE_ROLE_KEY. " +
        "Set a separate IMPERSONATION_SECRET in production so the two rotations are independent.",
    );
  }
  return fallback;
}

let warnedAboutFallback = false;

function signPayload(payload: string): string {
  const secret = impersonationSecret();
  if (!secret) throw new Error("IMPERSONATION_SECRET (or SUPABASE_SERVICE_ROLE_KEY) is not configured");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}|${sig}`;
}

function verifyPayload(value: string): string | null {
  const secret = impersonationSecret();
  if (!secret) return null;
  const parts = value.split("|");
  if (parts.length !== 3) return null;
  const [target, expiresAtStr, sig] = parts;
  const payload = `${target}|${expiresAtStr}`;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  // Constant-time compare; mismatch on length is also a fail.
  if (sig.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || expiresAt * 1000 < Date.now()) return null;
  return target;
}
