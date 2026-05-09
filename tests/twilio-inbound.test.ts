/**
 * Tests for /api/sms/inbound. The route handler does signature
 * verification, the deployed-env override of ALLOW_UNSIGNED_TWILIO,
 * profile lookup with duplicate detection, multi-account routing, and
 * the sms_triage / messages-fallback path for unknown phones.
 */

const mockValidateTwilioSignature = jest.fn();
jest.mock("@/lib/twilio/client", () => ({
  validateTwilioSignature: mockValidateTwilioSignature,
}));

const mockSvc = { from: jest.fn() };
jest.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => mockSvc,
}));

import { POST } from "@/app/api/sms/inbound/route";

// process.env.NODE_ENV is typed readonly (Next types) — use a typed
// helper so we don't paper over it with `as any` everywhere.
function setEnv(key: string, value: string | undefined): void {
  if (value === undefined) delete (process.env as Record<string, string | undefined>)[key];
  else (process.env as Record<string, string | undefined>)[key] = value;
}

const ORIG_ENV = {
  NODE_ENV: process.env.NODE_ENV,
  VERCEL_ENV: process.env.VERCEL_ENV,
  ALLOW_UNSIGNED_TWILIO: process.env.ALLOW_UNSIGNED_TWILIO,
};
afterAll(() => {
  Object.entries(ORIG_ENV).forEach(([k, v]) => setEnv(k, v));
});

