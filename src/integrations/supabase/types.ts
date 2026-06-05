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
      admin_users: {
        Row: {
          created_at: string
          email: string | null
          id: string
          newapi_user_id: number
          note: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          newapi_user_id: number
          note?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          newapi_user_id?: number
          note?: string | null
        }
        Relationships: []
      }
      affiliate_clicks: {
        Row: {
          affiliate_id: string
          click_id: string
          country: string | null
          created_at: string
          fbclid: string | null
          gclid: string | null
          id: string
          ip: string | null
          landing_path: string | null
          referrer: string | null
          sub1: string | null
          sub2: string | null
          sub3: string | null
          sub4: string | null
          sub5: string | null
          ttclid: string | null
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          affiliate_id: string
          click_id?: string
          country?: string | null
          created_at?: string
          fbclid?: string | null
          gclid?: string | null
          id?: string
          ip?: string | null
          landing_path?: string | null
          referrer?: string | null
          sub1?: string | null
          sub2?: string | null
          sub3?: string | null
          sub4?: string | null
          sub5?: string | null
          ttclid?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          affiliate_id?: string
          click_id?: string
          country?: string | null
          created_at?: string
          fbclid?: string | null
          gclid?: string | null
          id?: string
          ip?: string | null
          landing_path?: string | null
          referrer?: string | null
          sub1?: string | null
          sub2?: string | null
          sub3?: string | null
          sub4?: string | null
          sub5?: string | null
          ttclid?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_clicks_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_conversions: {
        Row: {
          adjusted_at: string | null
          adjusted_by: string | null
          affiliate_id: string
          amount_usd: number
          click_id: string | null
          commission_usd: number
          created_at: string
          currency: string
          event: string
          id: string
          meta: Json
          newapi_user_id: number | null
          note: string | null
          payment_intent_id: string | null
          status: string
        }
        Insert: {
          adjusted_at?: string | null
          adjusted_by?: string | null
          affiliate_id: string
          amount_usd?: number
          click_id?: string | null
          commission_usd?: number
          created_at?: string
          currency?: string
          event: string
          id?: string
          meta?: Json
          newapi_user_id?: number | null
          note?: string | null
          payment_intent_id?: string | null
          status?: string
        }
        Update: {
          adjusted_at?: string | null
          adjusted_by?: string | null
          affiliate_id?: string
          amount_usd?: number
          click_id?: string | null
          commission_usd?: number
          created_at?: string
          currency?: string
          event?: string
          id?: string
          meta?: Json
          newapi_user_id?: number | null
          note?: string | null
          payment_intent_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_conversions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_conversions_click_id_fkey"
            columns: ["click_id"]
            isOneToOne: false
            referencedRelation: "affiliate_clicks"
            referencedColumns: ["click_id"]
          },
          {
            foreignKeyName: "affiliate_conversions_payment_intent_id_fkey"
            columns: ["payment_intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_postbacks: {
        Row: {
          affiliate_id: string
          created_at: string
          events: string[]
          fire_count: number
          id: string
          is_enabled: boolean
          last_fired_at: string | null
          last_response: string | null
          last_status: number | null
          updated_at: string
          url_template: string
        }
        Insert: {
          affiliate_id: string
          created_at?: string
          events?: string[]
          fire_count?: number
          id?: string
          is_enabled?: boolean
          last_fired_at?: string | null
          last_response?: string | null
          last_status?: number | null
          updated_at?: string
          url_template: string
        }
        Update: {
          affiliate_id?: string
          created_at?: string
          events?: string[]
          fire_count?: number
          id?: string
          is_enabled?: boolean
          last_fired_at?: string | null
          last_response?: string | null
          last_status?: number | null
          updated_at?: string
          url_template?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_postbacks_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliates: {
        Row: {
          available_balance_usd: number
          commission_rate: number
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          newapi_user_id: number
          payout_details: Json
          payout_method: string | null
          pending_balance_usd: number
          slug: string
          status: string
          total_earnings: number
          total_paid: number
          updated_at: string
        }
        Insert: {
          available_balance_usd?: number
          commission_rate?: number
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          newapi_user_id: number
          payout_details?: Json
          payout_method?: string | null
          pending_balance_usd?: number
          slug: string
          status?: string
          total_earnings?: number
          total_paid?: number
          updated_at?: string
        }
        Update: {
          available_balance_usd?: number
          commission_rate?: number
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          newapi_user_id?: number
          payout_details?: Json
          payout_method?: string | null
          pending_balance_usd?: number
          slug?: string
          status?: string
          total_earnings?: number
          total_paid?: number
          updated_at?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          body: string
          created_at: string
          ends_at: string | null
          id: string
          is_active: boolean
          level: string
          link_label: string | null
          link_url: string | null
          sort_order: number
          starts_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          level?: string
          link_label?: string | null
          link_url?: string | null
          sort_order?: number
          starts_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          level?: string
          link_label?: string | null
          link_url?: string | null
          sort_order?: number
          starts_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      commission_ledger: {
        Row: {
          actor_id: string | null
          affiliate_id: string
          amount_usd: number
          balance_after: number
          conversion_id: string | null
          created_at: string
          id: string
          meta: Json
          note: string
          order_no: string
          type: string
          withdrawal_id: string | null
        }
        Insert: {
          actor_id?: string | null
          affiliate_id: string
          amount_usd: number
          balance_after?: number
          conversion_id?: string | null
          created_at?: string
          id?: string
          meta?: Json
          note?: string
          order_no?: string
          type: string
          withdrawal_id?: string | null
        }
        Update: {
          actor_id?: string | null
          affiliate_id?: string
          amount_usd?: number
          balance_after?: number
          conversion_id?: string | null
          created_at?: string
          id?: string
          meta?: Json
          note?: string
          order_no?: string
          type?: string
          withdrawal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_ledger_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_ledger_conversion_id_fkey"
            columns: ["conversion_id"]
            isOneToOne: false
            referencedRelation: "affiliate_conversions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_ledger_withdrawal_id_fkey"
            columns: ["withdrawal_id"]
            isOneToOne: false
            referencedRelation: "withdrawal_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_scripts: {
        Row: {
          code: string
          created_at: string
          id: string
          is_enabled: boolean
          name: string
          page_scope: string
          placement: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          name: string
          page_scope?: string
          placement: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          name?: string
          page_scope?: string
          placement?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      docs_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_visible: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_visible?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_visible?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      docs_pages: {
        Row: {
          body_md: string
          category: string | null
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          slug: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          body_md?: string
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          body_md?: string
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_campaigns: {
        Row: {
          completed_at: string | null
          created_at: string
          error: string | null
          failed_count: number
          id: string
          name: string
          recipient_count: number
          recipient_ids: number[]
          sent_count: number
          started_at: string | null
          status: string
          subject_override: string | null
          template_id: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          failed_count?: number
          id?: string
          name: string
          recipient_count?: number
          recipient_ids?: number[]
          sent_count?: number
          started_at?: string | null
          status?: string
          subject_override?: string | null
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          failed_count?: number
          id?: string
          name?: string
          recipient_count?: number
          recipient_ids?: number[]
          sent_count?: number
          started_at?: string | null
          status?: string
          subject_override?: string | null
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          campaign_id: string | null
          created_at: string
          error: string | null
          id: string
          newapi_user_id: number | null
          provider_message_id: string | null
          status: string
          subject: string
          template_key: string | null
          to_email: string
          to_name: string | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          newapi_user_id?: number | null
          provider_message_id?: string | null
          status: string
          subject: string
          template_key?: string | null
          to_email: string
          to_name?: string | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          newapi_user_id?: number | null
          provider_message_id?: string | null
          status?: string
          subject?: string
          template_key?: string | null
          to_email?: string
          to_name?: string | null
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          created_at: string
          description: string | null
          html: string
          id: string
          is_enabled: boolean
          is_system: boolean
          key: string
          name: string
          subject: string
          text: string | null
          updated_at: string
          variables: string[]
        }
        Insert: {
          created_at?: string
          description?: string | null
          html?: string
          id?: string
          is_enabled?: boolean
          is_system?: boolean
          key: string
          name: string
          subject: string
          text?: string | null
          updated_at?: string
          variables?: string[]
        }
        Update: {
          created_at?: string
          description?: string | null
          html?: string
          id?: string
          is_enabled?: boolean
          is_system?: boolean
          key?: string
          name?: string
          subject?: string
          text?: string | null
          updated_at?: string
          variables?: string[]
        }
        Relationships: []
      }
      models_catalog: {
        Row: {
          badges: string[]
          cached_input_price_per_1k: number | null
          category: string | null
          context_length: number | null
          created_at: string
          description: string | null
          display_name: string
          id: string
          input_price_per_1k: number | null
          is_featured: boolean
          is_visible: boolean
          modality: string
          output_price_per_1k: number | null
          provider: string
          slug: string
          sort_order: number
          updated_at: string
          vendor_cached_input_price_per_1k: number | null
          vendor_input_price_per_1k: number | null
          vendor_output_price_per_1k: number | null
        }
        Insert: {
          badges?: string[]
          cached_input_price_per_1k?: number | null
          category?: string | null
          context_length?: number | null
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          input_price_per_1k?: number | null
          is_featured?: boolean
          is_visible?: boolean
          modality?: string
          output_price_per_1k?: number | null
          provider: string
          slug: string
          sort_order?: number
          updated_at?: string
          vendor_cached_input_price_per_1k?: number | null
          vendor_input_price_per_1k?: number | null
          vendor_output_price_per_1k?: number | null
        }
        Update: {
          badges?: string[]
          cached_input_price_per_1k?: number | null
          category?: string | null
          context_length?: number | null
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          input_price_per_1k?: number | null
          is_featured?: boolean
          is_visible?: boolean
          modality?: string
          output_price_per_1k?: number | null
          provider?: string
          slug?: string
          sort_order?: number
          updated_at?: string
          vendor_cached_input_price_per_1k?: number | null
          vendor_input_price_per_1k?: number | null
          vendor_output_price_per_1k?: number | null
        }
        Relationships: []
      }
      password_reset_tokens: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          email: string
          expires_at: string
          id: string
          ip: string | null
          newapi_user_id: number | null
          used_at: string | null
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          ip?: string | null
          newapi_user_id?: number | null
          used_at?: string | null
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          ip?: string | null
          newapi_user_id?: number | null
          used_at?: string | null
        }
        Relationships: []
      }
      payment_intents: {
        Row: {
          amount_usd: number
          bonus_credits: number
          click_id: string | null
          created_at: string
          credits: number
          id: string
          meta: Json
          newapi_user_id: number
          order_no: string
          paid_at: string | null
          pay_url: string | null
          plan_id: string | null
          provider: string
          provider_order_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_usd: number
          bonus_credits?: number
          click_id?: string | null
          created_at?: string
          credits: number
          id?: string
          meta?: Json
          newapi_user_id: number
          order_no?: string
          paid_at?: string | null
          pay_url?: string | null
          plan_id?: string | null
          provider: string
          provider_order_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_usd?: number
          bonus_credits?: number
          click_id?: string | null
          created_at?: string
          credits?: number
          id?: string
          meta?: Json
          newapi_user_id?: number
          order_no?: string
          paid_at?: string | null
          pay_url?: string | null
          plan_id?: string | null
          provider?: string
          provider_order_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_intents_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "pricing_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_plans: {
        Row: {
          bonus_credits: number
          created_at: string
          credits: number
          creem_product_id: string | null
          description: string | null
          id: string
          is_active: boolean
          is_popular: boolean
          name: string
          price_usd: number
          sort_order: number
          updated_at: string
          whop_plan_id: string | null
        }
        Insert: {
          bonus_credits?: number
          created_at?: string
          credits: number
          creem_product_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_popular?: boolean
          name: string
          price_usd: number
          sort_order?: number
          updated_at?: string
          whop_plan_id?: string | null
        }
        Update: {
          bonus_credits?: number
          created_at?: string
          credits?: number
          creem_product_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_popular?: boolean
          name?: string
          price_usd?: number
          sort_order?: number
          updated_at?: string
          whop_plan_id?: string | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      users: {
        Row: {
          affiliate_id: string | null
          click_id: string | null
          country: string | null
          created_at: string
          display_name: string | null
          email: string
          first_name: string | null
          id: string
          last_login_at: string | null
          last_name: string | null
          newapi_user_id: number
          phone: string | null
          privacy_accepted_at: string | null
          register_country: string | null
          register_ip: string | null
          terms_accepted_at: string | null
          updated_at: string
          username: string
        }
        Insert: {
          affiliate_id?: string | null
          click_id?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          email: string
          first_name?: string | null
          id?: string
          last_login_at?: string | null
          last_name?: string | null
          newapi_user_id: number
          phone?: string | null
          privacy_accepted_at?: string | null
          register_country?: string | null
          register_ip?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          affiliate_id?: string | null
          click_id?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          email?: string
          first_name?: string | null
          id?: string
          last_login_at?: string | null
          last_name?: string | null
          newapi_user_id?: number
          phone?: string | null
          privacy_accepted_at?: string | null
          register_country?: string | null
          register_ip?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_click_id_fkey"
            columns: ["click_id"]
            isOneToOne: false
            referencedRelation: "affiliate_clicks"
            referencedColumns: ["click_id"]
          },
        ]
      }
      webhook_event_log: {
        Row: {
          created_at: string
          duration_ms: number | null
          error: string | null
          event_id: string | null
          event_type: string | null
          headers: Json
          id: string
          intent_id: string | null
          outcome: string
          payload: Json
          provider: string
          signature_valid: boolean
          status_code: number
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          event_id?: string | null
          event_type?: string | null
          headers?: Json
          id?: string
          intent_id?: string | null
          outcome: string
          payload?: Json
          provider: string
          signature_valid?: boolean
          status_code: number
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          event_id?: string | null
          event_type?: string | null
          headers?: Json
          id?: string
          intent_id?: string | null
          outcome?: string
          payload?: Json
          provider?: string
          signature_valid?: boolean
          status_code?: number
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          admin_note: string | null
          affiliate_id: string
          amount_usd: number
          contact_note: string
          created_at: string
          id: string
          order_no: string
          processed_at: string | null
          processed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          affiliate_id: string
          amount_usd: number
          contact_note?: string
          created_at?: string
          id?: string
          order_no?: string
          processed_at?: string | null
          processed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          affiliate_id?: string
          amount_usd?: number
          contact_note?: string
          created_at?: string
          id?: string
          order_no?: string
          processed_at?: string | null
          processed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_exec_sql: { Args: { query: string }; Returns: Json }
      gen_order_no: { Args: { prefix: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
