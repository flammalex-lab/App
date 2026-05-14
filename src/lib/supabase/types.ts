// Application-level type aliases on top of generated table rows.
// The source of truth for column shapes is `./database.types.ts` (generated
// from `supabase gen types typescript` against the live project). This file
// re-exports rows under friendly names and adds aliases for JSONB shapes
// the generator can't introspect (notification_prefs, pack_options,
// message payloads, cron metadata, etc.).

import type { Database, Tables, Json } from "./database.types";

export type { Database, Json } from "./database.types";

// ─── Enums ────────────────────────────────────────────────────────────
export type Role = Database["public"]["Enums"]["role_t"];
export type AccountType = Database["public"]["Enums"]["account_type_t"];
export type Channel = Database["public"]["Enums"]["channel_t"];
export type PricingTier = Database["public"]["Enums"]["pricing_tier_t"];
export type AccountStatus = Database["public"]["Enums"]["account_status_t"];
export type DeliveryZone = Database["public"]["Enums"]["delivery_zone_t"];
export type Brand = Database["public"]["Enums"]["brand_t"];
export type Category = Database["public"]["Enums"]["category_t"];
export type CutType = Database["public"]["Enums"]["cut_type_t"];
export type OrderType = Database["public"]["Enums"]["order_type_t"];
export type OrderStatus = Database["public"]["Enums"]["order_status_t"];
export type PaymentMethod = Database["public"]["Enums"]["payment_method_t"];
export type PaymentStatus = Database["public"]["Enums"]["payment_status_t"];
export type ActivityType = Database["public"]["Enums"]["activity_type_t"];
export type StandingFreq = Database["public"]["Enums"]["standing_freq_t"];
export type MsgChannel = Database["public"]["Enums"]["msg_channel_t"];
export type MsgDirection = Database["public"]["Enums"]["msg_direction_t"];
export type NotifType = Database["public"]["Enums"]["notif_type_t"];
export type NotifChannel = Database["public"]["Enums"]["notif_channel_t"];
export type NotifStatus = Database["public"]["Enums"]["notif_status_t"];

// `cron_runs.status` is a free-text column in the DB; restrict the union
// app-side to the values our cron jobs actually write.
export type CronRunStatus = "ok" | "errored";

// ─── JSONB shapes (generator emits these as `Json`) ──────────────────
export interface NotificationPrefs {
  push_order_tracking: boolean;
  email_order_confirmation: boolean;
  email_new_chat: boolean;
  email_payments: boolean;
  sms_cutoff_warning: boolean;
}

export interface PackOption {
  key: string;            // "case" | "each" | "half_case" | "bag" | ...
  label: string;          // "Case", "Each", "Half case"
  unit: string;           // "case", "each", "lb", "dozen"
  pack_size: string | null;
  sku: string | null;
  wholesale_price: number | null;
  retail_price: number | null;
  avg_weight_lbs: number | null;
}

/**
 * Structured payload for system-authored chat messages. The `kind`
 * discriminator tells the chat UI which card to render.
 */
export type MessagePayload =
  | {
      kind: "order_placed";
      order_id: string;
      order_number: string;
      items: number;
      subtotal: number;
      total: number;
      delivery_date: string | null;
      pickup_date: string | null;
    }
  | {
      kind: "order_status";
      order_id: string;
      order_number: string;
      status: string;
    }
  | { kind: string; [key: string]: unknown };

// ─── Table row aliases ───────────────────────────────────────────────
// Override Json columns where the app has a known shape.

// Profile.notification_prefs is jsonb in the DB so the generator types it
// as `Json`. Callers that need the typed shape should `parseNotificationPrefs`.
export type Profile = Tables<"profiles">;

export function parseNotificationPrefs(raw: Json | null | undefined): NotificationPrefs {
  const obj = (raw && typeof raw === "object" && !Array.isArray(raw)) ? raw as Record<string, unknown> : {};
  return {
    push_order_tracking: Boolean(obj.push_order_tracking),
    email_order_confirmation: Boolean(obj.email_order_confirmation),
    email_new_chat: Boolean(obj.email_new_chat),
    email_payments: Boolean(obj.email_payments),
    sms_cutoff_warning: Boolean(obj.sms_cutoff_warning),
  };
}

export type ProfileAccount = Tables<"profile_accounts">;
export type Account = Tables<"accounts">;

// Product.pack_options is jsonb in the DB so the generator types it as
// `Json`. Callers should `(p.pack_options as PackOption[] | null) ?? []`.
export type Product = Tables<"products">;

export type AccountPricing = Tables<"account_pricing">;
export type AccountProduct = Tables<"account_products">;
export type PriceList = Tables<"price_lists">;
export type PriceListItem = Tables<"price_list_items">;

// `delivery_zones` row in the DB; legacy name DeliveryZoneRow because the
// enum `DeliveryZone` already takes the simpler name.
export type DeliveryZoneRow = Tables<"delivery_zones">;

export type PickupLocation = Tables<"pickup_locations">;
export type OrderGuide = Tables<"order_guides">;
// par_levels is jsonb; cast at the use-site if you need typed access.
export type OrderGuideItem = Tables<"order_guide_items">;
export type OrderGuideTemplate = Tables<"order_guide_templates">;
export type OrderGuideTemplateItem = Tables<"order_guide_template_items">;

export type OrderGuideSeedSource = Tables<"order_guide_seed_sources">;
export type OrderGuideItemRemoval = Tables<"order_guide_item_removals">;

export type Order = Tables<"orders">;
export type OrderItem = Tables<"order_items">;
export type StandingOrder = Tables<"standing_orders">;
export type StandingOrderItem = Tables<"standing_order_items">;

// payload is jsonb; cast at the use-site for typed shapes (MessagePayload).
export type Message = Tables<"messages">;
// metadata is jsonb; cast at the use-site if shape is known.
export type Notification = Tables<"notifications">;

export type Activity = Tables<"activities">;
export type QBSetting = Tables<"qb_settings">;

// status is text in DB but the cron writer only emits CronRunStatus values.
type _CronRun = Tables<"cron_runs">;
export type CronRun = Omit<_CronRun, "status"> & {
  status: CronRunStatus;
};

// Json passthrough — used in a couple of admin paths where we marshal
// arbitrary jsonb.
export type { Tables } from "./database.types";

// Suppress unused-import lint when only types are referenced.
export type _Json = Json;
