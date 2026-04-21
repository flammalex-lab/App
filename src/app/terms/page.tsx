import Link from "next/link";
import { BrandLogo } from "@/components/Brand";

export const metadata = { title: "Terms and Conditions — Fingerlakes Farms" };

const EFFECTIVE_DATE = "April 21, 2026";
const SUPPORT_EMAIL = "alex@ilovenyfarms.com";
const PROGRAM_NAME = "FingerLakes Farms LLC";
const COMPANY_NAME = "Fingerlakes Farms";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-bg-primary">
      <header className="border-b border-black/5 bg-white">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <BrandLogo size={32} />
            <span className="display text-lg tracking-tight">Fingerlakes Farms</span>
          </Link>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="display text-3xl mb-2">Terms and Conditions</h1>
        <p className="text-sm text-ink-secondary mb-8">Effective {EFFECTIVE_DATE}</p>

        <Section title="Use of the portal">
          <p>
            By creating an account or placing an order through {COMPANY_NAME}, you
            agree to these terms. If you do not agree, do not use the portal.
          </p>
        </Section>

        <Section title="Accounts">
          <p>
            You are responsible for the accuracy of the information you provide and
            for activity that happens under your account. Keep your login phone or
            email up to date so one-time login codes can reach you.
          </p>
        </Section>

        <Section title="Orders, pricing, and delivery">
          <ul>
            <li>
              Prices shown are per the pricing tier assigned to your account. Wholesale
              pricing is confidential and account-specific.
            </li>
            <li>
              Orders are subject to availability. If an item becomes unavailable after
              you order, we will contact you to adjust before delivery.
            </li>
            <li>
              Delivery windows are posted per-zone; cutoff times appear on every page.
            </li>
            <li>
              Wholesale accounts are billed by invoice through QuickBooks. DTC orders
              are charged at checkout via Stripe.
            </li>
          </ul>
        </Section>

        <Section title="SMS messaging program">
          <p>
            <strong>Program name:</strong> {PROGRAM_NAME}.
          </p>
          <p>
            <strong>Description:</strong> {COMPANY_NAME} uses SMS to send one-time
            login codes, order confirmations, delivery updates, and direct messages
            between you and your account representative.
          </p>
          <p>
            <strong>How to opt in:</strong> by entering your mobile phone number at
            sign-in or account setup, you consent to receive SMS from us related to
            your account and orders.
          </p>
          <p>
            <strong>Message frequency:</strong> recurring, varies by your ordering
            activity. Typical active accounts receive 1 to 20 messages per month.
          </p>
          <p>
            <strong>Message and data rates may apply.</strong> Rates are set by your
            mobile carrier; check your plan for details.
          </p>
          <p>
            <strong>To get help, text <span className="font-bold">HELP</span></strong>{" "}
            to any message from us, or email{" "}
            <a className="text-brand-blue underline" href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
          <p>
            <strong>To opt out, text <span className="font-bold">STOP</span></strong>{" "}
            to any message from us at any time. After you send STOP we will send one
            confirmation message and will not send further SMS to that number. Opting
            out of SMS will disable SMS-based login; you can switch to email login
            instead.
          </p>
          <p>
            <strong>Carriers:</strong> supported on major U.S. carriers. Carriers are
            not liable for delayed or undelivered messages.
          </p>
          <p>
            <strong>Privacy:</strong> mobile phone numbers and SMS opt-in data are
            never sold, rented, or shared with third parties for their own marketing
            purposes. See our{" "}
            <Link href="/privacy" className="text-brand-blue underline">
              Privacy Policy
            </Link>{" "}
            for details.
          </p>
        </Section>

        <Section title="Acceptable use">
          <ul>
            <li>Don&rsquo;t attempt to access accounts, data, or systems that aren&rsquo;t yours.</li>
            <li>Don&rsquo;t use the messaging bridge to send unlawful, harassing, or commercial-bulk content.</li>
            <li>Don&rsquo;t reverse-engineer or interfere with the portal&rsquo;s operation.</li>
          </ul>
        </Section>

        <Section title="Payment terms (wholesale)">
          <p>
            Wholesale invoices are due per the terms on your account (typically Net 15
            or Net 30). Late balances may pause ordering privileges until resolved.
          </p>
        </Section>

        <Section title="Returns and adjustments">
          <p>
            Because we ship perishable farm product, report any short, damaged, or
            quality issues to your rep within 24 hours of delivery and we&rsquo;ll
            credit or replace.
          </p>
        </Section>

        <Section title="Disclaimers">
          <p>
            The portal is provided &ldquo;as is.&rdquo; To the fullest extent
            permitted by law, {COMPANY_NAME} disclaims all implied warranties and is
            not liable for indirect, incidental, or consequential damages arising
            from your use of the portal.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            We may update these terms from time to time. If we make material changes,
            we will notify you by email or through the portal before they take effect.
            Continued use after the effective date means you accept the updated terms.
          </p>
        </Section>

        <Section title="Governing law">
          <p>
            These terms are governed by the laws of the State of New York, without
            regard to conflict-of-law principles.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about these terms? Email{" "}
            <a className="text-brand-blue underline" href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </Section>

        <div className="mt-12 pt-6 border-t border-black/5 text-sm text-ink-secondary">
          See also our{" "}
          <Link href="/privacy" className="text-brand-blue underline">
            Privacy Policy
          </Link>
          .
        </div>
      </article>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-xl mb-3">{title}</h2>
      <div className="text-ink-primary leading-relaxed space-y-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2">
        {children}
      </div>
    </section>
  );
}
