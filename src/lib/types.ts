export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      products: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          price: number | null;
          category: string | null;
          availability: 'in-stock' | 'low-stock' | 'out-of-stock';
          image_url: string | null;
          created_at: string | null;
          inventory: number | null;
          min_stock_alert: number | null;
          production_status: string | null;
          type: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          price?: number | null;
          category?: string | null;
          availability?: 'in-stock' | 'low-stock' | 'out-of-stock';
          image_url?: string | null;
          created_at?: string | null;
          inventory?: number | null;
          min_stock_alert?: number | null;
          production_status?: string | null;
          type?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          price?: number | null;
          category?: string | null;
          availability?: 'in-stock' | 'low-stock' | 'out-of-stock';
          image_url?: string | null;
          created_at?: string | null;
          inventory?: number | null;
          min_stock_alert?: number | null;
          production_status?: string | null;
          type?: string | null;
        };
        Relationships: [];
      };

      requests: {
        Row: {
          id: string;
          request_date: string | null;
          reseller_id: string | null;
          status: string | null;
          created_at: string | null;
          updated_at: string | null;
          amount_paid: number | null;
          payment_status: string | null;
          total_amount: number | null;
          products_ordered: Json | null;
          special_instructions: string | null;
          admin_notes: string | null;
        };
        Insert: {
          id?: string;
          request_date?: string | null;
          reseller_id?: string | null;
          status?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          amount_paid?: number | null;
          payment_status?: string | null;
          total_amount?: number | null;
          products_ordered?: Json | null;
          special_instructions?: string | null;
          admin_notes?: string | null;
        };
        Update: {
          id?: string;
          request_date?: string | null;
          reseller_id?: string | null;
          status?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          amount_paid?: number | null;
          payment_status?: string | null;
          total_amount?: number | null;
          products_ordered?: Json | null;
          special_instructions?: string | null;
          admin_notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "requests_reseller_id_fkey";
            columns: ["reseller_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };

      product_request_items: {
        Row: {
          id: string;
          request_id: string;
          product_id: string;
          product_name: string;
          quantity: number;
          price: number;
        };
        Insert: {
          id?: string;
          request_id: string;
          product_id: string;
          product_name: string;
          quantity: number;
          price: number;
        };
        Update: {
          id?: string;
          request_id?: string;
          product_id?: string;
          product_name?: string;
          quantity?: number;
          price?: number;
        };
        Relationships: [
          {
            foreignKeyName: "product_request_items_request_id_fkey";
            columns: ["request_id"];
            referencedRelation: "requests";
            referencedColumns: ["id"];
          }
        ];
      };

      notifications: {
        Row: {
          id: string;
          message: string | null;
          user_id: string | null;
          timestamp: string | null;
          date: string | null;
          read_status: boolean | null;
          related_entity_id: string | null;
          role: string | null;
          type: string | null;
        };
        Insert: {
          id?: string;
          message?: string | null;
          user_id?: string | null;
          timestamp?: string | null;
          date?: string | null;
          read_status?: boolean | null;
          related_entity_id?: string | null;
          role?: string | null;
          type?: string | null;
        };
        Update: {
          id?: string;
          message?: string | null;
          user_id?: string | null;
          timestamp?: string | null;
          date?: string | null;
          read_status?: boolean | null;
          related_entity_id?: string | null;
          role?: string | null;
          type?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };

      users: {
        Row: {
          id: string;
          email: string;
          role: string;
          company_name: string | null;
          contact_info: Json | null;
          created_at: string | null;
          exclusive_features: string | null;
          flagged_status: boolean | null;
          is_active: boolean | null;
        };
        Insert: {
          id?: string;
          email: string;
          role: string;
          company_name?: string | null;
          contact_info?: Json | null;
          created_at?: string | null;
          exclusive_features?: string | null;
          flagged_status?: boolean | null;
          is_active?: boolean | null;
        };
        Update: {
          id?: string;
          email?: string;
          role?: string;
          company_name?: string | null;
          contact_info?: Json | null;
          created_at?: string | null;
          exclusive_features?: string | null;
          flagged_status?: boolean | null;
          is_active?: boolean | null;
        };
        Relationships: [];
      };

      expenses: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          category: string;
          description: string | null;
          date: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount: number;
          category: string;
          description?: string | null;
          date: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          amount?: number;
          category?: string;
          description?: string | null;
          date?: string;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
  ];
};


    };

    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
};

//Table code

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

