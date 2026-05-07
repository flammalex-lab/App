import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/utils/phone";

/**
 * Public lead-capture endpoint backing /register.
 *
 * Creates a `prospect` account (status='prospect') with the contact
 * details the visitor provided. The rep triages from /admin/accounts and
 * uses the existing Quick Add Buyer flow to convert into a real
 * profile + auth user when ready.
 *
 * No auth user is created here — that prevents orphaned auth.users rows
 * for partial submissions and means the rep retains full control over
 * who actually gets a sign-in path.
 */
interface Body {
  name?: string;
  email?: string;
  phone?: string;
  accountName?: string;
  role?: string;
  smsConsent?: boolean;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Body;

  const name = body.name?.trim() || "";
  const email = body.email?.trim() || "";
  const accountName = body.accountName?.trim() || "";
  const role = body.role?.trim() || "";
  const rawPhone = body.phone?.trim() || "";
  const phone = rawPhone ? normalizePhone(rawPhone) : null;

  if (rawPhone && !phone) {
    return NextResponse.json({ error: "That phone number doesn't look right." }, { status: 400 });
  }

  // Need at least one piece of contact info — otherwise the rep has
  // nothing to follow up on. Don't surface this as a field-level error
  // (the form is intentionally label-free); just a single line.
  if (!name && !email && !phone && !accountName) {
    return NextResponse.json({ error: "Tell us a little about you." }, { status: 400 });
  }

  const svc = createServiceClient();
  const displayName =
    accountName || name || (phone ? phone : email) || "Prospect";

  const noteParts: string[] = [];
  if (role) noteParts.push(`Role: ${role}`);
  if (body.smsConsent) noteParts.push("SMS opt-in at signup");

  const { error } = await svc.from("accounts").insert({
    name: displayName,
    type: "other",
    channel: "foodservice",
    status: "prospect",
    primary_contact_name: name || null,
    primary_contact_email: email || null,
    primary_contact_phone: phone,
    source: "register",
    notes: noteParts.length ? noteParts.join(" · ") : null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
