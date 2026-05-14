/**
 * Tests for /api/orders/create — Stripe ordering of operations (H5).
 *
 * Verifies the fix that moves stripe.checkout.sessions.create(...) BEFORE
 * the orders.insert + system-message insert. If Stripe throws, no DB
 * writes should happen — no stranded draft order and no misleading
 * "order placed" system message.
 */

// ---- Mocks ----
const mockCheckoutCreate = jest.fn();
const mockCheckoutExpire = jest.fn();

jest.mock("@/lib/stripe/client", () => ({
  getStripe: () => ({
    checkout: { sessions: { create: mockCheckoutCreate, expire: mockCheckoutExpire } },
  }),
}));

jest.mock("@/lib/auth/session", () => ({
  getSession: jest.fn(),
}));
jest.mock("@/lib/auth/impersonation", () => ({
  getImpersonation: jest.fn(async () => null),
}));
jest.mock("@/lib/notifications/dispatch", () => ({
  enqueueAndSend: jest.fn(async () => ({ ok: true })),
}));
jest.mock("@/lib/products/buyer-history", () => ({
  buyerHistoryTag: (id: string) => `buyer-history:${id}`,
}));
jest.mock("@/lib/products/queries", () => ({
  getAllowedPrivateProductIds: jest.fn(async () => []),
}));
jest.mock("next/cache", () => ({
  revalidateTag: jest.fn(),
}));
// next/server's `after` throws outside a request scope (Jest is one);
// stub it as eager-call so we can also assert on whatever runs inside.
jest.mock("next/server", () => {
  const actual = jest.requireActual("next/server");
  return {
    ...actual,
    after: (task: () => void | Promise<void>) => {
      // Fire-and-forget the task synchronously. Tests that need to wait
      // on it can use `await Promise.resolve()` chains.
      void Promise.resolve().then(() => task());
    },
  };
});

const mockSvc: any = {
  from: jest.fn(),
  rpc: jest.fn(),
};
jest.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => mockSvc,
  // createClient is used by lib/auth/session, but we've mocked getSession
  // itself, so this is never reached.
  createClient: jest.fn(),
}));

jest.mock("@/lib/utils/pricing", () => ({
  loadPricingContext: jest.fn(async () => ({})),
  priceForProduct: (p: any) => Number(p.retail_price ?? p.wholesale_price ?? 10),
}));
jest.mock("@/lib/utils/order-minimum", () => ({
  meetsMinimum: () => true,
  effectiveOrderMinimum: () => 0,
}));

import { POST } from "@/app/api/orders/create/route";
import { getSession } from "@/lib/auth/session";

function buyerSession() {
  return {
    userId: "u_buyer",
    profile: { id: "u_buyer", role: "buyer", account_id: null, email: null, phone: null },
  };
}

function req(body: object): Request {
  // Same-origin gate requires Origin (or Referer) to share the request's
  // host. Use the same host on both so the route accepts it.
  return new Request("https://example.com/api/orders/create", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "origin": "https://example.com",
    },
    body: JSON.stringify(body),
  });
}

/**
 * Build a Supabase chainable stub specifically for the orders/create flow.
 * Captures insert payloads per table so tests can assert what was (or
 * wasn't) written.
 */
function makeSvc(overrides: { orderInsertError?: { message: string } | null } = {}) {
  const captured = {
    insertsByTable: {} as Record<string, any[]>,
  };
  mockSvc.rpc.mockResolvedValue({ data: "FLF-1", error: null });
  mockSvc.from.mockImplementation((table: string) => {
    if (table === "profiles") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: { id: "u_buyer", role: "buyer", account_id: null, email: null, phone: null }, error: null }),
          }),
        }),
      };
    }
    if (table === "products") {
      return {
        select: () => ({
          in: () => Promise.resolve({
            data: [{
              id: "p_1",
              name: "Apples",
              pack_size: "5lb",
              wholesale_price: 10,
              retail_price: 12,
              is_active: true,
              private: false,
              available_b2b: true,
              available_dtc: true,
              available_this_week: true,
            }],
            error: null,
          }),
        }),
      };
    }
    if (table === "orders") {
      return {
        insert: (row: any) => {
          captured.insertsByTable.orders = captured.insertsByTable.orders ?? [];
          captured.insertsByTable.orders.push(row);
          return {
            select: () => ({
              single: () => {
                if (overrides.orderInsertError) {
                  return Promise.resolve({ data: null, error: overrides.orderInsertError });
                }
                return Promise.resolve({
                  data: { ...row, id: row.id ?? "ord_new", order_number: row.order_number },
                  error: null,
                });
              },
            }),
          };
        },
      };
    }
    if (table === "order_items") {
      return {
        insert: (row: any) => {
          captured.insertsByTable.order_items = captured.insertsByTable.order_items ?? [];
          captured.insertsByTable.order_items.push(row);
          return Promise.resolve({ data: null, error: null });
        },
      };
    }
    if (table === "messages") {
      return {
        insert: (row: any) => {
          captured.insertsByTable.messages = captured.insertsByTable.messages ?? [];
          captured.insertsByTable.messages.push(row);
          return Promise.resolve({ data: null, error: null });
        },
      };
    }
    return {} as any;
  });
  return captured;
}

