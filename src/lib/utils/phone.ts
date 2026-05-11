/**
 * E.164 normalization for US numbers.
 * Accepts "(555) 123-4567", "555-123-4567", "+15551234567", etc.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = input.replace(/\D+/g, "");
  if (!digits) return null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (input.startsWith("+") && digits.length >= 10) return `+${digits}`;
  return null;
}

export function prettyPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  // Tolerate legacy rows stored without the leading "+" (e.g. "16073514737")
  // so the account page doesn't fall through to displaying raw digits.
  const digits = e164.replace(/\D+/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return e164;
}
