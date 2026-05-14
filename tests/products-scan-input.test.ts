import { isValidBarcode } from "@/app/api/products/scan/route";

describe("isValidBarcode", () => {
  it("accepts a 12-digit UPC-A barcode", () => {
    expect(isValidBarcode("012345678901")).toBe(true);
  });

  it("accepts alphanumeric SKUs with hyphen and underscore", () => {
    expect(isValidBarcode("abc-123_xyz")).toBe(true);
  });

  it("accepts real-world SKU shapes from the seed data", () => {
    expect(isValidBarcode("BF-STR-001")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(isValidBarcode("")).toBe(false);
  });

  it("rejects PostgREST filter injection via comma + clause", () => {
    expect(isValidBarcode("foo,id.eq.bar")).toBe(false);
  });

  it("rejects strings longer than 32 characters", () => {
    expect(isValidBarcode("a".repeat(100))).toBe(false);
    expect(isValidBarcode("a".repeat(33))).toBe(false);
  });

  it("rejects ilike wildcards", () => {
    expect(isValidBarcode("*")).toBe(false);
    expect(isValidBarcode("foo*")).toBe(false);
    expect(isValidBarcode("%")).toBe(false);
  });

  it("rejects parentheses and other PostgREST grammar chars", () => {
    expect(isValidBarcode("foo)")).toBe(false);
    expect(isValidBarcode("foo.bar")).toBe(false);
    expect(isValidBarcode("foo bar")).toBe(false);
  });
});
