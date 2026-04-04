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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          category: string | null
          code: string | null
          currency: string | null
          id: number
          is_nominal: boolean | null
          name: string
          position: number | null
        }
        Insert: {
          category?: string | null
          code?: string | null
          currency?: string | null
          id?: number
          is_nominal?: boolean | null
          name: string
          position?: number | null
        }
        Update: {
          category?: string | null
          code?: string | null
          currency?: string | null
          id?: number
          is_nominal?: boolean | null
          name?: string
          position?: number | null
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          key_hash: string
          last_used_at: string | null
          name: string
          provider: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          key_hash: string
          last_used_at?: string | null
          name: string
          provider: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          key_hash?: string
          last_used_at?: string | null
          name?: string
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      brands: {
        Row: {
          created_at: string | null
          id: number
          is_active: boolean | null
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          name: string
        }
        Update: {
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          customer_type: string | null
          discount_percentage: number | null
          email: string | null
          id: number
          identification_number: string
          is_final_consumer: boolean | null
          name: string
          phone: string | null
        }
        Insert: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          customer_type?: string | null
          discount_percentage?: number | null
          email?: string | null
          id?: number
          identification_number: string
          is_final_consumer?: boolean | null
          name: string
          phone?: string | null
        }
        Update: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          customer_type?: string | null
          discount_percentage?: number | null
          email?: string | null
          id?: number
          identification_number?: string
          is_final_consumer?: boolean | null
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      inventory_levels: {
        Row: {
          current_stock: number | null
          id: number
          last_updated: string | null
          product_id: number | null
          warehouse_id: number | null
        }
        Insert: {
          current_stock?: number | null
          id?: number
          last_updated?: string | null
          product_id?: number | null
          warehouse_id?: number | null
        }
        Update: {
          current_stock?: number | null
          id?: number
          last_updated?: string | null
          product_id?: number | null
          warehouse_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_levels_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_levels_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_logs: {
        Row: {
          created_at: string | null
          id: number
          product_id: number | null
          quantity_change: number
          reason: string | null
          reference_id: string | null
          reference_type: string | null
          user_id: string | null
          warehouse_id: number | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          product_id?: number | null
          quantity_change: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          user_id?: string | null
          warehouse_id?: number | null
        }
        Update: {
          created_at?: string | null
          id?: number
          product_id?: number | null
          quantity_change?: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          user_id?: string | null
          warehouse_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_logs_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      lost_demand: {
        Row: {
          channel: string | null
          created_at: string
          id: number
          product_id: number | null
          reason: string | null
          search_term: string
          user_id: string | null
        }
        Insert: {
          channel?: string | null
          created_at?: string
          id?: number
          product_id?: number | null
          reason?: string | null
          search_term: string
          user_id?: string | null
        }
        Update: {
          channel?: string | null
          created_at?: string
          id?: number
          product_id?: number | null
          reason?: string | null
          search_term?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lost_demand_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: number
          order_id: number | null
          product_id: number | null
          quantity: number
          unit_cost: number
          unit_price: number
        }
        Insert: {
          id?: number
          order_id?: number | null
          product_id?: number | null
          quantity: number
          unit_cost?: number
          unit_price: number
        }
        Update: {
          id?: number
          order_id?: number | null
          product_id?: number | null
          quantity?: number
          unit_cost?: number
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
          bank_reference_code: string | null
          channel: string | null
          closer_id: string | null
          created_at: string | null
          created_by: string | null
          customer_id: number | null
          id: number
          partner_id: number | null
          payment_account_id: number | null
          payment_receipt_url: string | null
          payment_status: string | null
          promo_code: string | null
          shipping_address: string | null
          shipping_cost: number | null
          shipping_expense_account_id: number | null
          shipping_notes: string | null
          status: string | null
          total_amount: number | null
          warehouse_id: number | null
        }
        Insert: {
          bank_reference_code?: string | null
          channel?: string | null
          closer_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: number | null
          id?: number
          partner_id?: number | null
          payment_account_id?: number | null
          payment_receipt_url?: string | null
          payment_status?: string | null
          promo_code?: string | null
          shipping_address?: string | null
          shipping_cost?: number | null
          shipping_expense_account_id?: number | null
          shipping_notes?: string | null
          status?: string | null
          total_amount?: number | null
          warehouse_id?: number | null
        }
        Update: {
          bank_reference_code?: string | null
          channel?: string | null
          closer_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: number | null
          id?: number
          partner_id?: number | null
          payment_account_id?: number | null
          payment_receipt_url?: string | null
          payment_status?: string | null
          promo_code?: string | null
          shipping_address?: string | null
          shipping_cost?: number | null
          shipping_expense_account_id?: number | null
          shipping_notes?: string | null
          status?: string | null
          total_amount?: number | null
          warehouse_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_payment_account_id_fkey"
            columns: ["payment_account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_payment_account_id_fkey"
            columns: ["payment_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shipping_expense_account_id_fkey"
            columns: ["shipping_expense_account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shipping_expense_account_id_fkey"
            columns: ["shipping_expense_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          id: number
          name: string
          status: string | null
          type: string | null
        }
        Insert: {
          id?: number
          name: string
          status?: string | null
          type?: string | null
        }
        Update: {
          id?: number
          name?: string
          status?: string | null
          type?: string | null
        }
        Relationships: []
      }
      product_entries_history: {
        Row: {
          cost_without_vat: number
          created_at: string | null
          discount_percentage: number | null
          discounted_cost: number | null
          final_cost_with_vat: number
          id: number
          product_id: number | null
          sku: string | null
          user_id: string | null
          vat_percentage: number
        }
        Insert: {
          cost_without_vat: number
          created_at?: string | null
          discount_percentage?: number | null
          discounted_cost?: number | null
          final_cost_with_vat: number
          id?: number
          product_id?: number | null
          sku?: string | null
          user_id?: string | null
          vat_percentage: number
        }
        Update: {
          cost_without_vat?: number
          created_at?: string | null
          discount_percentage?: number | null
          discounted_cost?: number | null
          final_cost_with_vat?: number
          id?: number
          product_id?: number | null
          sku?: string | null
          user_id?: string | null
          vat_percentage?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_entries_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand_id: number | null
          category: string | null
          cost_without_vat: number | null
          created_at: string | null
          id: number
          image_url: string | null
          min_stock_threshold: number | null
          name: string
          price: number | null
          profit_margin: number | null
          sku: string
          strike_count: number | null
          strike_price_candidate: number | null
          vat_percentage: number | null
        }
        Insert: {
          brand_id?: number | null
          category?: string | null
          cost_without_vat?: number | null
          created_at?: string | null
          id?: number
          image_url?: string | null
          min_stock_threshold?: number | null
          name: string
          price?: number | null
          profit_margin?: number | null
          sku: string
          strike_count?: number | null
          strike_price_candidate?: number | null
          vat_percentage?: number | null
        }
        Update: {
          brand_id?: number | null
          category?: string | null
          cost_without_vat?: number | null
          created_at?: string | null
          id?: number
          image_url?: string | null
          min_stock_threshold?: number | null
          name?: string
          price?: number | null
          profit_margin?: number | null
          sku?: string
          strike_count?: number | null
          strike_price_candidate?: number | null
          vat_percentage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean | null
          nickname: string | null
          referral_code: string | null
          role_id: number | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean | null
          nickname?: string | null
          referral_code?: string | null
          role_id?: number | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          nickname?: string | null
          referral_code?: string | null
          role_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          id: number
          name: string
          permissions: Json | null
        }
        Insert: {
          id?: number
          name: string
          permissions?: Json | null
        }
        Update: {
          id?: number
          name?: string
          permissions?: Json | null
        }
        Relationships: []
      }
      system_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          status: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload: Json
          processed_at?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      transaction_lines: {
        Row: {
          account_id: number | null
          credit: number | null
          debit: number | null
          id: number
          transaction_id: number | null
        }
        Insert: {
          account_id?: number | null
          credit?: number | null
          debit?: number | null
          id?: number
          transaction_id?: number | null
        }
        Update: {
          account_id?: number | null
          credit?: number | null
          debit?: number | null
          id?: number
          transaction_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transaction_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_lines_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          created_at: string | null
          description: string | null
          id: number
          order_id: number | null
          reference_type: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: number
          order_id?: number | null
          reference_type?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: number
          order_id?: number | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          id: number
          is_active: boolean | null
          location: string | null
          name: string
          partner_id: number | null
          type: string | null
        }
        Insert: {
          id?: number
          is_active?: boolean | null
          location?: string | null
          name: string
          partner_id?: number | null
          type?: string | null
        }
        Update: {
          id?: number
          is_active?: boolean | null
          location?: string | null
          name?: string
          partner_id?: number | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      account_balances: {
        Row: {
          category: string | null
          code: string | null
          currency: string | null
          current_balance: number | null
          id: number | null
          is_nominal: boolean | null
          name: string | null
          position: number | null
        }
        Relationships: []
      }
      employee_earnings_summary: {
        Row: {
          closer_id: string | null
          closer_name: string | null
          earned_commission: number | null
          promo_attributed_orders: number | null
          promo_attributed_sales: number | null
          referral_code: string | null
          total_gross_profit: number | null
          total_orders: number | null
          total_sales: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      create_transaction_v1: {
        Args: {
          p_description: string
          p_lines: Json
          p_order_id: number
          p_reference_type: string
        }
        Returns: number
      }
      get_models_by_make: {
        Args: { p_make: string }
        Returns: {
          model: string
        }[]
      }
      get_unique_makes: {
        Args: never
        Returns: {
          make: string
        }[]
      }
      process_batch_product_entry:
        | {
            Args: {
              p_brand_id: number
              p_products: Json
              p_vat_percentage: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_brand_id: number
              p_payment_account_id: number
              p_products: Json
              p_vat_percentage: number
              p_warehouse_id: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_brand_id: number
              p_products: Json
              p_vat_percentage: number
              p_warehouse_id: number
            }
            Returns: Json
          }
      process_inventory_movement: {
        Args: {
          p_product_id: number
          p_quantity_change: number
          p_reason: string
          p_reference_id?: string
          p_reference_type?: string
          p_warehouse_id: number
        }
        Returns: Json
      }
      process_inventory_transfer: {
        Args: {
          p_destination_warehouse: number
          p_product_id: number
          p_quantity: number
          p_reason: string
          p_source_warehouse: number
        }
        Returns: Json
      }
      process_pos_sale:
        | {
            Args: {
              p_closer_id?: string
              p_customer_id: number
              p_items: Database["public"]["CompositeTypes"]["pos_item_input"][]
              p_payment_account_id: number
              p_promo_code?: string
              p_shipping_address?: string
              p_shipping_cost: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_closer_id?: string
              p_customer_id: number
              p_items: Database["public"]["CompositeTypes"]["pos_item_input"][]
              p_payment_account_id: number
              p_promo_code?: string
              p_shipping_address?: string
              p_shipping_cost: number
              p_shipping_expense_account_id?: number
            }
            Returns: Json
          }
      process_product_entry_cost: {
        Args: {
          p_cost_without_vat: number
          p_discounted_cost: number
          p_product_id: number
          p_user_id: string
          p_vat_percentage: number
        }
        Returns: Json
      }
      process_quick_stock_adjustment:
        | {
            Args: {
              p_merma_account_id: number
              p_payment_account_id: number
              p_products: Json
              p_warehouse_id: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_payment_account_id: number
              p_products: Json
              p_warehouse_id: number
            }
            Returns: Json
          }
      reconcile_inventory: {
        Args: { p_product_id: number; p_warehouse_id: number }
        Returns: Json
      }
      save_draft_order: {
        Args: {
          p_closer_id?: string
          p_customer_id: number
          p_draft_id?: number
          p_items: Database["public"]["CompositeTypes"]["pos_item_input"][]
          p_promo_code?: string
          p_shipping_cost: number
        }
        Returns: Json
      }
      search_inventory_by_fitment: {
        Args: { p_make?: string; p_model?: string; p_year?: number }
        Returns: {
          brand_name: string
          current_stock: number
          inventory_id: number
          product_category: string
          product_cost: number
          product_id: number
          product_margin: number
          product_min_stock: number
          product_name: string
          product_price: number
          product_sku: string
          warehouse_id: number
          warehouse_name: string
        }[]
      }
      sync_vendor_catalog: { Args: { p_products: Json }; Returns: Json }
      validate_api_key: { Args: { p_key_hash: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      pos_item_input: {
        product_id: number | null
        warehouse_id: number | null
        quantity: number | null
        unit_price: number | null
        unit_cost: number | null
      }
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
