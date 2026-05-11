import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Chip, StatusBadge } from "@/components/ui/Badge";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { BrandLogo, BrandWordmark } from "@/components/Brand";
import { StyleDemos } from "./demos";

export const metadata: Metadata = {
  title: "Design system · Fingerlakes Farms",
  description: "Live tokens + components for the FLF buyer portal.",
  robots: { index: false, follow: false },
};

export default function StylePage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-black/[0.08] bg-white sticky top-0 z-10">
        <div className="max-w-screen-lg mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandLogo size={32} />
            <BrandWordmark size="md" href="/style" />
            <span className="badge-blue ml-2">Design system</span>
          </div>
          <nav className="hidden md:flex items-center gap-5 text-sm text-ink-secondary">
            <a href="#brand" className="hover:text-ink-primary">Brand</a>
            <a href="#color" className="hover:text-ink-primary">Color</a>
            <a href="#type" className="hover:text-ink-primary">Type</a>
            <a href="#components" className="hover:text-ink-primary">Components</a>
            <a href="#motion" className="hover:text-ink-primary">Motion</a>
            <a href="#voice" className="hover:text-ink-primary">Voice</a>
          </nav>
        </div>
      </header>

      <main className="max-w-screen-lg mx-auto px-6 py-10 space-y-16">
        <section>
          <h1 className="display text-4xl md:text-5xl tracking-tight">
            Fingerlakes Farms design system
          </h1>
          <p className="mt-3 text-ink-secondary max-w-2xl leading-relaxed">
            The live tokens, primitives, and voice that power the buyer
            portal. Everything here renders from the real Tailwind config
            and component library — if it drifts, the page drifts with it.
          </p>
          <p className="mt-2 text-sm text-ink-tertiary">
            B2B-first. Editorial, not corporate. Trust our process. Trust your food.
          </p>
        </section>

        {/* ─── Brand ─── */}
        <Section id="brand" title="Brand" eyebrow="01">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="card p-6 flex flex-col items-center justify-center gap-4 text-center">
              <BrandLogo size={96} />
              <BrandWordmark size="lg" href={null} />
              <p className="text-xs text-ink-tertiary">
                Circular mark + wordmark. Mark stands alone on mobile; pair them on desktop.
              </p>
            </div>
            <div className="card p-6 flex flex-col justify-center gap-3">
              <div className="display text-2xl leading-tight">
                Trust our process. Trust your food.
              </div>
              <p className="text-sm text-ink-secondary">
                Tagline. Two short sentences, declarative. Don&apos;t split, paraphrase, or pad.
              </p>
              <div className="mt-2 text-xs text-ink-tertiary">
                Voice: editorial, farm-forward, first-person plural.
                <br />
                Tone: warm, confident, never salesy.
              </div>
            </div>
          </div>
        </Section>

        {/* ─── Color ─── */}
        <Section id="color" title="Color" eyebrow="02">
          <SubHeading>Brand</SubHeading>
          <SwatchGrid
            swatches={[
              { name: "brand-blue", hex: "#1763B5", role: "Primary action, links" },
              { name: "brand-blue-dark", hex: "#0F4A8A", role: "Hover / pressed" },
              { name: "brand-blue-tint", hex: "#E5EFF8", role: "Selected wash" },
              { name: "brand-green", hex: "#2A9B46", role: "Success, freshness" },
              { name: "brand-green-dark", hex: "#1F7A35", role: "Success hover" },
              { name: "brand-green-tint", hex: "#E6F4EA", role: "Success wash" },
            ]}
          />

          <SubHeading>Accent</SubHeading>
          <SwatchGrid
            swatches={[
              { name: "accent-gold", hex: "#C49431", role: "Pending, warning" },
              { name: "accent-rust", hex: "#A0522D", role: "Editorial accent" },
            ]}
          />

          <SubHeading>Ink &amp; surface</SubHeading>
          <SwatchGrid
            swatches={[
              { name: "ink-primary", hex: "#161616", role: "Body text, headings" },
              { name: "ink-secondary", hex: "#5E5E5E", role: "Supporting copy" },
              { name: "ink-tertiary", hex: "#9A9A9A", role: "Captions, placeholder" },
              { name: "bg-primary", hex: "#FFFFFF", role: "Page surface", light: true },
              { name: "bg-secondary", hex: "#F4F4F1", role: "Hover, thumbs", light: true },
              { name: "bg-tinted", hex: "#EAF1F6", role: "Highlight wash", light: true },
            ]}
          />

          <SubHeading>Feedback</SubHeading>
          <SwatchGrid
            swatches={[
              { name: "feedback-success", hex: "#2A9B46", role: "Confirmations" },
              { name: "feedback-warning", hex: "#C49431", role: "Cutoff approaching" },
              { name: "feedback-error", hex: "#C13A28", role: "Errors, cancellations" },
            ]}
          />
        </Section>

        {/* ─── Typography ─── */}
        <Section id="type" title="Typography" eyebrow="03">
          <div className="space-y-6">
            <SpecRow spec="Display · Bricolage Grotesque · 800 · -0.025em">
              <div className="display text-5xl leading-tight">
                Local connection
              </div>
              <div className="text-xs text-ink-tertiary mt-1 font-mono">
                .display · h1 · 48–60px
              </div>
            </SpecRow>

            <SpecRow spec="H2 · Bricolage · 700 · -0.015em">
              <h2 className="text-3xl">Our growers</h2>
              <div className="text-xs text-ink-tertiary mt-1 font-mono">
                h2 · 30px
              </div>
            </SpecRow>

            <SpecRow spec="H3 · Bricolage · 700">
              <h3 className="text-xl">This week&apos;s deliveries</h3>
              <div className="text-xs text-ink-tertiary mt-1 font-mono">
                h3 · 20px
              </div>
            </SpecRow>

            <SpecRow spec="Body · Inter · 400">
              <p className="text-base text-ink-primary max-w-prose leading-relaxed">
                Decades of distribution experience across the Finger Lakes
                region. We vet every grower so you don&apos;t have to —
                that&apos;s the ThumbsUp™ Process.
              </p>
              <div className="text-xs text-ink-tertiary mt-1 font-mono">
                body · 16px · leading-relaxed
              </div>
            </SpecRow>

            <SpecRow spec="Supporting · Inter · text-ink-secondary">
              <p className="text-sm text-ink-secondary max-w-prose">
                Used for product descriptions, helper hints, and meta rows.
              </p>
              <div className="text-xs text-ink-tertiary mt-1 font-mono">
                text-sm · text-ink-secondary
              </div>
            </SpecRow>

            <SpecRow spec="Caption · text-xs · ink-tertiary">
              <p className="text-xs text-ink-tertiary uppercase tracking-wide">
                Cutoff · Tue 2pm · Zone 3
              </p>
              <div className="text-xs text-ink-tertiary mt-1 font-mono">
                text-xs · uppercase · tracking-wide
              </div>
            </SpecRow>

            <SpecRow spec="Tabular numerals · .tabular">
              <div className="tabular text-base text-ink-primary">
                $148.20 &nbsp;·&nbsp; 24 cases &nbsp;·&nbsp; SKU 1208-A
              </div>
              <div className="text-xs text-ink-tertiary mt-1 font-mono">
                .tabular · for prices, qty, SKU
              </div>
            </SpecRow>
          </div>
        </Section>

        {/* ─── Spacing ─── */}
        <Section id="spacing" title="Spacing &amp; radius" eyebrow="04">
          <SubHeading>Spacing scale (Tailwind default)</SubHeading>
          <div className="flex flex-wrap items-end gap-4">
            {[
              { name: "1", px: 4 },
              { name: "2", px: 8 },
              { name: "3", px: 12 },
              { name: "4", px: 16 },
              { name: "6", px: 24 },
              { name: "8", px: 32 },
              { name: "12", px: 48 },
              { name: "16", px: 64 },
            ].map((s) => (
              <div key={s.name} className="flex flex-col items-center gap-1.5">
                <div
                  className="bg-brand-blue rounded"
                  style={{ width: s.px, height: s.px }}
                />
                <div className="text-xs font-mono text-ink-tertiary">
                  {s.name} · {s.px}px
                </div>
              </div>
            ))}
          </div>

          <SubHeading>Radius</SubHeading>
          <div className="flex flex-wrap gap-4">
            {[
              { name: "rounded", cls: "rounded" },
              { name: "rounded-md", cls: "rounded-md" },
              { name: "rounded-lg", cls: "rounded-lg" },
              { name: "rounded-xl", cls: "rounded-xl" },
              { name: "rounded-2xl", cls: "rounded-2xl" },
              { name: "rounded-full", cls: "rounded-full" },
            ].map((r) => (
              <div key={r.name} className="flex flex-col items-center gap-1.5">
                <div
                  className={`${r.cls} bg-bg-secondary border border-black/10 h-16 w-16`}
                />
                <div className="text-xs font-mono text-ink-tertiary">{r.name}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* ─── Shadows ─── */}
        <Section id="shadow" title="Shadow" eyebrow="05">
          <p className="text-sm text-ink-secondary mb-4 max-w-prose">
            White surfaces read via border + spacing, not background. Shadow is
            reserved for things that float above the page.
          </p>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { name: "shadow-card", cls: "shadow-card", note: "Default card" },
              { name: "shadow-sticky", cls: "shadow-sticky", note: "Sticky cart bar (upward)" },
              { name: "shadow-floating", cls: "shadow-floating", note: "Modals, dropdowns" },
            ].map((s) => (
              <div
                key={s.name}
                className={`rounded-xl bg-white p-5 ${s.cls}`}
              >
                <div className="text-sm font-medium">{s.name}</div>
                <div className="text-xs text-ink-tertiary mt-1">{s.note}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* ─── Components ─── */}
        <Section id="components" title="Components" eyebrow="06">
          <SubHeading>Buttons</SubHeading>
          <div className="card p-5 space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button variant="primary">Add to order</Button>
              <Button variant="secondary">View guide</Button>
              <Button variant="ghost">Cancel</Button>
              <Button variant="danger">Remove item</Button>
              <button className="btn-success">Place order</button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
              <Button disabled>Disabled</Button>
              <StyleDemos.LoadingButton />
            </div>
            <p className="text-xs text-ink-tertiary">
              Primary = brand-blue. Success (Place order) = brand-green — only
              for the commit step. Don&apos;t use green for routine actions.
            </p>
          </div>

          <SubHeading>Form fields</SubHeading>
          <div className="card p-5 grid md:grid-cols-2 gap-4">
            <Field label="Account name" hint="Visible on invoices.">
              <Input placeholder="Hartke Farm Restaurant" />
            </Field>
            <Field label="Delivery zone" hint="Determines cutoff windows.">
              <Input defaultValue="Zone 3 · Tue / Fri" readOnly />
            </Field>
            <Field label="PO number">
              <Input placeholder="Optional" />
            </Field>
            <Field label="Delivery note" hint="Visible to the driver.">
              <Textarea placeholder="Leave at back door, ring kitchen bell." />
            </Field>
          </div>

          <SubHeading>Quantity input</SubHeading>
          <div className="card p-5 flex items-center gap-4">
            <StyleDemos.QtyDemo />
            <div className="text-xs text-ink-tertiary">
              Tap commits on blur. Empty value removes the line.
            </div>
          </div>

          <SubHeading>Badges &amp; chips</SubHeading>
          <div className="card p-5 space-y-4">
            <div>
              <div className="text-xs text-ink-tertiary mb-2 font-mono">Order status</div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge status="draft" />
                <StatusBadge status="pending" />
                <StatusBadge status="confirmed" />
                <StatusBadge status="processing" />
                <StatusBadge status="ready" />
                <StatusBadge status="shipped" />
                <StatusBadge status="delivered" />
                <StatusBadge status="cancelled" />
              </div>
            </div>
            <div>
              <div className="text-xs text-ink-tertiary mb-2 font-mono">Chips</div>
              <div className="flex flex-wrap gap-2">
                <Chip tone="gray">Default</Chip>
                <Chip tone="green">In season</Chip>
                <Chip tone="gold">Pending</Chip>
                <Chip tone="rust">Editorial</Chip>
                <Chip tone="red">Cancelled</Chip>
              </div>
            </div>
          </div>

          <SubHeading>Card</SubHeading>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="card p-5">
              <div className="display text-base">Card</div>
              <p className="text-sm text-ink-secondary mt-1">
                Hairline border on white. No shadow unless floating.
              </p>
            </div>
            <div className="card card-hover p-5 cursor-pointer">
              <div className="display text-base">Card · hover</div>
              <p className="text-sm text-ink-secondary mt-1">
                Border deepens. Reserve for interactive items.
              </p>
            </div>
          </div>

          <SubHeading>Empty state</SubHeading>
          <div className="card">
            <EmptyState
              title="No items match &ldquo;heirloom&rdquo;"
              body="Try a broader search or browse your guide."
              cta={{ href: "/guide", label: "Browse your guide" }}
            />
          </div>

          <SubHeading>Toast &amp; sheet</SubHeading>
          <div className="card p-5 flex flex-wrap gap-3">
            <StyleDemos.ToastTriggers />
            <StyleDemos.SheetTrigger />
          </div>
        </Section>

        {/* ─── Motion ─── */}
        <Section id="motion" title="Motion" eyebrow="07">
          <p className="text-sm text-ink-secondary mb-4 max-w-prose">
            Easing standard is <code className="font-mono">cubic-bezier(.2,.8,.2,1)</code> (Tailwind:
            <code className="font-mono"> ease-fluent</code>). Hover / press uses
            quick ease-out at 150ms; state changes use the fluent curve at 200–280ms.
          </p>
          <StyleDemos.MotionGrid />
        </Section>

        {/* ─── Voice ─── */}
        <Section id="voice" title="Voice (B2B)" eyebrow="08">
          <p className="text-sm text-ink-secondary mb-4 max-w-prose">
            Buyers are restaurant owners, chefs, retail buyers. They scan for
            facts: what&apos;s in stock, when it lands, what it costs. Be
            pragmatic and respectful of their time. Editorial warmth in
            marketing surfaces — never in transactional UI.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <ExampleCard tone="yes" label="Yes">
              <p className="display text-lg">Tue 2pm cutoff · Zone 3</p>
              <p className="text-sm text-ink-secondary mt-1">
                Order by Tuesday at 2pm for Friday delivery.
              </p>
            </ExampleCard>
            <ExampleCard tone="no" label="No">
              <p className="display text-lg">Don&apos;t miss out!</p>
              <p className="text-sm text-ink-secondary mt-1">
                Hurry — order now before time runs out 🌽
              </p>
            </ExampleCard>

            <ExampleCard tone="yes" label="Yes">
              <p className="display text-lg">Out for the season</p>
              <p className="text-sm text-ink-secondary mt-1">
                Heirloom tomatoes are done. We&apos;ll text you when next year&apos;s crop ships.
              </p>
            </ExampleCard>
            <ExampleCard tone="no" label="No">
              <p className="display text-lg">Unavailable</p>
              <p className="text-sm text-ink-secondary mt-1">
                This product is currently unavailable. Please check back later.
              </p>
            </ExampleCard>

            <ExampleCard tone="yes" label="Yes">
              <p className="display text-lg">Standing order placed</p>
              <p className="text-sm text-ink-secondary mt-1">
                12 cases, every Friday. Edit or pause from your dashboard.
              </p>
            </ExampleCard>
            <ExampleCard tone="no" label="No">
              <p className="display text-lg">Success! 🎉</p>
              <p className="text-sm text-ink-secondary mt-1">
                Your standing order has been successfully created.
              </p>
            </ExampleCard>
          </div>
          <p className="mt-6 text-xs text-ink-tertiary">
            Full guidelines:{" "}
            <Link href="/docs/design-system" className="underline">
              docs/design-system.md
            </Link>{" "}
            (in repo).
          </p>
        </Section>

        <footer className="border-t border-black/[0.08] pt-6 text-xs text-ink-tertiary flex items-center justify-between">
          <span>Fingerlakes Farms · design system · v1</span>
          <span>Made in the Finger Lakes, NY</span>
        </footer>
      </main>
    </div>
  );
}

