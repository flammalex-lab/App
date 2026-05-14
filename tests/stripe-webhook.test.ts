/**
 * Tests for /api/stripe/webhook. Mocks Stripe + Supabase so we can drive
 * each branch (dedupe, mutation success, mutation failure, retry) without
 * a real DB or Stripe account.
 */

// ---- Mocks ----
const mockConstructEvent = jest.fn();

jest.mock("@/lib/stripe/client", () => ({
  getStripe: () => ({
    webhooks: { constructEvent: mockConstructEvent },
  }),
}));

const mockSvc = {
  from: jest.fn(),
};
jest.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => mockSvc,
}));

import { POST } from "@/app/api/stripe/webhook/route";

const ORIG_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
beforeAll(() => {
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
});
afterAll(() => {
  if (ORIG_SECRET === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
  else process.env.STRIPE_WEBHOOK_SECRET = ORIG_SECRET;
});

function req(body: string, sig = "stripe-sig"): Request {
  return new Request("https://example.com/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": sig },
    body,
  });
}

/**
 * Build a chainable Supabase stub. Each table can have a custom handler
 * that returns the next chainable mock. Captures inserts/updates/deletes
 * for assertion.
 */
function makeSvcMock(handlers: Record<string, () => any> = {}) {
  const captured = {
    inserts: [] as Array<{ table: string; row: any }>,
    updates: [] as Array<{ table: string; row: any; eq?: [string, any]; neq?: [string, any] }>,
    deletes: [] as Array<{ table: string; eq?: [string, any] }>,
  };
  mockSvc.from.mockImplementation((table: string) => {
    if (handlers[table]) return handlers[table]();
    // Default: a generic chainable stub that captures the operation.
    let mode: "insert" | "update" | "delete" | "select" = "select";
    let payload: any;
    let eqArg: [string, any] | undefined;
    let neqArg: [string, any] | undefined;
    const builder: any = {
      insert: (row: any) => { mode = "insert"; payload = row; return builder; },
      update: (row: any) => { mode = "update"; payload = row; return builder; },
      delete: () => { mode = "delete"; return builder; },
      select: () => builder,
      eq: (col: string, val: any) => { eqArg = [col, val]; return builder; },
      neq: (col: string, val: any) => { neqArg = [col, val]; return builder; },
      maybeSingle: () => {
        flush();
        return Promise.resolve({ data: null, error: null });
      },
      single: () => {
        flush();
        return Promise.resolve({ data: { id: "fake-id" }, error: null });
      },
      then: (res: any, rej: any) => {
        flush();
        return Promise.resolve({ data: null, error: null }).then(res, rej);
      },
    };
    function flush() {
      if (mode === "insert") captured.inserts.push({ table, row: payload });
      if (mode === "update") captured.updates.push({ table, row: payload, eq: eqArg, neq: neqArg });
      if (mode === "delete") captured.deletes.push({ table, eq: eqArg });
    }
    return builder;
  });
  return captured;
}

beforeEach(() => {
  mockConstructEvent.mockReset();
  mockSvc.from.mockReset();
});

describe("stripe webhook — auth", () => {
  it("returns 500 when STRIPE_WEBHOOK_SECRET is unset", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const r = await POST(req("payload"));
    expect(r.status).toBe(500);
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  });

  it("returns 400 on bad signature", async () => {
    mockConstructEvent.mockImplementation(() => { throw new Error("bad sig"); });
    const r = await POST(req("payload"));
    expect(r.status).toBe(400);
    const body = await r.json();
    expect(body.error).toMatch(/bad signature/);
  });
});

describe("stripe webhook — dedupe", () => {
  let errSpy: jest.SpyInstance;
  beforeAll(() => { errSpy = jest.spyOn(console, "error").mockImplementation(() => {}); });
  afterAll(() => { errSpy.mockRestore(); });

  it("short-circuits with deduped:true on unique-violation (SQLSTATE 23505)", async () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_dup",
      type: "checkout.session.completed",
      data: { object: { metadata: { order_id: "ord_1" }, payment_intent: "pi_1" } },
    });
    // stripe_events insert returns 23505
    mockSvc.from.mockImplementation((table: string) => {
      if (table === "stripe_events") {
        return {
          insert: () => ({
            select: () => ({
              maybeSingle: () => Promise.resolve({
                data: null,
                error: { code: "23505", message: "duplicate key" },
              }),
            }),
          }),
        };
      }
      return {} as any;
    });
    const r = await POST(req("payload"));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body).toEqual({ received: true, deduped: true });
  });

  it("returns 500 when insert returns null+no-error AND prior row absent (RLS misconfig signal)", async () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_phantom",
      type: "checkout.session.completed",
      data: { object: { metadata: { order_id: "ord_1" } } },
    });
    mockSvc.from.mockImplementation((table: string) => {
      if (table === "stripe_events") {
        return {
          insert: () => ({
            select: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
          // The follow-up SELECT also returns no row → suspect RLS.
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        };
      }
      return {} as any;
    });
    const r = await POST(req("payload"));
    expect(r.status).toBe(500);
  });
});

