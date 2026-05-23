export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ShipmentStatus = "in_sea" | "customs" | "closed";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          role: "admin" | "manager" | "viewer";
          locale: string;
          created_at: string;
          updated_at: string;
        };
      };
      companies: {
        Row: {
          id: string;
          name_ar: string;
          name_en: string | null;
          code: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name_ar: string;
          name_en?: string | null;
          code?: string | null;
          is_active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["companies"]["Insert"]>;
      };
      suppliers: {
        Row: {
          id: string;
          name_ar: string;
          country: string | null;
          contact_phone: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name_ar: string;
          country?: string | null;
          contact_phone?: string | null;
          is_active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["suppliers"]["Insert"]>;
      };
      products: {
        Row: {
          id: string;
          sku: string;
          name_ar: string;
          name_en: string | null;
          category: string | null;
          unit: string;
          is_active: boolean;
        };
      };
      product_categories: {
        Row: {
          id: string;
          name_ar: string;
          code: string | null;
          parent_id: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name_ar: string;
          code?: string | null;
          parent_id?: string | null;
          is_active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["product_categories"]["Insert"]>;
      };
      shipments: {
        Row: {
          id: string;
          shipment_number: string;
          acid: string;
          company_id: string;
          supplier_id: string;
          shipping_port: string;
          arrival_port: string;
          shipped_at: string;
          eta: string;
          shipping_duration_days: number | null;
          shipment_type: "FCL" | "LCL";
          route: string | null;
          status: ShipmentStatus;
          previous_status: "in_sea" | "customs" | null;
          delay_reason: string | null;
          delayed_at: string | null;
          auto_moved_to_customs_at: string | null;
          entry_completed_at: string | null;
          notes: string | null;
          created_by: string | null;
          closed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          shipment_number?: string;
          acid: string;
          company_id: string;
          supplier_id: string;
          shipping_port: string;
          arrival_port: string;
          shipped_at: string;
          eta: string;
          shipping_duration_days?: number | null;
          shipment_type?: "FCL" | "LCL";
          route?: string | null;
          status?: ShipmentStatus;
          notes?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["shipments"]["Insert"]> & {
          closed_at?: string | null;
        };
      };
    };
    Functions: {
      auto_move_shipments_to_customs: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      transition_shipment_status: {
        Args: {
          shipment_id: string;
          target_status: ShipmentStatus;
        };
        Returns: ShipmentStatus;
      };
    };
  };
}