beforeEach(() => {
  mockValidateTwilioSignature.mockReset();
  mockSvc.from.mockReset();
  delete process.env.VERCEL_ENV;
  delete process.env.ALLOW_UNSIGNED_TWILIO;
  // Suppress the deployed-env warning + bookkeeping logs in tests.
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

function req(params: Record<string, string>, sig = "fake-sig"): Request {
  const form = new URLSearchParams(params);
  return new Request("https://example.com/api/sms/inbound", {
    method: "POST",
    headers: {
      "x-twilio-signature": sig,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
}

describe("twilio inbound — signature verification", () => {
  it("returns 403 on bad signature", async () => {
    mockValidateTwilioSignature.mockResolvedValue(false);
    setEnv("NODE_ENV", "test"); // not deployed
    const r = await POST(req({ From: "+15551234567", Body: "hi" }));
    expect(r.status).toBe(403);
  });

  it("accepts unsigned in dev when ALLOW_UNSIGNED_TWILIO=true", async () => {
    mockValidateTwilioSignature.mockResolvedValue(false);
    setEnv("NODE_ENV", "development");
    process.env.ALLOW_UNSIGNED_TWILIO = "true";
    // No matching profile → falls through to triage; that's fine for this test.
    mockSvc.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
      insert: () => Promise.resolve({ data: null, error: null }),
    });
    const r = await POST(req({ From: "+15551234567", Body: "hi" }));
    expect(r.status).toBe(200);
  });

  it("REFUSES unsigned even with ALLOW_UNSIGNED_TWILIO=true in production", async () => {
    mockValidateTwilioSignature.mockResolvedValue(false);
    setEnv("NODE_ENV", "production");
    process.env.ALLOW_UNSIGNED_TWILIO = "true";
    const r = await POST(req({ From: "+15551234567", Body: "hi" }));
    expect(r.status).toBe(403);
  });

  it("REFUSES unsigned even with ALLOW_UNSIGNED_TWILIO=true on Vercel preview", async () => {
    mockValidateTwilioSignature.mockResolvedValue(false);
    setEnv("NODE_ENV", "test");
    process.env.VERCEL_ENV = "preview";
    process.env.ALLOW_UNSIGNED_TWILIO = "true";
    const r = await POST(req({ From: "+15551234567", Body: "hi" }));
    expect(r.status).toBe(403);
  });
});

describe("twilio inbound — profile resolution", () => {
  beforeEach(() => {
    mockValidateTwilioSignature.mockResolvedValue(true);
    setEnv("NODE_ENV", "test");
  });

  it("inserts a message and returns 200 (TwiML) on a matched profile with account_id", async () => {
    let capturedMessage: any;
    mockSvc.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () =>
                  Promise.resolve({
                    data: [{ id: "prof_1", account_id: "acct_1" }],
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      if (table === "messages") {
        return {
          insert: (row: any) => {
            capturedMessage = row;
            return Promise.resolve({ data: null, error: null });
          },
        };
      }
      return {} as any;
    });
    const r = await POST(req({ From: "+15551234567", Body: "hello there" }));
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("text/xml");
    expect(capturedMessage).toMatchObject({
      account_id: "acct_1",
      from_profile_id: "prof_1",
      body: "hello there",
      direction: "inbound",
    });
  });

  it("warns and uses oldest match when phone matches >1 profile", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    let capturedMessage: any;
    mockSvc.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () =>
                  Promise.resolve({
                    data: [
                      { id: "prof_old", account_id: "acct_old" },
                      { id: "prof_new", account_id: "acct_new" },
                    ],
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      if (table === "messages") {
        return {
          insert: (row: any) => {
            capturedMessage = row;
            return Promise.resolve({ data: null, error: null });
          },
        };
      }
      return {} as any;
    });
    const r = await POST(req({ From: "+15551234567", Body: "dup" }));
    expect(r.status).toBe(200);
    expect(capturedMessage.from_profile_id).toBe("prof_old");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/duplicate profiles share phone/),
    );
  });

  it("falls back to profile_accounts default for a profile with null account_id", async () => {
    let capturedMessage: any;
    mockSvc.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () =>
                  Promise.resolve({
                    data: [{ id: "prof_multi", account_id: null }],
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      if (table === "profile_accounts") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                order: () => ({
                  limit: () =>
                    Promise.resolve({
                      data: [{ account_id: "acct_default" }],
                      error: null,
                    }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "messages") {
        return {
          insert: (row: any) => {
            capturedMessage = row;
            return Promise.resolve({ data: null, error: null });
          },
        };
      }
      return {} as any;
    });
    const r = await POST(req({ From: "+15551234567", Body: "via default" }));
    expect(r.status).toBe(200);
    expect(capturedMessage.account_id).toBe("acct_default");
  });
});

describe("twilio inbound — unknown phone", () => {
  beforeEach(() => {
    mockValidateTwilioSignature.mockResolvedValue(true);
    setEnv("NODE_ENV", "test");
  });

  it("inserts into sms_triage when phone matches no profile", async () => {
    let capturedTriage: any;
    mockSvc.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "sms_triage") {
        return {
          insert: (row: any) => {
            capturedTriage = row;
            return Promise.resolve({ data: null, error: null });
          },
        };
      }
      return {} as any;
    });
    const r = await POST(req({ From: "+15559999999", Body: "ghost" }));
    expect(r.status).toBe(200);
    expect(capturedTriage).toMatchObject({
      from_phone: "+15559999999",
      body: "ghost",
    });
  });

  it("falls back to messages.account_id=null when sms_triage insert fails", async () => {
    let capturedFallback: any;
    mockSvc.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "sms_triage") {
        return {
          insert: () =>
            Promise.resolve({
              data: null,
              error: { message: 'relation "sms_triage" does not exist' },
            }),
        };
      }
      if (table === "messages") {
        return {
          insert: (row: any) => {
            capturedFallback = row;
            return Promise.resolve({ data: null, error: null });
          },
        };
      }
      return {} as any;
    });
    const r = await POST(req({ From: "+15559999999", Body: "ghost" }));
    expect(r.status).toBe(200);
    expect(capturedFallback).toMatchObject({
      account_id: null,
      from_profile_id: null,
      body: expect.stringMatching(/\[unmatched \+15559999999\] ghost/),
    });
  });

  it("returns 500 (Twilio retries) when BOTH triage and messages fallback fail", async () => {
    mockSvc.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "sms_triage") {
        return {
          insert: () => Promise.resolve({ data: null, error: { message: "no triage" } }),
        };
      }
      if (table === "messages") {
        return {
          insert: () => Promise.resolve({ data: null, error: { message: "no messages either" } }),
        };
      }
      return {} as any;
    });
    const r = await POST(req({ From: "+15559999999", Body: "ghost" }));
    expect(r.status).toBe(500);
  });
});
