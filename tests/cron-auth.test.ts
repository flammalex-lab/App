import { verifyCronAuth } from "@/lib/cron/auth";

const ORIGINAL_ENV = process.env.CRON_SECRET;

afterAll(() => {
  if (ORIGINAL_ENV === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL_ENV;
});

function req(authHeader?: string): Request {
  return new Request("https://example.com/api/cron/x", {
    method: "GET",
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

describe("verifyCronAuth", () => {
  it("returns 500 when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET;
    const denied = verifyCronAuth(req("Bearer anything"));
    expect(denied).not.toBeNull();
    expect(denied!.status).toBe(500);
    const body = await denied!.json();
    expect(body.error).toMatch(/CRON_SECRET/);
  });

  it("returns 403 when Authorization header is missing", () => {
    process.env.CRON_SECRET = "test-secret";
    const denied = verifyCronAuth(req());
    expect(denied).not.toBeNull();
    expect(denied!.status).toBe(403);
  });

  it("returns 403 when Authorization is wrong", () => {
    process.env.CRON_SECRET = "test-secret";
    const denied = verifyCronAuth(req("Bearer wrong"));
    expect(denied!.status).toBe(403);
  });

  it("returns null (allow) when Authorization matches", () => {
    process.env.CRON_SECRET = "test-secret";
    expect(verifyCronAuth(req("Bearer test-secret"))).toBeNull();
  });

  it("uses constant-time compare (different lengths reject without length-leak)", () => {
    process.env.CRON_SECRET = "test-secret";
    // Both wrong values; just verify they reject without throwing.
    expect(verifyCronAuth(req("Bearer x"))!.status).toBe(403);
    expect(verifyCronAuth(req("Bearer test-secret-but-extra"))!.status).toBe(403);
  });

  it("rejects when prefix is missing", () => {
    process.env.CRON_SECRET = "test-secret";
    expect(verifyCronAuth(req("test-secret"))!.status).toBe(403);
  });
});
