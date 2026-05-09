import { normalizePhone, prettyPhone } from "@/lib/utils/phone";

describe("normalizePhone", () => {
  it("returns null for null/undefined/empty", () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("   ")).toBeNull();
  });

  it("normalizes a 10-digit US number to +1 prefix", () => {
    expect(normalizePhone("5551234567")).toBe("+15551234567");
  });

  it("strips formatting from a 10-digit US number", () => {
    expect(normalizePhone("(555) 123-4567")).toBe("+15551234567");
    expect(normalizePhone("555-123-4567")).toBe("+15551234567");
    expect(normalizePhone("555.123.4567")).toBe("+15551234567");
    expect(normalizePhone("555 123 4567")).toBe("+15551234567");
  });

  it("accepts 11-digit numbers with leading 1", () => {
    expect(normalizePhone("15551234567")).toBe("+15551234567");
    expect(normalizePhone("1-555-123-4567")).toBe("+15551234567");
  });

  it("accepts already-E.164 numbers", () => {
    expect(normalizePhone("+15551234567")).toBe("+15551234567");
  });

  it("accepts non-US E.164 numbers (preserves country code)", () => {
    expect(normalizePhone("+447911123456")).toBe("+447911123456"); // UK
    expect(normalizePhone("+33612345678")).toBe("+33612345678");   // FR
  });

  it("rejects too-short numbers", () => {
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("555-1234")).toBeNull();
    expect(normalizePhone("555 12345")).toBeNull(); // 8 digits
  });

  it("rejects 11-digit non-US numbers without + prefix", () => {
    // 44... without + and not starting with 1 → ambiguous, reject.
    expect(normalizePhone("44791112345")).toBeNull();
  });

  it("rejects all-letters input", () => {
    expect(normalizePhone("abcdefghij")).toBeNull();
    expect(normalizePhone("not-a-phone")).toBeNull();
  });

  it("rejects mixed input that ends up too short after digit-strip", () => {
    expect(normalizePhone("call me at 555")).toBeNull();
  });
});

describe("prettyPhone", () => {
  it("formats US E.164 numbers as (NNN) NNN-NNNN", () => {
    expect(prettyPhone("+15551234567")).toBe("(555) 123-4567");
  });

  it("returns empty string for null / undefined / empty", () => {
    expect(prettyPhone(null)).toBe("");
    expect(prettyPhone(undefined)).toBe("");
    expect(prettyPhone("")).toBe("");
  });

  it("falls back to the raw value for non-US E.164", () => {
    expect(prettyPhone("+447911123456")).toBe("+447911123456");
    expect(prettyPhone("+33612345678")).toBe("+33612345678");
  });

  it("falls back to the raw value for malformed input", () => {
    expect(prettyPhone("not-a-phone")).toBe("not-a-phone");
  });

  it("round-trips with normalizePhone", () => {
    const raw = "(555) 987-6543";
    const normalized = normalizePhone(raw)!;
    expect(prettyPhone(normalized)).toBe(raw);
  });
});
