import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import { resolveActiveAccount } from "@/lib/auth/active-account";
import { prettyPhone } from "@/lib/utils/phone";
import type { Profile } from "@/lib/supabase/types";
import { NotificationToggles } from "./NotificationToggles";

export const metadata = { title: "Profile — Fingerlakes Farms" };

export default async function ProfileSheetPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const impersonating = session.profile.role === "admin" ? getImpersonation() : null;
  const db = impersonating ? createServiceClient() : await createClient();
  const profileId = impersonating ?? session.userId;

  const { data: profile } = await db.from("profiles").select("*").eq("id", profileId).maybeSingle();
  if (!profile) redirect("/login");
  const me = profile as Profile;

  const { active: account } = await resolveActiveAccount(me.id, me.account_id);

  // Teammates = other profiles on the same active account
  let teammates: Profile[] = [];
  if (account) {
    const { data: mates } = await db
      .from("profiles")
      .select("*")
      .eq("account_id", account.id)
      .neq("id", me.id)
      .order("first_name", { ascending: true });
    teammates = (mates as Profile[] | null) ?? [];
  }

  const displayName = `${me.first_name ?? ""} ${me.last_name ?? ""}`.trim() || "—";
  const initials =
    ((me.first_name?.[0] ?? "") + (me.last_name?.[0] ?? "")).toUpperCase() ||
    (me.email ?? me.phone ?? "?").slice(0, 1).toUpperCase();

  return (
    <div className="max-w-2xl mx-auto pb-12">
      <div className="flex flex-col items-center pt-4 pb-6">
        <div className="h-24 w-24 rounded-full bg-accent-rust text-white display text-4xl inline-flex items-center justify-center shadow-card">
          {initials}
        </div>
        <h1 className="display text-2xl mt-3">{displayName}</h1>
        {me.title ? <div className="text-sm text-ink-secondary">{me.title}</div> : null}
        {account ? (
          <div className="mt-1 text-sm text-ink-secondary">{account.name}</div>
        ) : null}
      </div>

      <Section title="Contact">
        <Row label="Phone" value={prettyPhone(me.phone)} />
        <Row label="Email" value={me.email ?? "—"} />
      </Section>

      <Section title="Notifications">
        <NotificationToggles initial={me.notification_prefs} />
      </Section>

      {account ? (
        <Section
          title="Employees"
          right={
            <Link href="/messages" className="text-xs text-brand-blue hover:underline">
              Invite via rep →
            </Link>
          }
        >
          <ul className="divide-y divide-black/5">
            <li className="flex items-center gap-3 py-2">
              <Avatar label={(me.first_name?.[0] ?? "?").toUpperCase()} tone="rust" />
              <div className="flex-1">
                <div className="font-medium">{displayName} <span className="text-xs text-ink-secondary">(you)</span></div>
                <div className="text-xs text-ink-secondary">{prettyPhone(me.phone)}</div>
              </div>
            </li>
            {teammates.map((t) => {
              const name = `${t.first_name ?? ""} ${t.last_name ?? ""}`.trim() || t.email || "Teammate";
              const init = ((t.first_name?.[0] ?? "") + (t.last_name?.[0] ?? "")).toUpperCase() || "?";
              return (
                <li key={t.id} className="flex items-center gap-3 py-2">
                  <Avatar label={init} tone="blue" />
                  <div className="flex-1">
                    <div className="font-medium">{name}</div>
                    <div className="text-xs text-ink-secondary">{prettyPhone(t.phone)}</div>
                  </div>
                </li>
              );
            })}
            {teammates.length === 0 ? (
              <li className="py-2 text-sm text-ink-secondary">
                Just you for now. Ask your rep to add teammates.
              </li>
            ) : null}
          </ul>
        </Section>
      ) : null}

      <Section title="Support">
        <div className="text-sm space-y-2">
          <a
            href="sms:+16178660763"
            className="flex items-center justify-between py-2 hover:text-brand-blue"
          >
            <span>Text your rep</span>
            <span className="text-ink-secondary">(617) 866-0763 →</span>
          </a>
          <a
            href="mailto:alex@ilovenyfarms.com"
            className="flex items-center justify-between py-2 hover:text-brand-blue"
          >
            <span>Email us</span>
            <span className="text-ink-secondary">alex@ilovenyfarms.com →</span>
          </a>
          <a
            href="https://ilovenyfarms.com"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between py-2 hover:text-brand-blue"
          >
            <span>About Fingerlakes Farms</span>
            <span className="text-ink-secondary">ilovenyfarms.com →</span>
          </a>
        </div>
      </Section>

      <Section title="Account">
        <div className="flex flex-col gap-2">
          <Link href="/standing" className="btn-ghost text-sm text-left">Standing orders</Link>
          <form action="/auth/signout" method="post">
            <button className="btn-secondary w-full">Sign out</button>
          </form>
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-4 mb-3">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-[11px] uppercase tracking-wide text-ink-tertiary">{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm py-1">
      <span className="text-ink-secondary">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function Avatar({ label, tone }: { label: string; tone: "rust" | "blue" | "gold" }) {
  const bg =
    tone === "rust" ? "bg-accent-rust" : tone === "blue" ? "bg-brand-blue" : "bg-accent-gold";
  return (
    <span className={`h-9 w-9 rounded-full ${bg} text-white display text-sm inline-flex items-center justify-center shrink-0`}>
      {label}
    </span>
  );
}
