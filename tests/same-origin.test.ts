import { isSameOrigin, requireSameOrigin } from "@/lib/auth/same-origin";

function makeRequest(opts: {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
}): Request {
  return new Request(opts.url ?? "https://flf.example.com/api/test", {
    method: opts.method ?? "POST",
    headers: opts.headers ?? {},
  });
}

describe("isSameOrigin", () => {
  it("accepts a POST whose Origin header matches the request host", () => {
    const req = makeRequest({
      headers: { origin: "https://flf.example.com" },
    });
    expect(isSameOrigin(req)).toBe(true);
  });

  it("rejects a POST whose Origin is a different host", () => {
    const req = makeRequest({
      headers: { origin: "https://evil.example.com" },
    });
    expect(isSameOrigin(req)).toBe(false);
  });

  it("rejects a POST with a malformed Origin header", () => {
    const req = makeRequest({
      headers: { origin: "not-a-url" },
    });
    expect(isSameOrigin(req)).toBe(false);
  });

  it("falls back to Referer when Origin is missing", () => {
    const req = makeRequest({
      headers: { referer: "https://flf.example.com/cart" },
    });
    expect(isSameOrigin(req)).toBe(true);
  });

  it("rejects when Referer is on a different host and Origin is absent", () => {
    const req = makeRequest({
      headers: { referer: "https://evil.example.com/page" },
    });
    expect(isSameOrigin(req)).toBe(false);
  });

  it("accepts when Sec-Fetch-Site=same-origin and Origin+Referer are stripped", () => {
    const req = makeRequest({
      headers: { "sec-fetch-site": "same-origin" },
    });
    expect(isSameOrigin(req)).toBe(true);
  });

  it("rejects when Sec-Fetch-Site=cross-site (proxy stripped Origin/Referer)", () => {
    const req = makeRequest({
      headers: { "sec-fetch-site": "cross-site" },
    });
    expect(isSameOrigin(req)).toBe(false);
  });

  it("rejects a POST with no CSRF signals at all (worst case)", () => {
    const req = makeRequest({});
    expect(isSameOrigin(req)).toBe(false);
  });

  it("Origin takes priority over Referer when both are present", () => {
    const req = makeRequest({
      headers: {
        origin: "https://evil.example.com",
        referer: "https://flf.example.com/cart",
      },
    });
    // Origin says cross-origin, so we reject even though the referer
    // would have passed — Origin is the more reliable signal.
    expect(isSameOrigin(req)).toBe(false);
  });
});

describe("requireSameOrigin", () => {
  it("returns null for a same-origin request", () => {
    const req = makeRequest({
      headers: { origin: "https://flf.example.com" },
    });
    expect(requireSameOrigin(req)).toBeNull();
  });

  it("returns a 403 Response for a cross-origin request", () => {
    const req = makeRequest({
      headers: { origin: "https://evil.example.com" },
    });
    const resp = requireSameOrigin(req);
    expect(resp).not.toBeNull();
    expect(resp!.status).toBe(403);
  });

  it("returns a 403 Response when no CSRF signals are present", () => {
    const req = makeRequest({});
    const resp = requireSameOrigin(req);
    expect(resp).not.toBeNull();
    expect(resp!.status).toBe(403);
  });

  it("returns null for a GET request that is same-origin (Origin header)", () => {
    // GETs on the same path still send Origin in modern Chrome; we treat
    // them the same as POSTs because the helper's contract is per-request,
    // not per-method. Callers wire it only into mutating handlers.
    const req = makeRequest({
      method: "GET",
      headers: { origin: "https://flf.example.com" },
    });
    expect(requireSameOrigin(req)).toBeNull();
  });

  it("403 response body is human-readable", async () => {
    const req = makeRequest({
      headers: { origin: "https://evil.example.com" },
    });
    const resp = requireSameOrigin(req)!;
    const body = await resp.text();
    expect(body).toMatch(/cross-origin/i);
  });
});