beforeEach(() => {
  mockCheckoutCreate.mockReset();
  mockCheckoutExpire.mockReset();
  mockSvc.from.mockReset();
  mockSvc.rpc.mockReset();
  (getSession as jest.Mock).mockResolvedValue(buyerSession());
});

describe("orders/create — H5: Stripe-before-DB ordering", () => {
  it("does NOT insert an order row when stripe.checkout.sessions.create throws", async () => {
    mockCheckoutCreate.mockRejectedValueOnce(new Error("Stripe API down"));
    const captured = makeSvc();

    const r = await POST(req({
      orderType: "dtc",
      paymentMethod: "stripe",
      requestedDeliveryDate: null,
      pickupDate: null,
      pickupLocationId: null,
      customerNotes: null,
      lines: [{ productId: "p_1", quantity: 1, notes: null }],
    }));

    expect(r.status).toBe(500);
    const body = await r.json();
    expect(body.error).toMatch(/Stripe/);
    // Critical assertion: zero writes to orders, order_items, or messages.
    expect(captured.insertsByTable.orders ?? []).toEqual([]);
    expect(captured.insertsByTable.order_items ?? []).toEqual([]);
    expect(captured.insertsByTable.messages ?? []).toEqual([]);
    // No session was created, so nothing to expire.
    expect(mockCheckoutExpire).not.toHaveBeenCalled();
  });

  it("inserts the order with stripe_payment_id pre-populated when Stripe succeeds", async () => {
    mockCheckoutCreate.mockResolvedValueOnce({ id: "cs_abc", url: "https://stripe.example/cs_abc" });
    const captured = makeSvc();

    const r = await POST(req({
      orderType: "dtc",
      paymentMethod: "stripe",
      requestedDeliveryDate: null,
      pickupDate: null,
      pickupLocationId: null,
      customerNotes: null,
      lines: [{ productId: "p_1", quantity: 1, notes: null }],
    }));

    expect(r.status).toBe(200);
    const inserted = captured.insertsByTable.orders?.[0];
    expect(inserted).toBeDefined();
    // The fix: stripe_payment_id is set at insert time, not by a follow-up
    // update — closes the small window where the row existed without it.
    expect(inserted.stripe_payment_id).toBe("cs_abc");
    // The metadata.order_id passed to Stripe must equal the inserted row's
    // id (pre-generated locally so they agree).
    expect(inserted.id).toBeDefined();
    const createArgs = mockCheckoutCreate.mock.calls[0][0];
    expect(createArgs.metadata.order_id).toBe(inserted.id);
  });

  it("calls checkout.sessions.expire if order insert fails after Stripe succeeded", async () => {
    mockCheckoutCreate.mockResolvedValueOnce({ id: "cs_orphan", url: "https://stripe.example/cs_orphan" });
    makeSvc({ orderInsertError: { message: "constraint violation" } });

    const r = await POST(req({
      orderType: "dtc",
      paymentMethod: "stripe",
      requestedDeliveryDate: null,
      pickupDate: null,
      pickupLocationId: null,
      customerNotes: null,
      lines: [{ productId: "p_1", quantity: 1, notes: null }],
    }));

    expect(r.status).toBe(500);
    expect(mockCheckoutExpire).toHaveBeenCalledWith("cs_orphan");
  });

  it("does NOT call Stripe for non-stripe payment methods (invoice path unchanged)", async () => {
    makeSvc();

    const r = await POST(req({
      orderType: "b2b",
      paymentMethod: "invoice",
      requestedDeliveryDate: null,
      pickupDate: null,
      pickupLocationId: null,
      customerNotes: null,
      lines: [{ productId: "p_1", quantity: 1, notes: null }],
    }));

    expect(r.status).toBe(200);
    expect(mockCheckoutCreate).not.toHaveBeenCalled();
  });
});

/**
 * H6 — orders/create must re-check the visibility flags the catalog query
 * applies. Previously the route only selected (id, name, pack_size, prices)
 * and ignored is_active / available_b2b / available_dtc /
 * available_this_week / private, so a stale-cart submit could land an
 * order line for a hidden or unlaunched SKU.
 */
