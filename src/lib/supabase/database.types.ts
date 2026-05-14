export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      account_pricing: {
        Row: {
          account_id: string
          custom_price: number
          effective_date: string
          expiry_date: string | null
          id: string
          product_id: string
        }
        Insert: {
          account_id: string
          custom_price: number
          effective_date?: string
          expiry_date?: string | null
          id?: string
          product_id: string
        }
        Update: {
          account_id?: string
          custom_price?: number
          effective_date?: string
          expiry_date?: string | null
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_pricing_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_pricing_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      account_products: {
        Row: {
          account_id: string
          created_at: string
          product_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          product_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_products_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          buyer_type: string | null
          channel: Database["public"]["Enums"]["channel_t"]
          city: string | null
          created_at: string
          delivery_day: string | null
          delivery_days: string[] | null
          delivery_notes: string | null
          delivery_zone: Database["public"]["Enums"]["delivery_zone_t"] | null
          enabled_categories: Database["public"]["Enums"]["category_t"][]
          id: string
          name: string
          notes: string | null
          order_minimum: number | null
          parent_account_id: string | null
          price_list_id: string | null
          pricing_tier: Database["public"]["Enums"]["pricing_tier_t"]
          primary_contact_email: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          qb_customer_name: string | null
          qb_synced_at: string | null
          qb_terms: string | null
          salesperson_id: string | null
          source: string | null
          state: string | null
          status: Database["public"]["Enums"]["account_status_t"]
          type: Database["public"]["Enums"]["account_type_t"]
          updated_at: string
          zip: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          buyer_type?: string | null
          channel: Database["public"]["Enums"]["channel_t"]
          city?: string | null
          created_at?: string
          delivery_day?: string | null
          delivery_days?: string[] | null
          delivery_notes?: string | null
          delivery_zone?: Database["public"]["Enums"]["delivery_zone_t"] | null
          enabled_categories?: Database["public"]["Enums"]["category_t"][]
          id?: string
          name: string
          notes?: string | null
          order_minimum?: number | null
          parent_account_id?: string | null
          price_list_id?: string | null
          pricing_tier?: Database["public"]["Enums"]["pricing_tier_t"]
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          qb_customer_name?: string | null
          qb_synced_at?: string | null
          qb_terms?: string | null
          salesperson_id?: string | null
          source?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["account_status_t"]
          type: Database["public"]["Enums"]["account_type_t"]
          updated_at?: string
          zip?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          buyer_type?: string | null
          channel?: Database["public"]["Enums"]["channel_t"]
          city?: string | null
          created_at?: string
          delivery_day?: string | null
          delivery_days?: string[] | null
          delivery_notes?: string | null
          delivery_zone?: Database["public"]["Enums"]["delivery_zone_t"] | null
          enabled_categories?: Database["public"]["Enums"]["category_t"][]
          id?: string
          name?: string
          notes?: string | null
          order_minimum?: number | null
          parent_account_id?: string | null
          price_list_id?: string | null
          pricing_tier?: Database["public"]["Enums"]["pricing_tier_t"]
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          qb_customer_name?: string | null
          qb_synced_at?: string | null
          qb_terms?: string | null
          salesperson_id?: string | null
          source?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["account_status_t"]
          type?: Database["public"]["Enums"]["account_type_t"]
          updated_at?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_parent_account_id_fkey"
            columns: ["parent_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_salesperson_fk"
            columns: ["salesperson_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activities: {
        Row: {
          account_id: string
          body: string | null
          completed: boolean
          created_at: string
          follow_up_date: string | null
          id: string
          profile_id: string | null
          subject: string | null
          type: Database["public"]["Enums"]["activity_type_t"]
        }
        Insert: {
          account_id: string
          body?: string | null
          completed?: boolean
          created_at?: string
          follow_up_date?: string | null
          id?: string
          profile_id?: string | null
          subject?: string | null
          type: Database["public"]["Enums"]["activity_type_t"]
        }
        Update: {
          account_id?: string
          body?: string | null
          completed?: boolean
          created_at?: string
          follow_up_date?: string | null
          id?: string
          profile_id?: string | null
          subject?: string | null
          type?: Database["public"]["Enums"]["activity_type_t"]
        }
        Relationships: [
          {
            foreignKeyName: "activities_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_impersonation_log: {
        Row: {
          admin_profile_id: string
          ended_at: string | null
          id: string
          reason: string | null
          started_at: string
          target_profile_id: string
        }
        Insert: {
          admin_profile_id: string
          ended_at?: string | null
          id?: string
          reason?: string | null
          started_at?: string
          target_profile_id: string
        }
        Update: {
          admin_profile_id?: string
          ended_at?: string | null
          id?: string
          reason?: string | null
          started_at?: string
          target_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_impersonation_log_admin_profile_id_fkey"
            columns: ["admin_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_impersonation_log_target_profile_id_fkey"
            columns: ["target_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_runs: {
        Row: {
          error: string | null
          finished_at: string | null
          id: string
          job: string
          metadata: Json | null
          rows_affected: number | null
          started_at: string
          status: string
        }
        Insert: {
          error?: string | null
          finished_at?: string | null
          id?: string
          job: string
          metadata?: Json | null
          rows_affected?: number | null
          started_at?: string
          status: string
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          id?: string
          job?: string
          metadata?: Json | null
          rows_affected?: number | null
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      delivery_zones: {
        Row: {
          active: boolean
          cutoff_hours_before_delivery: number
          delivery_days: string[]
          delivery_fee: number
          label: string
          order_minimum: number
          zone: Database["public"]["Enums"]["delivery_zone_t"]
        }
        Insert: {
          active?: boolean
          cutoff_hours_before_delivery?: number
          delivery_days?: string[]
          delivery_fee?: number
          label: string
          order_minimum?: number
          zone: Database["public"]["Enums"]["delivery_zone_t"]
        }
        Update: {
          active?: boolean
          cutoff_hours_before_delivery?: number
          delivery_days?: string[]
          delivery_fee?: number
          label?: string
          order_minimum?: number
          zone?: Database["public"]["Enums"]["delivery_zone_t"]
        }
        Relationships: []
      }
      messages: {
        Row: {
          account_id: string | null
          body: string
          channel: Database["public"]["Enums"]["msg_channel_t"]
          created_at: string
          direction: Database["public"]["Enums"]["msg_direction_t"]
          from_phone: string | null
          from_profile_id: string | null
          id: string
          is_system: boolean
          payload: Json | null
          read_at: string | null
          related_order_id: string | null
          sms_sid: string | null
          to_phone: string | null
          to_profile_id: string | null
        }
        Insert: {
          account_id?: string | null
          body: string
          channel?: Database["public"]["Enums"]["msg_channel_t"]
          created_at?: string
          direction?: Database["public"]["Enums"]["msg_direction_t"]
          from_phone?: string | null
          from_profile_id?: string | null
          id?: string
          is_system?: boolean
          payload?: Json | null
          read_at?: string | null
          related_order_id?: string | null
          sms_sid?: string | null
          to_phone?: string | null
          to_profile_id?: string | null
        }
        Update: {
          account_id?: string | null
          body?: string
          channel?: Database["public"]["Enums"]["msg_channel_t"]
          created_at?: string
          direction?: Database["public"]["Enums"]["msg_direction_t"]
          from_phone?: string | null
          from_profile_id?: string | null
          id?: string
          is_system?: boolean
          payload?: Json | null
          read_at?: string | null
          related_order_id?: string | null
          sms_sid?: string | null
          to_phone?: string | null
          to_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_from_profile_id_fkey"
            columns: ["from_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_to_profile_id_fkey"
            columns: ["to_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          account_id: string | null
          body: string | null
          channel: Database["public"]["Enums"]["notif_channel_t"]
          created_at: string
          error: string | null
          id: string
          metadata: Json | null
          profile_id: string | null
          related_order_id: string | null
          related_standing_order_id: string | null
          scheduled_for: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["notif_status_t"]
          subject: string | null
          to_address: string | null
          type: Database["public"]["Enums"]["notif_type_t"]
        }
        Insert: {
          account_id?: string | null
          body?: string | null
          channel: Database["public"]["Enums"]["notif_channel_t"]
          created_at?: string
          error?: string | null
          id?: string
          metadata?: Json | null
          profile_id?: string | null
          related_order_id?: string | null
          related_standing_order_id?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notif_status_t"]
          subject?: string | null
          to_address?: string | null
          type: Database["public"]["Enums"]["notif_type_t"]
        }
        Update: {
          account_id?: string | null
          body?: string | null
          channel?: Database["public"]["Enums"]["notif_channel_t"]
          created_at?: string
          error?: string | null
          id?: string
          metadata?: Json | null
          profile_id?: string | null
          related_order_id?: string | null
          related_standing_order_id?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notif_status_t"]
          subject?: string | null
          to_address?: string | null
          type?: Database["public"]["Enums"]["notif_type_t"]
        }
        Relationships: [
          {
            foreignKeyName: "notifications_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_standing_order_id_fkey"
            columns: ["related_standing_order_id"]
            isOneToOne: false
            referencedRelation: "standing_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_guide_item_removals: {
        Row: {
          product_id: string
          profile_id: string
          removed_at: string
        }
        Insert: {
          product_id: string
          profile_id: string
          removed_at?: string
        }
        Update: {
          product_id?: string
          profile_id?: string
          removed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_guide_item_removals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_guide_item_removals_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_guide_items: {
        Row: {
          id: string
          order_guide_id: string
          par_levels: Json | null
          product_id: string
          sort_order: number
          suggested_qty: number | null
        }
        Insert: {
          id?: string
          order_guide_id: string
          par_levels?: Json | null
          product_id: string
          sort_order?: number
          suggested_qty?: number | null
        }
        Update: {
          id?: string
          order_guide_id?: string
          par_levels?: Json | null
          product_id?: string
          sort_order?: number
          suggested_qty?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_guide_items_order_guide_id_fkey"
            columns: ["order_guide_id"]
            isOneToOne: false
            referencedRelation: "order_guides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_guide_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_guide_seed_sources: {
        Row: {
          guide_id: string
          template_id: string
        }
        Insert: {
          guide_id: string
          template_id: string
        }
        Update: {
          guide_id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_guide_seed_sources_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "order_guides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_guide_seed_sources_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "order_guide_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      order_guide_template_items: {
        Row: {
          id: string
          par_levels: Json | null
          product_id: string
          sort_order: number
          suggested_qty: number | null
          template_id: string
        }
        Insert: {
          id?: string
          par_levels?: Json | null
          product_id: string
          sort_order?: number
          suggested_qty?: number | null
          template_id: string
        }
        Update: {
          id?: string
          par_levels?: Json | null
          product_id?: string
          sort_order?: number
          suggested_qty?: number | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_guide_template_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_guide_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "order_guide_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      order_guide_templates: {
        Row: {
          buyer_type: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          buyer_type?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          buyer_type?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      order_guides: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_guides_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          line_total: number
          notes: string | null
          order_id: string
          pack_variant_key: string | null
          pack_variant_sku: string | null
          product_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          id?: string
          line_total: number
          notes?: string | null
          order_id: string
          pack_variant_key?: string | null
          pack_variant_sku?: string | null
          product_id: string
          quantity: number
          unit_price: number
        }
        Update: {
          id?: string
          line_total?: number
          notes?: string | null
          order_id?: string
          pack_variant_key?: string | null
          pack_variant_sku?: string | null
          product_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          account_id: string
          created_at: string
          customer_notes: string | null
          delivery_fee: number
          id: string
          internal_notes: string | null
          order_number: string
          order_type: Database["public"]["Enums"]["order_type_t"]
          payment_method: Database["public"]["Enums"]["payment_method_t"]
          payment_status: Database["public"]["Enums"]["payment_status_t"]
          pickup_date: string | null
          pickup_location_id: string | null
          pickup_window: string | null
          placed_by_id: string | null
          profile_id: string
          qb_exported: boolean
          qb_exported_at: string | null
          qb_invoice_ref: string | null
          requested_delivery_date: string | null
          standing_order_id: string | null
          status: Database["public"]["Enums"]["order_status_t"]
          stripe_payment_id: string | null
          subtotal: number
          tax: number
          total: number
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          customer_notes?: string | null
          delivery_fee?: number
          id?: string
          internal_notes?: string | null
          order_number: string
          order_type: Database["public"]["Enums"]["order_type_t"]
          payment_method?: Database["public"]["Enums"]["payment_method_t"]
          payment_status?: Database["public"]["Enums"]["payment_status_t"]
          pickup_date?: string | null
          pickup_location_id?: string | null
          pickup_window?: string | null
          placed_by_id?: string | null
          profile_id: string
          qb_exported?: boolean
          qb_exported_at?: string | null
          qb_invoice_ref?: string | null
          requested_delivery_date?: string | null
          standing_order_id?: string | null
          status?: Database["public"]["Enums"]["order_status_t"]
          stripe_payment_id?: string | null
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          customer_notes?: string | null
          delivery_fee?: number
          id?: string
          internal_notes?: string | null
          order_number?: string
          order_type?: Database["public"]["Enums"]["order_type_t"]
          payment_method?: Database["public"]["Enums"]["payment_method_t"]
          payment_status?: Database["public"]["Enums"]["payment_status_t"]
          pickup_date?: string | null
          pickup_location_id?: string | null
          pickup_window?: string | null
          placed_by_id?: string | null
          profile_id?: string
          qb_exported?: boolean
          qb_exported_at?: string | null
          qb_invoice_ref?: string | null
          requested_delivery_date?: string | null
          standing_order_id?: string | null
          status?: Database["public"]["Enums"]["order_status_t"]
          stripe_payment_id?: string | null
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_pickup_location_id_fkey"
            columns: ["pickup_location_id"]
            isOneToOne: false
            referencedRelation: "pickup_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_placed_by_id_fkey"
            columns: ["placed_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_standing_fk"
            columns: ["standing_order_id"]
            isOneToOne: false
            referencedRelation: "standing_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pickup_locations: {
        Row: {
          active: boolean
          address: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          pickup_days: string[]
          pickup_window: string | null
          sort_order: number
        }
        Insert: {
          active?: boolean
          address?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          pickup_days?: string[]
          pickup_window?: string | null
          sort_order?: number
        }
        Update: {
          active?: boolean
          address?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          pickup_days?: string[]
          pickup_window?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      price_list_items: {
        Row: {
          effective_date: string
          expiry_date: string | null
          id: string
          price_list_id: string
          product_id: string
          unit_price: number
        }
        Insert: {
          effective_date?: string
          expiry_date?: string | null
          id?: string
          price_list_id: string
          product_id: string
          unit_price: number
        }
        Update: {
          effective_date?: string
          expiry_date?: string | null
          id?: string
          price_list_id?: string
          product_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "price_list_items_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_list_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      price_lists: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          additional_groups: string[]
          available_b2b: boolean
          available_dtc: boolean
          available_this_week: boolean
          avg_weight_lbs: number | null
          brand: Database["public"]["Enums"]["brand_t"]
          case_pack: string | null
          category: Database["public"]["Enums"]["category_t"]
          created_at: string
          cut_type: Database["public"]["Enums"]["cut_type_t"] | null
          description: string | null
          id: string
          image_url: string | null
          in_season: boolean
          is_active: boolean
          name: string
          needs_naming_review: boolean
          pack_amount: number | null
          pack_options: Json | null
          pack_size: string | null
          pack_unit: string | null
          price_by_weight: boolean
          primal: string | null
          private: boolean
          producer: string | null
          product_group: string | null
          qb_income_account: string | null
          retail_price: number | null
          sku: string | null
          sort_order: number
          sub_category: string | null
          sub_primal: string | null
          unit: string
          upc: string | null
          updated_at: string
          wholesale_price: number | null
        }
        Insert: {
          additional_groups?: string[]
          available_b2b?: boolean
          available_dtc?: boolean
          available_this_week?: boolean
          avg_weight_lbs?: number | null
          brand: Database["public"]["Enums"]["brand_t"]
          case_pack?: string | null
          category: Database["public"]["Enums"]["category_t"]
          created_at?: string
          cut_type?: Database["public"]["Enums"]["cut_type_t"] | null
          description?: string | null
          id?: string
          image_url?: string | null
          in_season?: boolean
          is_active?: boolean
          name: string
          needs_naming_review?: boolean
          pack_amount?: number | null
          pack_options?: Json | null
          pack_size?: string | null
          pack_unit?: string | null
          price_by_weight?: boolean
          primal?: string | null
          private?: boolean
          producer?: string | null
          product_group?: string | null
          qb_income_account?: string | null
          retail_price?: number | null
          sku?: string | null
          sort_order?: number
          sub_category?: string | null
          sub_primal?: string | null
          unit: string
          upc?: string | null
          updated_at?: string
          wholesale_price?: number | null
        }
        Update: {
          additional_groups?: string[]
          available_b2b?: boolean
          available_dtc?: boolean
          available_this_week?: boolean
          avg_weight_lbs?: number | null
          brand?: Database["public"]["Enums"]["brand_t"]
          case_pack?: string | null
          category?: Database["public"]["Enums"]["category_t"]
          created_at?: string
          cut_type?: Database["public"]["Enums"]["cut_type_t"] | null
          description?: string | null
          id?: string
          image_url?: string | null
          in_season?: boolean
          is_active?: boolean
          name?: string
          needs_naming_review?: boolean
          pack_amount?: number | null
          pack_options?: Json | null
          pack_size?: string | null
          pack_unit?: string | null
          price_by_weight?: boolean
          primal?: string | null
          private?: boolean
          producer?: string | null
          product_group?: string | null
          qb_income_account?: string | null
          retail_price?: number | null
          sku?: string | null
          sort_order?: number
          sub_category?: string | null
          sub_primal?: string | null
          unit?: string
          upc?: string | null
          updated_at?: string
          wholesale_price?: number | null
        }
        Relationships: []
      }
      profile_accounts: {
        Row: {
          account_id: string
          created_at: string
          is_default: boolean
          profile_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          is_default?: boolean
          profile_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          is_default?: boolean
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_accounts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_accounts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_id: string | null
          buyer_type: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          notes: string | null
          notification_prefs: Json
          phone: string | null
          role: Database["public"]["Enums"]["role_t"]
          sms_opt_in_at: string | null
          sms_opt_in_source: string | null
          sms_opted_in: boolean
          title: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          buyer_type?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          notes?: string | null
          notification_prefs?: Json
          phone?: string | null
          role?: Database["public"]["Enums"]["role_t"]
          sms_opt_in_at?: string | null
          sms_opt_in_source?: string | null
          sms_opted_in?: boolean
          title?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          buyer_type?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          notes?: string | null
          notification_prefs?: Json
          phone?: string | null
          role?: Database["public"]["Enums"]["role_t"]
          sms_opt_in_at?: string | null
          sms_opt_in_source?: string | null
          sms_opted_in?: boolean
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          profile_id: string
          user_agent: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          profile_id: string
          user_agent?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          profile_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      qb_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      sms_triage: {
        Row: {
          body: string
          from_phone: string
          id: string
          received_at: string
          resolved: boolean
          resolved_at: string | null
          resolved_by_profile_id: string | null
          sms_sid: string | null
        }
        Insert: {
          body: string
          from_phone: string
          id?: string
          received_at?: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by_profile_id?: string | null
          sms_sid?: string | null
        }
        Update: {
          body?: string
          from_phone?: string
          id?: string
          received_at?: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by_profile_id?: string | null
          sms_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_triage_resolved_by_profile_id_fkey"
            columns: ["resolved_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      standing_order_items: {
        Row: {
          id: string
          notes: string | null
          product_id: string
          quantity: number
          standing_order_id: string
        }
        Insert: {
          id?: string
          notes?: string | null
          product_id: string
          quantity: number
          standing_order_id: string
        }
        Update: {
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          standing_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "standing_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standing_order_items_standing_order_id_fkey"
            columns: ["standing_order_id"]
            isOneToOne: false
            referencedRelation: "standing_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      standing_orders: {
        Row: {
          account_id: string
          active: boolean
          created_at: string
          days_of_week: string[]
          frequency: Database["public"]["Enums"]["standing_freq_t"]
          id: string
          last_run_date: string | null
          name: string | null
          next_run_date: string | null
          pause_until: string | null
          profile_id: string
          require_confirmation: boolean
          updated_at: string
        }
        Insert: {
          account_id: string
          active?: boolean
          created_at?: string
          days_of_week?: string[]
          frequency?: Database["public"]["Enums"]["standing_freq_t"]
          id?: string
          last_run_date?: string | null
          name?: string | null
          next_run_date?: string | null
          pause_until?: string | null
          profile_id: string
          require_confirmation?: boolean
          updated_at?: string
        }
        Update: {
          account_id?: string
          active?: boolean
          created_at?: string
          days_of_week?: string[]
          frequency?: Database["public"]["Enums"]["standing_freq_t"]
          id?: string
          last_run_date?: string | null
          name?: string | null
          next_run_date?: string | null
          pause_until?: string | null
          profile_id?: string
          require_confirmation?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "standing_orders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standing_orders_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_events: {
        Row: {
          id: string
          order_id: string | null
          received_at: string
          type: string
        }
        Insert: {
          id: string
          order_id?: string | null
          received_at?: string
          type: string
        }
        Update: {
          id?: string
          order_id?: string | null
          received_at?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      buyer_product_history: {
        Args: { p_profile_id: string }
        Returns: {
          last_ordered_at: string
          producer: string
          product_id: string
          qty: number
        }[]
      }
      catalog_search: {
        Args: {
          allowed_categories: string[]
          allowed_groups: string[]
          allowed_private_ids: string[]
          group_filter?: string
          is_b2b: boolean
          producer_filter?: string
          q: string
        }
        Returns: {
          additional_groups: string[]
          available_b2b: boolean
          available_dtc: boolean
          available_this_week: boolean
          avg_weight_lbs: number | null
          brand: Database["public"]["Enums"]["brand_t"]
          case_pack: string | null
          category: Database["public"]["Enums"]["category_t"]
          created_at: string
          cut_type: Database["public"]["Enums"]["cut_type_t"] | null
          description: string | null
          id: string
          image_url: string | null
          in_season: boolean
          is_active: boolean
          name: string
          needs_naming_review: boolean
          pack_amount: number | null
          pack_options: Json | null
          pack_size: string | null
          pack_unit: string | null
          price_by_weight: boolean
          primal: string | null
          private: boolean
          producer: string | null
          product_group: string | null
          qb_income_account: string | null
          retail_price: number | null
          sku: string | null
          sort_order: number
          sub_category: string | null
          sub_primal: string | null
          unit: string
          upc: string | null
          updated_at: string
          wholesale_price: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      generate_order_number: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      latest_messages_per_account: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          account_id: string
          account_name: string
          body: string
          created_at: string
          direction: string
        }[]
      }
      my_account_id: { Args: never; Returns: string }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      account_status_t: "prospect" | "active" | "inactive" | "churned"
      account_type_t:
        | "restaurant"
        | "grocery"
        | "institutional"
        | "country_club"
        | "distributor"
        | "other"
      activity_type_t:
        | "call"
        | "email"
        | "visit"
        | "sample_drop"
        | "order"
        | "note"
        | "follow_up"
      brand_t: "grasslands" | "meadow_creek" | "fingerlakes_farms"
      category_t:
        | "meat"
        | "dairy"
        | "cheese"
        | "produce"
        | "pantry"
        | "beverages"
      channel_t: "foodservice" | "retail" | "institutional"
      cut_type_t:
        | "primal"
        | "sub_primal"
        | "retail_cut"
        | "value_added"
        | "whole"
      delivery_zone_t:
        | "finger_lakes"
        | "nyc_metro"
        | "hudson_valley"
        | "long_island"
        | "nj_pa_ct"
      msg_channel_t: "app" | "sms" | "email"
      msg_direction_t: "outbound" | "inbound"
      notif_channel_t: "sms" | "push" | "email"
      notif_status_t: "pending" | "sent" | "failed" | "skipped"
      notif_type_t:
        | "order_confirmation"
        | "order_status"
        | "cutoff_warning"
        | "reorder_prompt"
        | "standing_order_ready"
        | "delivery_reminder"
        | "message"
        | "welcome"
      order_status_t:
        | "draft"
        | "pending"
        | "confirmed"
        | "processing"
        | "ready"
        | "shipped"
        | "delivered"
        | "cancelled"
      order_type_t: "b2b" | "dtc"
      payment_method_t: "invoice" | "stripe" | "venmo" | "cash"
      payment_status_t:
        | "unpaid"
        | "partial"
        | "paid"
        | "failed"
        | "refunded"
        | "partially_refunded"
        | "disputed"
      pricing_tier_t: "standard" | "volume" | "custom"
      role_t: "admin" | "b2b_buyer" | "dtc_customer"
      standing_freq_t: "weekly" | "biweekly"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_status_t: ["prospect", "active", "inactive", "churned"],
      account_type_t: [
        "restaurant",
        "grocery",
        "institutional",
        "country_club",
        "distributor",
        "other",
      ],
      activity_type_t: [
        "call",
        "email",
        "visit",
        "sample_drop",
        "order",
        "note",
        "follow_up",
      ],
      brand_t: ["grasslands", "meadow_creek", "fingerlakes_farms"],
      category_t: ["meat", "dairy", "cheese", "produce", "pantry", "beverages"],
      channel_t: ["foodservice", "retail", "institutional"],
      cut_type_t: [
        "primal",
        "sub_primal",
        "retail_cut",
        "value_added",
        "whole",
      ],
      delivery_zone_t: [
        "finger_lakes",
        "nyc_metro",
        "hudson_valley",
        "long_island",
        "nj_pa_ct",
      ],
      msg_channel_t: ["app", "sms", "email"],
      msg_direction_t: ["outbound", "inbound"],
      notif_channel_t: ["sms", "push", "email"],
      notif_status_t: ["pending", "sent", "failed", "skipped"],
      notif_type_t: [
        "order_confirmation",
        "order_status",
        "cutoff_warning",
        "reorder_prompt",
        "standing_order_ready",
        "delivery_reminder",
        "message",
        "welcome",
      ],
      order_status_t: [
        "draft",
        "pending",
        "confirmed",
        "processing",
        "ready",
        "shipped",
        "delivered",
        "cancelled",
      ],
      order_type_t: ["b2b", "dtc"],
      payment_method_t: ["invoice", "stripe", "venmo", "cash"],
      payment_status_t: [
        "unpaid",
        "partial",
        "paid",
        "failed",
        "refunded",
        "partially_refunded",
        "disputed",
      ],
      pricing_tier_t: ["standard", "volume", "custom"],
      role_t: ["admin", "b2b_buyer", "dtc_customer"],
      standing_freq_t: ["weekly", "biweekly"],
    },
  },
} as const
