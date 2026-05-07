jest.mock("@/lib/notifications/dispatch", () => ({
  enqueueAndSend: jest.fn().mockResolvedValue(undefined),
}));

import { runStandingOrder } from "@/lib/standing-orders/run";
import { enqueueAndSend } from "@/lib/notifications/dispatch";

const mockedEnqueue = enqueueAndSend as unknown as jest.Mock;

interface Fixture {
  standingOrder: any;
  overrides: any[];
  orderNumber: string;
  newOrderId: string;
}

function makeSvc(state: Fixture) {
  const captured: {
    orderInsert?: any;
    orderItemsInsert?: any[];
    standingOrderUpdate?: any;
    updatedStandingOrderId?: string;
  } = {};

  const handlers: Record<string, () => any> = {
    standing_orders: () => {
      let mode: "read" | "update" = "read";
      let updatePayload: any;
      let updateId: string | undefined;
      const b: any = {
        select: () => b,
        update: (v: any) => {
          mode = "update";
          updatePayload = v;
          return b;
        },
        eq: (_col: string, val: any) => {
          if (mode === "update") updateId = val;
          return b;
        },
        maybeSingle: () =>
          Promise.resolve({ data: state.standingOrder, error: null }),
        then: (res: any, rej: any) => {
          if (mode === "update") {
            captured.standingOrderUpdate = updatePayload;
            captured.updatedStandingOrderId = updateId;
          }
          return Promise.resolve({ data: null, error: null }).then(res, rej);
        },
      };
      return b;
    },
    account_pricing: () => {
      const b: any = {
        select: () => b,
        eq: () => b,
        then: (res: any, rej: any) =>
          Promise.resolve({ data: state.overrides, error: null }).then(res, rej),
      };
      return b;
    },
    orders: () => {
      let inserted: any;
      const b: any = {
        insert: (v: any) => {
          inserted = v;
          captured.orderInsert = v;
          return b;
        },
        select: () => b,
        single: () =>
          Promise.resolve({
            data: { id: state.newOrderId, ...inserted },
            error: null,
          }),
      };
      return b;
    },
    order_items: () => {
      const b: any = {
        insert: (v: any) => {
          captured.orderItemsInsert = v;
          return {
            then: (res: any, rej: any) =>
              Promise.resolve({ data: null, error: null }).then(res, rej),
          };
        },
      };
      return b;
    },
  };

  const svc: any = {
    rpc: () => Promise.resolve({ data: state.orderNumber, error: null }),
    from: (table: string) => {
      const h = handlers[table];
      if (!h) throw new Error(`unexpected table: ${table}`);
      return h();
    },
  };
  return { svc, captured };
}

const baseFixture = (over: Partial<Fixture["standingOrder"]> = {}): Fixture => ({
  standingOrder: {
    id: "so-1",
    account_id: "acc-1",
    profile_id: "prof-1",
    require_confirmation: false,
    account: { id: "acc-1", pricing_tier: "standard" },
    buyer: { id: "prof-1", phone: "+15555550100" },
    items: [
      {
        id: "soi-1",
        standing_order_id: "so-1",
        product_id: "p-1",
        quantity: 2,
        notes: null,
        product: { id: "p-1", wholesale_price: 10, retail_price: 15 },
      },
      {
        id: "soi-2",
        standing_order_id: "so-1",
        product_id: "p-2",
        quantity: 3,
        notes: "loose pack",
        product: { id: "p-2", wholesale_price: 4.25, retail_price: 7 },
      },
    ],
    ...over,
  },
  overrides: [],
  orderNumber: "FLF-1001",
  newOrderId: "order-xyz",
});