describe("orders/create — H6: visibility re-checks", () => {
  function makeSvcWithProduct(productOverrides: Record<string, unknown>) {
    const captured = { insertsByTable: {} as Record<string, any[]> };
    mockSvc.rpc.mockResolvedValue({ data: "FLF-1", error: null });
    mockSvc.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({
                data: { id: "u_buyer", role: "buyer", account_id: null, email: null, phone: null },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "products") {
        return {
          select: () => ({
            in: () => Promise.resolve({
              data: [{
                id: "p_1",
                name: "Apples",
                pack_size: "5lb",
                wholesale_price: 10,
                retail_price: 12,
                is_active: true,
                private: false,
                available_b2b: true,
                available_dtc: true,
                available_this_week: true,
                ...productOverrides,
              }],
              error: null,
            }),
          }),
        };
      }
      if (table === "orders") {
        return {
          insert: (row: any) => {
            captured.insertsByTable.orders = captured.insertsByTable.orders ?? [];
            captured.insertsByTable.orders.push(row);
            return {
              select: () => ({
                single: () => Promise.resolve({ data: { ...row, id: "ord_new" }, error: null }),
              }),
            };
          },
        };
      }
      if (table === "order_items") {
        return {
          insert: (row: any) => {
            captured.insertsByTable.order_items = captured.insertsByTable.order_items ?? [];
            captured.insertsByTable.order_items.push(row);
            return Promise.resolve({ data: null, error: null });
          },
        };
      }
      if (table === "messages") {
        return {
          insert: () => Promise.resolve({ data: null, error: null }),
        };
      }
      return {} as any;
    });
    return captured;
  }

  it("rejects an order line whose product is no longer active", async () => {
    const captured = makeSvcWithProduct({ is_active: false });
    const r = await POST(req({
      orderType: "dtc",
      paymentMethod: "invoice",
      requestedDeliveryDate: null,
      pickupDate: null,
      pickupLocationId: null,
      customerNotes: null,
      lines: [{ productId: "p_1", quantity: 1, notes: null }],
    }));
    expect(r.status).toBe(400);
    expect((await r.json()).error).toMatch(/no longer active/);
    expect(captured.insertsByTable.orders ?? []).toEqual([]);
  });

  it("rejects an order line whose product is hidden from B2B for a B2B buyer", async () => {
    const captured = makeSvcWithProduct({ available_b2b: false });
    const r = await POST(req({
      orderType: "b2b",
      paymentMethod: "invoice",
      requestedDeliveryDate: null,
      pickupDate: null,
      pickupLocationId: null,
      customerNotes: null,
      lines: [{ productId: "p_1", quantity: 1, notes: null }],
    }));
    expect(r.status).toBe(400);
    expect((await r.json()).error).toMatch(/B2B/);
    expect(captured.insertsByTable.orders ?? []).toEqual([]);
  });

  it("rejects an order line whose product is hidden from DTC for a DTC buyer", async () => {
    const captured = makeSvcWithProduct({ available_dtc: false });
    const r = await POST(req({
      orderType: "dtc",
      paymentMethod: "invoice",
      requestedDeliveryDate: null,
      pickupDate: null,
      pickupLocationId: null,
      customerNotes: null,
      lines: [{ productId: "p_1", quantity: 1, notes: null }],
    }));
    expect(r.status).toBe(400);
    expect((await r.json()).error).toMatch(/DTC/);
    expect(captured.insertsByTable.orders ?? []).toEqual([]);
  });

  it("rejects an order line whose product isn't available this week", async () => {
    const captured = makeSvcWithProduct({ available_this_week: false });
    const r = await POST(req({
      orderType: "dtc",
      paymentMethod: "invoice",
      requestedDeliveryDate: null,
      pickupDate: null,
      pickupLocationId: null,
      customerNotes: null,
      lines: [{ productId: "p_1", quantity: 1, notes: null }],
    }));
    expect(r.status).toBe(400);
    expect((await r.json()).error).toMatch(/this week/);
    expect(captured.insertsByTable.orders ?? []).toEqual([]);
  });

  it("rejects a private product when the buyer's account isn't allow-listed", async () => {
    const captured = makeSvcWithProduct({ private: true });
    const r = await POST(req({
      orderType: "dtc",
      paymentMethod: "invoice",
      requestedDeliveryDate: null,
      pickupDate: null,
      pickupLocationId: null,
      customerNotes: null,
      lines: [{ productId: "p_1", quantity: 1, notes: null }],
    }));
    expect(r.status).toBe(400);
    expect((await r.json()).error).toMatch(/your account/);
    expect(captured.insertsByTable.orders ?? []).toEqual([]);
  });
});