function Section({
  id,
  title,
  eyebrow,
  children,
}: {
  id: string;
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="flex items-baseline gap-3 mb-5">
        <span className="text-xs font-mono text-ink-tertiary">{eyebrow}</span>
        <h2 className="display text-2xl tracking-tight">{title}</h2>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs uppercase tracking-wide font-semibold text-ink-tertiary mt-6 mb-2">
      {children}
    </div>
  );
}

function SwatchGrid({
  swatches,
}: {
  swatches: { name: string; hex: string; role: string; light?: boolean }[];
}) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {swatches.map((s) => (
        <div
          key={s.name}
          className="card overflow-hidden"
        >
          <div
            className={`h-16 ${s.light ? "border-b border-black/[0.06]" : ""}`}
            style={{ background: s.hex }}
          />
          <div className="px-3 py-2">
            <div className="text-sm font-medium font-mono">{s.name}</div>
            <div className="text-xs text-ink-tertiary tabular">{s.hex}</div>
            <div className="text-xs text-ink-secondary mt-0.5">{s.role}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SpecRow({ spec, children }: { spec: string; children: React.ReactNode }) {
  return (
    <div className="grid md:grid-cols-[1fr_220px] gap-2 md:gap-6 items-baseline border-b border-black/[0.05] pb-4">
      <div>{children}</div>
      <div className="text-xs font-mono text-ink-tertiary md:text-right">
        {spec}
      </div>
    </div>
  );
}

function ExampleCard({
  tone,
  label,
  children,
}: {
  tone: "yes" | "no";
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`card p-5 ${
        tone === "yes"
          ? "border-brand-green/40 bg-brand-green-tint/40"
          : "border-feedback-error/30 bg-feedback-error/[0.04]"
      }`}
    >
      <div
        className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
          tone === "yes" ? "text-brand-green-dark" : "text-feedback-error"
        }`}
      >
        {label}
      </div>
      {children}
    </div>
  );
}
