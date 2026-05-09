import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Pure HMAC sign / verify for the impersonation cookie payload. Lives in
 * its own module (no next/headers import) so it can be unit-tested
 * directly without mocking the Next cookie store.
 *
 * Cookie value shape: `<targetProfileId>|<expiresAtUnixSec>|<sig>`
 *   • HMAC-SHA256 over `${profileId}|${expiresAt}` — covers both fields,
 *     so neither can be tampered without breaking the signature.
 *   • timingSafeEqual on the signature — constant-time compare.
 *   • Expiry is checked AFTER signature verification so a tampered
 *     expiry is rejected as a forgery, not silently accepted.
 */

export const IMPERSONATION_TTL_SECONDS = 60 * 60 * 4; // 4 hours

// Hard fail in production: the dev-only fallback to SUPABASE_SERVICE_ROLE_KEY
// means a leaked SR key (env dump, deploy log, support snapshot) becomes
// equivalent to forging impersonation cookies. Mirrors the
// supabaseImagePatterns() pattern in next.config.js — refuse to load the
// module if the secret is missing in prod, instead of silently weakening
// a critical-rated audit fix. Routes that import this module will 500 on
// load until the operator sets IMPERSONATION_SECRET.
if (process.env.NODE_ENV === "production" && !process.env.IMPERSONATION_SECRET) {
  throw new Error(
    "IMPERSONATION_SECRET must be set in production. The dev fallback to " +
      "SUPABASE_SERVICE_ROLE_KEY is unsafe — a leaked SR key would forge " +
      "impersonation cookies. Generate one with `openssl rand -base64 32`.",
  );
}

export function impersonationSecret(): string | null {
  const explicit = process.env.IMPERSONATION_SECRET;
  if (explicit) return explicit;
  const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;
  if (fallback && !warnedAboutFallback) {
    warnedAboutFallback = true;
    console.warn(
      "[impersonation] IMPERSONATION_SECRET is unset (dev only) — falling back to SUPABASE_SERVICE_ROLE_KEY. " +
        "Production deploys throw at module load instead.",
    );
  }
  return fallback;
}

let warnedAboutFallback = false;

export function signImpersonationToken(
  targetProfileId: string,
  expiresAtUnixSec: number,
  secret?: string,
): string {
  const s = secret ?? impersonationSecret();
  if (!s) throw new Error("IMPERSONATION_SECRET (or SUPABASE_SERVICE_ROLE_KEY) is not configured");
  const payload = `${targetProfileId}|${expiresAtUnixSec}`;
  const sig = createHmac("sha256", s).update(payload).digest("base64url");
  return `${payload}|${sig}`;
}

/**
 * Returns the bare profileId on success, null on any failure path
 * (malformed, tampered profileId, tampered expiry, signature mismatch,
 * expired, or no configured secret). The caller treats null as "no
 * impersonation in effect" and proceeds with the underlying session.
 */
export function verifyImpersonationToken(
  value: string,
  options: { now?: number; secret?: string } = {},
): string | null {
  const secret = options.secret ?? impersonationSecret();
  if (!secret) return null;
  const parts = value.split("|");
  if (parts.length !== 3) return null;
  const [target, expiresAtStr, sig] = parts;
  const payload = `${target}|${expiresAtStr}`;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  if (sig.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt)) return null;
  const now = options.now ?? Date.now();
  if (expiresAt * 1000 < now) return null;
  return target;
}
