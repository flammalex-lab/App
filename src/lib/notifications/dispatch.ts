import { sendSms } from "@/lib/twilio/client";
import type { NotifChannel, NotifType } from "@/lib/supabase/types";

/**
 * Enqueue a notification and attempt to send immediately.
 * Uses the service-role client (passed in) to bypass RLS.
 */
export interface EnqueueInput {
  supabase: any; // service-role SupabaseClient
  profileId?: string | null;
  accountId?: string | null;
  type: NotifType;
  channel: NotifChannel;
  toAddress: string | null;
  subject?: string;
  body: string;
  relatedOrderId?: string | null;
  relatedStandingOrderId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function enqueueAndSend(input: EnqueueInput): Promise<{ ok: boolean; id?: string; error?: string }> {
  const { supabase } = input;

  const { data: row, error: insertErr } = await supabase
    .from("notifications")
    .insert({
      profile_id: input.profileId ?? null,
      account_id: input.accountId ?? null,
      type: input.type,
      channel: input.channel,
      subject: input.subject ?? null,
      body: input.body,
      to_address: input.toAddress,
      related_order_id: input.relatedOrderId ?? null,
      related_standing_order_id: input.relatedStandingOrderId ?? null,
      metadata: input.metadata ?? null,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertErr || !row) return { ok: false, error: insertErr?.message ?? "insert failed" };

  // daily SMS cap check
  if (input.channel === "sms") {
    const allowed = await smsAllowedToday(supabase);
    if (!allowed) {
      await supabase.from("notifications").update({ status: "skipped", error: "daily cap reached" }).eq("id", row.id);
      return { ok: false, id: row.id, error: "daily cap reached" };
    }
  }

  const result = await deliver(input);
  await supabase
    .from("notifications")
    .update({
      status: result.ok ? "sent" : "failed",
      sent_at: result.ok ? new Date().toISOString() : null,
      error: result.error ?? null,
    })
    .eq("id", row.id);

  return { ok: result.ok, id: row.id, error: result.error };
}

async function deliver(input: EnqueueInput): Promise<{ ok: boolean; error?: string }> {
  if (!input.toAddress) return { ok: false, error: "missing to_address" };
  if (input.channel === "sms") {
    const r = await sendSms({ to: input.toAddress, body: input.body });
    return { ok: r.ok, error: r.error };
  }
  if (input.channel === "email") {
    // Stub — wire up Resend/SendGrid here.
    console.log("[email] (stub) →", input.toAddress, input.subject);
    return { ok: true };
  }
  if (input.channel === "push") {
    // Stub — web-push delivery lives in src/lib/push/*.
    console.log("[push] (stub) →", input.toAddress);
    return { ok: true };
  }
  return { ok: false, error: "unknown channel" };
}

async function smsAllowedToday(supabase: any): Promise<boolean> {
  const { data: cap } = await supabase.from("qb_settings").select("value").eq("key", "sms_daily_cap").maybeSingle();
  const limit = cap?.value ? Number(cap.value) : 200;
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("channel", "sms")
    .eq("status", "sent")
    .gte("sent_at", since.toISOString());
  return (count ?? 0) < limit;
}
