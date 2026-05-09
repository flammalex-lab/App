import { safeRedirectTarget } from "@/lib/auth/safe-redirect";

describe("safeRedirectTarget", () => {
  it("returns / when next is null/undefined/empty", () => {
    expect(safeRedirectTarget(null)).toBe("/");
    expect(safeRedirectTarget(undefined)).toBe("/");
    expect(safeRedirectTarget("")).toBe("/");
  });

  it("accepts a single-slash internal path", () => {
    expect(safeRedirectTarget("/dashboard")).toBe("/dashboard");
    expect(safeRedirectTarget("/orders/123")).toBe("/orders/123");
    expect(safeRedirectTarget("/")).toBe("/");
  });

  it("accepts paths with query strings + fragments", () => {
    expect(safeRedirectTarget("/cart?reorder=1")).toBe("/cart?reorder=1");
    expect(safeRedirectTarget("/orders#latest")).toBe("/orders#latest");
  });

  it("rejects userinfo-style open-redirect (the @evil.com case from the audit)", () => {
    // `${origin}@evil.com` parses as `https://app.com@evil.com` → goes to evil.com
    expect(safeRedirectTarget("@evil.com")).toBe("/");
  });

  it("rejects protocol-relative URLs (//evil.com)", () => {
    expect(safeRedirectTarget("//evil.com")).toBe("/");
    expect(safeRedirectTarget("//evil.com/foo")).toBe("/");
  });

  it("rejects backslash-prefixed paths some browsers normalize to //", () => {
    expect(safeRedirectTarget("/\\evil.com")).toBe("/");
  });

  it("rejects absolute URLs (no leading slash)", () => {
    expect(safeRedirectTarget("https://evil.com")).toBe("/");
    expect(safeRedirectTarget("http://evil.com")).toBe("/");
    expect(safeRedirectTarget("javascript:alert(1)")).toBe("/");
  });

  it("rejects schemeless absolute-ish strings", () => {
    expect(safeRedirectTarget("evil.com/path")).toBe("/");
    expect(safeRedirectTarget("data:text/html,<script>")).toBe("/");
  });
});
