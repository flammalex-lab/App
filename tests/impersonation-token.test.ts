import {
  signImpersonationToken,
  verifyImpersonationToken,
  IMPERSONATION_TTL_SECONDS,
} from "@/lib/auth/impersonation-token";

const SECRET = "test-secret-do-not-use-in-prod";
const PROFILE = "11111111-2222-3333-4444-555555555555";

const future = (offsetSec = 60) => Math.floor(Date.now() / 1000) + offsetSec;

describe("impersonation token HMAC", () => {
  it("round-trips a freshly signed token", () => {
    const tok = signImpersonationToken(PROFILE, future(IMPERSONATION_TTL_SECONDS), SECRET);
    expect(verifyImpersonationToken(tok, { secret: SECRET })).toBe(PROFILE);
  });

  it("rejects a tampered profile id", () => {
    const tok = signImpersonationToken(PROFILE, future(60), SECRET);
    const parts = tok.split("|");
    parts[0] = "99999999-2222-3333-4444-555555555555";
    expect(verifyImpersonationToken(parts.join("|"), { secret: SECRET })).toBeNull();
  });

  it("rejects a tampered expiry (extension attempt)", () => {
    const tok = signImpersonationToken(PROFILE, future(60), SECRET);
    const parts = tok.split("|");
    parts[1] = String(future(60 * 60 * 24)); // attempt to push expiry out a day
    expect(verifyImpersonationToken(parts.join("|"), { secret: SECRET })).toBeNull();
  });

  it("rejects an expired but validly-signed token", () => {
    const past = Math.floor(Date.now() / 1000) - 10;
    const tok = signImpersonationToken(PROFILE, past, SECRET);
    expect(verifyImpersonationToken(tok, { secret: SECRET })).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const tok = signImpersonationToken(PROFILE, future(60), SECRET);
    expect(verifyImpersonationToken(tok, { secret: "different-secret" })).toBeNull();
  });

  it("rejects a malformed token (wrong number of parts)", () => {
    expect(verifyImpersonationToken("garbage", { secret: SECRET })).toBeNull();
    expect(verifyImpersonationToken("a|b", { secret: SECRET })).toBeNull();
    expect(verifyImpersonationToken("a|b|c|d", { secret: SECRET })).toBeNull();
  });

  it("rejects a missing or empty signature", () => {
    const expiresAt = future(60);
    const partial = `${PROFILE}|${expiresAt}|`;
    expect(verifyImpersonationToken(partial, { secret: SECRET })).toBeNull();
  });

  it("rejects when the embedded expiry is non-numeric", () => {
    // Sign legitimately, then replace expiry with junk — the signature won't
    // match the new payload, so this also exercises the signature path.
    const tok = signImpersonationToken(PROFILE, future(60), SECRET);
    const parts = tok.split("|");
    parts[1] = "not-a-number";
    expect(verifyImpersonationToken(parts.join("|"), { secret: SECRET })).toBeNull();
  });

  it("uses constant-time compare on the signature (mismatch length still null)", () => {
    const tok = signImpersonationToken(PROFILE, future(60), SECRET);
    // Truncate the signature — should fail length check, not crash.
    expect(verifyImpersonationToken(tok.slice(0, -5), { secret: SECRET })).toBeNull();
  });

  it("respects an injected `now` for deterministic expiry tests", () => {
    const expiresAt = Math.floor(new Date("2026-01-01T00:00:00Z").getTime() / 1000);
    const tok = signImpersonationToken(PROFILE, expiresAt, SECRET);
    // 1 second before expiry → valid
    expect(
      verifyImpersonationToken(tok, {
        secret: SECRET,
        now: expiresAt * 1000 - 1000,
      }),
    ).toBe(PROFILE);
    // exactly at expiry → valid (boundary inclusive)
    expect(
      verifyImpersonationToken(tok, {
        secret: SECRET,
        now: expiresAt * 1000,
      }),
    ).toBe(PROFILE);
    // 1 second after expiry → null
    expect(
      verifyImpersonationToken(tok, {
        secret: SECRET,
        now: expiresAt * 1000 + 1000,
      }),
    ).toBeNull();
  });
});
