// Database types — hand-authored shape of the Supabase schema.
// Run `supabase gen types typescript` to replace this with generated types.

export type Role = "admin" | "b2b_buyer" | "dtc_customer";
export type AccountType = "restaurant" | "grocery" | "institutional" | "country_club" | "distributor" | "other";
export type Channel = "foodservice" | "retail" | "institutional";
export type PricingTier = "standard" | "volume" | "custom";
export type AccountStatus = "prospect" | "active" | "inactive" | "churned";
export type DeliveryZone = "finger_lakes" | "nyc_metro" | "hudson_valley" | "long_island" | "nj_pa_ct" | "buffalo" | "rochester" | "syracuse" | "ithaca";
export type Brand = "grasslands" | "meadow_creek" | "fingerlakes_farms";
export type Category = "beef" | "pork" | "lamb" | "eggs" | "dairy" | "produce" | "pantry" | "beverages";
export type CutType = "primal" | "sub_primal" | "retail_cut" | "value_added" | "whole";
export type OrderType = "b2b" | "dtc";
export type OrderStatus = "draft" | "pending" | "confirmed" | "processing" | "ready" | "shipped" | "delivered" | "cancelled";
export type PaymentMethod = "invoice" | "stripe" | "venmo" | "cash";
export type PaymentStatus = "unpaid" | "partial" | "paid";
export type ActivityType = "call" | "email" | "visit" | "sample_drop" | "order" | "note" | "follow_up";
export type StandingFreq = "weekly" | "biweekly";
export type MsgChannel = "app" | "sms" | "email";
export type MsgDirection = "outbound" | "inbound";
export type NotifType = "order_confirmation" | "order_status" | "cutoff_warning" | "reorder_prompt" | "standing_order_ready" | "delivery_reminder" | "message" | "welcome";
export type NotifChannel = "sms" | "push" | "email";
export type NotifStatus = "pending" | "sent" | "failed" | "skipped";

export interface NotificationPrefs {
  push_order_tracking: boolean;
  email_order_confirmation: boolean;
  email_new_chat: boolean;
  email_payments: boolean;
  sms_cutoff_warning: boolean;
}

export interface Profile {
  id: string;
  role: Role;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  account_id: string | null;
  title: string | null;
  notes: string | null;
  notification_prefs: NotificationPrefs;
  created_at: string;
  updated_at: string;
}

export interface ProfileAccount {
  profile_id: string;
  account_id: string;
  is_default: boolean;
  created_at: string;
}

export interface Account {
  id: string;
  parent_account_id: string | null;
  name: string;
  type: AccountType;
  channel: Channel;
  pricing_tier: PricingTier;
  status: AccountStatus;
  enabled_categories: Category[];
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  delivery_zone: DeliveryZone | null;
  delivery_day: string | null;
  delivery_notes: string | null;
  order_minimum: number | null;
  salesperson_id: string | null;
  source: string | null;
  notes: string | null;
  buyer_type: string | null;
  qb_customer_name: string | null;
  qb_terms: string | null;
  qb_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  sku: string | null;
  brand: Brand;
  category: Category;
  name: string;
  description: string | null;
  primal: string | null;
  sub_primal: string | null;
  cut_type: CutType | null;
  unit: string;
  pack_size: string | null;
  case_pack: string | null;
  avg_weight_lbs: number | null;
  wholesale_price: number | null;
  retail_price: number | null;
  available_b2b: boolean;
  available_dtc: boolean;
  in_season: boolean;
  available_this_week: boolean;
  is_active: boolean;
  image_url: string | null;
  producer: string | null;
  product_group: string | null;
  qb_income_account: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface AccountPricing {
  id: string;
  account_id: string;
  product_id: string;
  custom_price: number;
  effective_date: string;
  expiry_date: string | null;
}

export interface DeliveryZoneRow {
  zone: DeliveryZone;
  label: string;
  order_minimum: number;
  cutoff_hours_before_delivery: number;
  delivery_days: string[];
  active: boolean;
}

export interface PickupLocation {
  id: string;
  name: string;
  address: string | null;
  pickup_days: string[];
  pickup_window: string | null;
  active: boolean;
  sort_order: number;
  notes: string | null;
  created_at: string;
}

export interface OrderGuide {
  id: string;
  profile_id: string;
  name: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderGuideItem {
  id: string;
  order_guide_id: string;
  product_id: string;
  suggested_qty: number | null;
  par_levels: Record<string, number> | null;
  sort_order: number;
}

export interface Order {
  id: string;
  order_number: string;
  order_type: OrderType;
  status: OrderStatus;
  profile_id: string;
  account_id: string | null;
  placed_by_id: string | null;
  standing_order_id: string | null;
  requested_delivery_date: string | null;
  pickup_date: string | null;
  pickup_window: string | null;
  pickup_location_id: string | null;
  subtotal: number;
  tax: number;
  delivery_fee: number;
  total: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  stripe_payment_id: string | null;
  customer_notes: string | null;
  internal_notes: string | null;
  qb_exported: boolean;
  qb_exported_at: string | null;
  qb_invoice_ref: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  notes: string | null;
}

export interface StandingOrder {
  id: string;
  account_id: string;
  profile_id: string;
  name: string | null;
  frequency: StandingFreq;
  days_of_week: string[];
  active: boolean;
  pause_until: string | null;
  last_run_date: string | null;
  next_run_date: string | null;
  require_confirmation: boolean;
  created_at: string;
  updated_at: string;
}

export interface StandingOrderItem {
  id: string;
  standing_order_id: string;
  product_id: string;
  quantity: number;
  notes: string | null;
}

export interface Message {
  id: string;
  account_id: string;
  from_profile_id: string | null;
  to_profile_id: string | null;
  body: string;
  channel: MsgChannel;
  direction: MsgDirection;
  sms_sid: string | null;
  from_phone: string | null;
  to_phone: string | null;
  read_at: string | null;
  is_system: boolean;
  related_order_id: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  profile_id: string | null;
  account_id: string | null;
  type: NotifType;
  channel: NotifChannel;
  subject: string | null;
  body: string | null;
  to_address: string | null;
  related_order_id: string | null;
  related_standing_order_id: string | null;
  status: NotifStatus;
  error: string | null;
  metadata: Record<string, unknown> | null;
  scheduled_for: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface Activity {
  id: string;
  account_id: string;
  profile_id: string | null;
  type: ActivityType;
  subject: string | null;
  body: string | null;
  follow_up_date: string | null;
  completed: boolean;
  created_at: string;
}

export interface QBSetting {
  id: string;
  key: string;
  value: string;
  updated_at: string;
}
