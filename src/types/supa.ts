export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      expenses: {
        Row: {
          amount: number
          category: string
          date: string
          description: string | null
          id: string
        }
        Insert: {
          amount: number
          category: string
          date: string
          description?: string | null
          id?: string
        }
        Update: {
          amount?: number
          category?: string
          date?: string
          description?: string | null
          id?: string
        }
        Relationships: []
      },
      sales: {
        Row: {
          id: string;
          date: string;
          type: string;
          member: string;
          brand: string;
          qty: number;
          price: number;
          total: number;
          paid: number;
          incoming: number;
          clearance: string | null;
          balance: number;
          description: string;
        };
        Insert: {
          id?: string;
          date: string;
          type: string;
          member: string;
          brand: string;
          qty: number;
          price: number;
          total: number;
          paid: number;
          incoming: number;
          clearance?: string | null;
          balance: number;
          description: string;
        };
        Update: {
          id?: string;
          date?: string;
          type?: string;
          member?: string;
          brand?: string;
          qty?: number;
          price?: number;
          total?: number;
          paid?: number;
          incoming?: number;
          clearance?: string | null;
          balance?: number;
          description?: string;
        };
        Relationships: [];
      },
      notifications: {
        Row: {
          date: string | null
          id: string
          message: string | null
          read_status: boolean | null
          related_entity_id: string | null
          role: string | null
          timestamp: string | null
          type: string | null
          user_id: string | null
        }
        Insert: {
          date?: string | null
          id?: string
          message?: string | null
          read_status?: boolean | null
          related_entity_id?: string | null
          role?: string | null
          timestamp?: string | null
          type?: string | null
          user_id?: string | null
        }
        Update: {
          date?: string | null
          id?: string
          message?: string | null
          read_status?: boolean | null
          related_entity_id?: string | null
          role?: string | null
          timestamp?: string | null
          type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      },
      product_request_items: {
        Row: {
          id: string
          price: number
          product_id: string | null
          product_name: string
          quantity: number
          request_id: string | null
        }
        Insert: {
          id?: string
          price: number
          product_id?: string | null
          product_name: string
          quantity: number
          request_id?: string | null
        }
        Update: {
          id?: string
          price?: number
          product_id?: string | null
          product_name?: string
          quantity?: number
          request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_request_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_request_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          }
        ]
      },
      requests: {
        Row: {
          admin_notes: string | null
          amount_paid: number | null
          created_at: string | null
          id: string
          payment_status: string | null
          products_ordered: Json | null
          request_date: string | null
          reseller_id: string | null
          special_instructions: string | null
          status: string | null
          total_amount: number | null
          updated_at: string | null
          project_name: string | null
          start_date: string | null
          end_date: string | null
          priority: string | null
          team: string | null
        }
        Insert: {
          admin_notes?: string | null
          amount_paid?: number | null
          created_at?: string | null
          id?: string
          payment_status?: string | null
          products_ordered?: Json | null
          request_date?: string | null
          reseller_id?: string | null
          special_instructions?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
          project_name?: string | null
          start_date?: string | null
          end_date?: string | null
          priority?: string | null
          team?: string | null
        }
        Update: {
          admin_notes?: string | null
          amount_paid?: number | null
          created_at?: string | null
          id?: string
          payment_status?: string | null
          products_ordered?: Json | null
          request_date?: string | null
          reseller_id?: string | null
          special_instructions?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
          project_name?: string | null
          start_date?: string | null
          end_date?: string | null
          priority?: string | null
          team?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "requests_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      },
      products: {
        Row: {
          availability: string | null
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          inventory: number | null
          min_stock_alert: number | null
          name: string
          price: number | null
          production_status: string | null
          type: string | null
        }
        Insert: {
          availability?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          inventory?: number | null
          min_stock_alert?: number | null
          name: string
          price?: number | null
          production_status?: string | null
          type?: string | null
        }
        Update: {
          availability?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          inventory?: number | null
          min_stock_alert?: number | null
          name?: string
          price?: number | null
          production_status?: string | null
          type?: string | null
        }
        Relationships: []
      },
      users: {
        Row: {
          company_name: string | null
          contact_info: Json | null
          created_at: string | null
          email: string
          exclusive_features: string | null
          flagged_status: boolean | null
          id: string
          is_active: boolean | null
          role: string
        }
        Insert: {
          company_name?: string | null
          contact_info?: Json | null
          created_at?: string | null
          email: string
          exclusive_features?: string | null
          flagged_status?: boolean | null
          id?: string
          is_active?: boolean | null
          role: string
        }
        Update: {
          company_name?: string | null
          contact_info?: Json | null
          created_at?: string | null
          email?: string
          exclusive_features?: string | null
          flagged_status?: boolean | null
          id?: string
          is_active?: boolean | null
          role?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
