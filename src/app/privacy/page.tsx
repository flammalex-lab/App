import Link from "next/link";
import { BrandLogo } from "@/components/Brand";

export const metadata = { title: "Privacy Policy — Fingerlakes Farms" };

const EFFECTIVE_DATE = "April 21, 2026";
const SUPPORT_EMAIL = "support@fingerlakesfarms.com";
const COMPANY_NAME = "Fingerlakes Farms";

export default function PrivacyPage() {
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
        <h1 className="display text-3xl mb-2">Privacy Policy</h1>
        <p className="text-sm text-ink-secondary mb-8">Effective {EFFECTIVE_DATE}</p>

        <Section title="Who we are">
          <p>
            {COMPANY_NAME} (&ldquo;we,&rdquo; &ldquo;us,&rdquo; &ldquo;our&rdquo;) operates
            an ordering portal for wholesale buyers and direct-to-consumer customers of
            New York State farm products. This policy explains what information we
            collect when you use the portal, how we use it, and who we share it with.
          </p>
        </Section>

        <Section title="Information we collect">
          <ul>
            <li>
              <strong>Account details:</strong> name, business name, email address,
              mobile phone number, delivery address.
            </li>
            <li>
              <strong>Order history:</strong> items ordered, quantities, delivery dates,
              order notes, standing-order schedules.
            </li>
            <li>
              <strong>Messaging:</strong> SMS messages you send to or receive from your
              account representative through the portal.
            </li>
            <li>
              <strong>Payment data (DTC only):</strong> processed by Stripe; we do not
              store full card numbers on our servers.
            </li>
            <li>
              <strong>Technical data:</strong> basic device and browser information,
              log timestamps, and error reports needed to operate the service.
            </li>
          </ul>
        </Section>

        <Section title="How we use your information">
          <ul>
            <li>To authenticate your account via one-time passcodes sent by SMS.</li>
            <li>To fulfill orders, schedule deliveries, and send delivery updates.</li>
            <li>To support your account through direct messaging with your rep.</li>
            <li>To operate, secure, and improve the portal.</li>
            <li>To comply with tax, accounting, and other legal obligations.</li>
          </ul>
        </Section>

        <Section title="SMS and phone number data">
          <p>
            <strong>
              Mobile phone numbers and SMS opt-in data are never sold, rented, or
              shared with third parties for their own marketing purposes, and we do
              not share this information with affiliates for marketing.
            </strong>{" "}
            Phone numbers are used solely to authenticate you (login one-time
            passcodes) and to communicate with you about your account and orders.
            SMS traffic is delivered through our messaging provider (Twilio) and
            your mobile carrier; those parties process the data only to deliver the
            message.
          </p>
        </Section>

        <Section title="Who we share data with">
          <p>We share information only with service providers that help us operate the portal:</p>
          <ul>
            <li><strong>Supabase</strong> — database and authentication.</li>
            <li><strong>Twilio</strong> — SMS delivery for login codes and account messaging.</li>
            <li><strong>Stripe</strong> — card processing for direct-to-consumer orders.</li>
            <li><strong>Vercel</strong> — hosting.</li>
            <li><strong>QuickBooks</strong> — invoicing for wholesale accounts.</li>
          </ul>
          <p>
            We may also disclose information when required by law or to protect the
            rights, property, or safety of our customers, our company, or others.
          </p>
        </Section>

        <Section title="Data retention">
          <p>
            We retain account and order records for as long as your account is active
            and for the period required by applicable tax and accounting law. You
            can request deletion of your account at any time by contacting us.
          </p>
        </Section>

        <Section title="Your choices">
          <ul>
            <li>
              <strong>Opt out of SMS:</strong> reply <strong>STOP</strong> to any
              message from us. You can also email us to disable SMS on your account.
              Opting out will prevent SMS-based login; you can switch to email login.
            </li>
            <li>
              <strong>Access or correct your data:</strong> email us and we will
              respond within 30 days.
            </li>
            <li>
              <strong>Delete your account:</strong> email us to request deletion,
              subject to record-keeping obligations.
            </li>
          </ul>
        </Section>

        <Section title="Children">
          <p>
            The portal is intended for business buyers and adult direct-to-consumer
            customers. We do not knowingly collect information from children under 13.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            We may update this policy from time to time. If we make material changes,
            we will notify you by email or through the portal before they take effect.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about this policy? Email{" "}
            <a className="text-brand-blue underline" href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </Section>

        <div className="mt-12 pt-6 border-t border-black/5 text-sm text-ink-secondary">
          See also our{" "}
          <Link href="/terms" className="text-brand-blue underline">
            Terms and Conditions
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
