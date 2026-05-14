/**
 * Tests for POST /api/standing/[id]/run-now. Verifies that the route reads
 * the runStandingOrder return value and surfaces failures in the redirect
 * URL instead of pretending success (C5).
 */

const mockGetSession = jest.fn();
jest.mock("@/lib/auth/session", () => ({
  getSession: () => mockGetSession(),
}));

const mockMaybeSingle = jest.fn();
const mockSvc = {
  from: jest.fn(() => ({
    select: () => ({
      eq: () => ({
        maybeSingle: mockMaybeSingle,
      }),
    }),
  })),
};
jest.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => mockSvc,
}));

const mockRunStandingOrder = jest.fn();
jest.mock("@/lib/standing-orders/run", () => ({
  runStandingOrder: (...args: any[]) => mockRunStandingOrder(...args),
}));

import { POST } from "@/app/api/standing/[id]/run-now/route";

function makeRequest(): Request {
  return new Request("https://flf.test/api/standing/so-1/run-now", { method: "POST" });
}

function makeParams(id = "so-1"): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

describe("POST /api/standing/[id]/run-now (C5)", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockMaybeSingle.mockReset();
    mockRunStandingOrder.mockReset();
  });

  it("redirects to /standing with no error param when the run succeeds", async () => {
    mockGetSession.mockResolvedValue({
      userId: "prof-1",
      profile: { id: "prof-1", role: "buyer" },
    });
    mockMaybeSingle.mockResolvedValue({ data: { profile_id: "prof-1" }, error: null });
    mockRunStandingOrder.mockResolvedValue({ ok: true, orderId: "order-xyz" });

    const res = await POST(makeRequest(), { params: makeParams() });

    expect(res.status).toBe(303);
    const location = res.headers.get("location")!;
    const url = new URL(location);
    expect(url.pathname).toBe("/standing");
    expect(url.searchParams.get("error")).toBeNull();
  });

  it("propagates the failure reason into the redirect when runStandingOrder returns ok:false", async () => {
    mockGetSession.mockResolvedValue({
      userId: "prof-1",
      profile: { id: "prof-1", role: "buyer" },
    });
    mockMaybeSingle.mockResolvedValue({ data: { profile_id: "prof-1" }, error: null });
    mockRunStandingOrder.mockResolvedValue({
      ok: false,
      error: "order_items insert failed: constraint violation",
    });

    const res = await POST(makeRequest(), { params: makeParams() });

    expect(res.status).toBe(303);
    const location = res.headers.get("location")!;
    const url = new URL(location);
    expect(url.pathname).toBe("/standing");
    expect(url.searchParams.get("error")).toBe("run_failed");
    expect(url.searchParams.get("reason")).toMatch(/order_items insert failed/);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await POST(makeRequest(), { params: makeParams() });
    expect(res.status).toBe(401);
    expect(mockRunStandingOrder).not.toHaveBeenCalled();
  });

  it("returns 404 when the standing order doesn't exist", async () => {
    mockGetSession.mockResolvedValue({
      userId: "prof-1",
      profile: { id: "prof-1", role: "buyer" },
    });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const res = await POST(makeRequest(), { params: makeParams() });
    expect(res.status).toBe(404);
    expect(mockRunStandingOrder).not.toHaveBeenCalled();
  });

  it("returns 403 when the standing order belongs to a different buyer", async () => {
    mockGetSession.mockResolvedValue({
      userId: "prof-1",
      profile: { id: "prof-1", role: "buyer" },
    });
    mockMaybeSingle.mockResolvedValue({ data: { profile_id: "prof-2" }, error: null });

    const res = await POST(makeRequest(), { params: makeParams() });
    expect(res.status).toBe(403);
    expect(mockRunStandingOrder).not.toHaveBeenCalled();
  });

  it("admins can run someone else's standing order", async () => {
    mockGetSession.mockResolvedValue({
      userId: "admin-1",
      profile: { id: "admin-1", role: "admin" },
    });
    mockMaybeSingle.mockResolvedValue({ data: { profile_id: "prof-1" }, error: null });
    mockRunStandingOrder.mockResolvedValue({ ok: true, orderId: "order-xyz" });

    const res = await POST(makeRequest(), { params: makeParams() });
    expect(res.status).toBe(303);
    expect(mockRunStandingOrder).toHaveBeenCalledWith(mockSvc, "so-1");
  });
});