describe("runStandingOrder", () => {
  beforeEach(() => {
    mockedEnqueue.mockClear();
  });

  it("returns error when standing order not found", async () => {
    const { svc } = makeSvc({ ...baseFixture(), standingOrder: null });
    const res = await runStandingOrder(svc, "missing");
    expect(res.ok).toBe(false);
    expect(res.error).toBe("not found");
  });

  it("returns error when standing order has no items", async () => {
    const fx = baseFixture({ items: [] });
    const { svc } = makeSvc(fx);
    const res = await runStandingOrder(svc, "so-1");
    expect(res.ok).toBe(false);
    expect(res.error).toBe("no items");
  });

  it("creates an order with pending status when require_confirmation is false", async () => {
    const fx = baseFixture();
    const { svc, captured } = makeSvc(fx);
    const res = await runStandingOrder(svc, "so-1");

    expect(res.ok).toBe(true);
    expect(res.orderId).toBe("order-xyz");
    expect(captured.orderInsert.status).toBe("pending");
    expect(captured.orderInsert.order_type).toBe("b2b");
    expect(captured.orderInsert.payment_method).toBe("invoice");
    expect(captured.orderInsert.order_number).toBe("FLF-1001");
  });

  it("creates a draft order when require_confirmation is true", async () => {
    const fx = baseFixture({ require_confirmation: true });
    const { svc, captured } = makeSvc(fx);
    await runStandingOrder(svc, "so-1");
    expect(captured.orderInsert.status).toBe("draft");
  });

  it("computes subtotal at the standard wholesale tier", async () => {
    // 2 * 10 + 3 * 4.25 = 20 + 12.75 = 32.75
    const fx = baseFixture();
    const { svc, captured } = makeSvc(fx);
    await runStandingOrder(svc, "so-1");
    expect(captured.orderInsert.subtotal).toBe(32.75);
    expect(captured.orderInsert.total).toBe(32.75);
  });

  it("applies volume-tier multiplier", async () => {
    // volume = 0.92x:  2*(10*0.92)=18.4 + 3*(4.25*0.92=3.91)=11.73 → 30.13
    const fx = baseFixture();
    fx.standingOrder.account.pricing_tier = "volume";
    const { svc, captured } = makeSvc(fx);
    await runStandingOrder(svc, "so-1");
    expect(captured.orderInsert.subtotal).toBe(30.13);
  });

  it("honors account_pricing overrides over tier pricing", async () => {
    // override p-1 to 5.00; p-2 stays at 4.25
    // 2*5 + 3*4.25 = 10 + 12.75 = 22.75
    const fx = baseFixture();
    fx.overrides = [
      {
        id: "ap-1",
        account_id: "acc-1",
        product_id: "p-1",
        custom_price: 5,
        effective_date: "2020-01-01",
        expiry_date: null,
      },
    ];
    const { svc, captured } = makeSvc(fx);
    await runStandingOrder(svc, "so-1");
    expect(captured.orderInsert.subtotal).toBe(22.75);
  });

  it("writes one order_items row per item with correct unit_price and line_total", async () => {
    const fx = baseFixture();
    const { svc, captured } = makeSvc(fx);
    await runStandingOrder(svc, "so-1");

    expect(captured.orderItemsInsert).toHaveLength(2);
    const [it1, it2] = captured.orderItemsInsert!;
    expect(it1).toMatchObject({
      order_id: "order-xyz",
      product_id: "p-1",
      quantity: 2,
      unit_price: 10,
      line_total: 20,
    });
    expect(it2).toMatchObject({
      order_id: "order-xyz",
      product_id: "p-2",
      quantity: 3,
      unit_price: 4.25,
      line_total: 12.75,
      notes: "loose pack",
    });
  });

  it("updates standing_orders.last_run_date after success", async () => {
    const fx = baseFixture();
    const { svc, captured } = makeSvc(fx);
    await runStandingOrder(svc, "so-1");
    expect(captured.standingOrderUpdate.last_run_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(captured.updatedStandingOrderId).toBe("so-1");
  });

  it("sends a confirmation-style SMS when require_confirmation is true", async () => {
    const fx = baseFixture({ require_confirmation: true });
    const { svc } = makeSvc(fx);
    await runStandingOrder(svc, "so-1");

    expect(mockedEnqueue).toHaveBeenCalledTimes(1);
    const arg = mockedEnqueue.mock.calls[0][0];
    expect(arg.channel).toBe("sms");
    expect(arg.toAddress).toBe("+15555550100");
    expect(arg.body).toMatch(/CONFIRM/);
    expect(arg.type).toBe("standing_order_ready");
  });

  it("sends an auto-submit SMS when require_confirmation is false", async () => {
    const fx = baseFixture();
    const { svc } = makeSvc(fx);
    await runStandingOrder(svc, "so-1");

    expect(mockedEnqueue).toHaveBeenCalledTimes(1);
    const body: string = mockedEnqueue.mock.calls[0][0].body;
    expect(body).toMatch(/submitted automatically/);
    expect(body).toMatch(/\$32\.75/);
  });

  it("skips SMS entirely when buyer has no phone", async () => {
    const fx = baseFixture();
    fx.standingOrder.buyer.phone = null;
    const { svc } = makeSvc(fx);
    await runStandingOrder(svc, "so-1");
    expect(mockedEnqueue).not.toHaveBeenCalled();
  });
});
