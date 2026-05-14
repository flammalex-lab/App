/**
 * Pure input-validation tests for the multi-list API routes. These do not
 * touch Supabase — they exercise the exported `validate…` helpers so we
 * can run them in CI without spinning up the DB.
 */
import { validateRenameBody } from "@/app/api/lists/[id]/route";
import { validateAddItemBody } from "@/app/api/lists/[id]/items/route";

describe("validateRenameBody", () => {
  it("rejects non-object bodies", () => {
    expect(validateRenameBody(null).ok).toBe(false);
    expect(validateRenameBody(undefined).ok).toBe(false);
    expect(validateRenameBody("Monday list").ok).toBe(false);
    expect(validateRenameBody(42).ok).toBe(false);
  });

  it("rejects missing or non-string names", () => {
    const r1 = validateRenameBody({});
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.error).toBe("missing_name");

    const r2 = validateRenameBody({ name: 42 });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.error).toBe("missing_name");
  });

  it("rejects whitespace-only names", () => {
    const r = validateRenameBody({ name: "   " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("missing_name");
  });

  it("rejects names longer than 60 chars", () => {
    const r = validateRenameBody({ name: "x".repeat(61) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("name_too_long");
  });

  it("accepts the boundary length of 60", () => {
    const r = validateRenameBody({ name: "x".repeat(60) });
    expect(r.ok).toBe(true);
  });

  it("trims surrounding whitespace", () => {
    const r = validateRenameBody({ name: "  Monday prep  " });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.name).toBe("Monday prep");
  });
});

describe("validateAddItemBody", () => {
  it("rejects non-object bodies", () => {
    expect(validateAddItemBody(null).ok).toBe(false);
    expect(validateAddItemBody("abc").ok).toBe(false);
  });

  it("rejects missing or non-string product_id", () => {
    const r1 = validateAddItemBody({});
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.error).toBe("missing_product_id");

    const r2 = validateAddItemBody({ product_id: 42 });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.error).toBe("missing_product_id");

    const r3 = validateAddItemBody({ product_id: "" });
    expect(r3.ok).toBe(false);
    if (!r3.ok) expect(r3.error).toBe("missing_product_id");
  });

  it("rejects product ids longer than 64 chars (PostgREST injection guard)", () => {
    const r = validateAddItemBody({ product_id: "x".repeat(65) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("invalid_product_id");
  });

  it("accepts a v4 UUID", () => {
    const r = validateAddItemBody({
      product_id: "00000000-0000-4000-8000-000000000000",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.productId).toBe("00000000-0000-4000-8000-000000000000");
  });
});