describe("stripe webhook — ownership verification (C3)", () => {
  // The mismatch path warns to console.warn; silence it for clean test output.
  let warnSpy: jest.SpyInstance;
  beforeAll(() => { warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {}); });
  afterAll(() => { warnSpy.mockRestore(); });

  it("checkout.session.completed: does NOT update orders when metadata.order_id targets a row whose stripe_payment_id doesn't match the session", async () => {
    // Threat: caller crafts a checkout session with metadata.order_id =
    // <victim's order id>. Stripe signs the event. Webhook must NOT flip
    // the victim's order to paid/confirmed.
    mockConstructEvent.mockReturnValue({
      id: "evt_forge",
      type: "checkout.session.completed",
      data: { object: { id: "cs_attacker", metadata: { order_id: "ord_victim" }, payment_intent: "pi_attacker" } },
    });

    let ordersUpdateFilters: Array<[string, any]> = [];
    let ordersUpdatePayload: any = null;
    let updatedRowsReturned: any[] = [];
    mockSvc.from.mockImplementation((table: string) => {
      if (table === "stripe_events") {
        return {
          insert: () => ({
            select: () => ({
              maybeSingle: () => Promise.resolve({ data: { id: "evt_forge" }, error: null }),
            }),
          }),
          delete: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
        };
      }
      if (table === "orders") {
        return {
          update: (row: any) => {
            ordersUpdatePayload = row;
            const chain: any = {
              eq: (col: string, val: any) => {
                ordersUpdateFilters.push([col, val]);
                return chain;
              },
              select: () => {
                // The .eq("id", ord_victim).eq("stripe_payment_id", cs_attacker)
                // filter pair matches NO row in the table — the victim row's
                // stripe_payment_id is its own session id, not cs_attacker.
                return Promise.resolve({ data: updatedRowsReturned, error: null });
              },
            };
            return chain;
          },
        };
      }
      return {} as any;
    });

    const r = await POST(req("payload"));
    expect(r.status).toBe(200);
    // Crucially, the update was *attempted* but scoped by both filters,
    // and returned zero rows — so no order was actually mutated.
    expect(ordersUpdateFilters).toEqual(
      expect.arrayContaining([
        ["id", "ord_victim"],
        ["stripe_payment_id", "cs_attacker"],
      ])
    );
    expect(updatedRowsReturned).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("metadata.order_id does not match"),
      expect.objectContaining({ metadataOrderId: "ord_victim", sessionId: "cs_attacker" })
    );
  });

  it("checkout.session.completed: DOES update orders when metadata.order_id and stripe_payment_id agree", async () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_match",
      type: "checkout.session.completed",
      data: { object: { id: "cs_match", metadata: { order_id: "ord_match" }, payment_intent: "pi_match" } },
    });

    let updateCalledWith: any = null;
    let filters: Array<[string, any]> = [];
    mockSvc.from.mockImplementation((table: string) => {
      if (table === "stripe_events") {
        return {
          insert: () => ({
            select: () => ({
              maybeSingle: () => Promise.resolve({ data: { id: "evt_match" }, error: null }),
            }),
          }),
        };
      }
      if (table === "orders") {
        return {
          update: (row: any) => {
            updateCalledWith = row;
            const chain: any = {
              eq: (col: string, val: any) => {
                filters.push([col, val]);
                return chain;
              },
              select: () => Promise.resolve({ data: [{ id: "ord_match" }], error: null }),
            };
            return chain;
          },
        };
      }
      return {} as any;
    });

    const r = await POST(req("payload"));
    expect(r.status).toBe(200);
    expect(updateCalledWith).toMatchObject({ status: "confirmed", payment_status: "paid" });
    // The ownership-check filter pair is present.
    expect(filters).toEqual(
      expect.arrayContaining([
        ["id", "ord_match"],
        ["stripe_payment_id", "cs_match"],
      ])
    );
  });
});

describe("stripe webhook — mutation rollback on failure", () => {
  // The mutation-error path intentionally console.errors a diagnostic.
  // Silence it for this test so jest output isn't noisy.
  let errSpy: jest.SpyInstance;
  beforeAll(() => { errSpy = jest.spyOn(console, "error").mockImplementation(() => {}); });
  afterAll(() => { errSpy.mockRestore(); });

  it("deletes the dedupe row when the mutation errors, returns 500", async () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_fail",
      type: "checkout.session.completed",
      data: {
        object: { metadata: { order_id: "ord_X" }, payment_intent: "pi_X" },
      },
    });

    let stripeEventsDeleteCalled = false;
    let stripeEventsDeletedId: string | undefined;
    mockSvc.from.mockImplementation((table: string) => {
      if (table === "stripe_events") {
        return {
          insert: () => ({
            select: () => ({
              maybeSingle: () => Promise.resolve({ data: { id: "evt_fail" }, error: null }),
            }),
          }),
          delete: () => ({
            eq: (col: string, val: string) => {
              stripeEventsDeleteCalled = col === "id";
              stripeEventsDeletedId = val;
              return Promise.resolve({ data: null, error: null });
            },
          }),
        };
      }
      if (table === "orders") {
        return {
          update: () => ({
            eq: () => Promise.resolve({
              data: null,
              error: { message: "invalid input value for enum payment_status_t" },
            }),
          }),
        };
      }
      return {} as any;
    });

    const r = await POST(req("payload"));
    expect(r.status).toBe(500);
    expect(stripeEventsDeleteCalled).toBe(true);
    expect(stripeEventsDeletedId).toBe("evt_fail");
  });
});
