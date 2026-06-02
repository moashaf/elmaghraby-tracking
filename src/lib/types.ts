import type { ShipmentStatus } from "@/lib/constants";

export type Company = {
  id: string;
  name_ar: string;
  name_en: string | null;
  code: string | null;
  is_active: boolean;
};

export type Supplier = {
  id: string;
  name_ar: string;
  code: string | null;
  country: string | null;
  contact_phone: string | null;
  is_active: boolean;
};

export type Product = {
  id: string;
  sku: string;
  name_ar: string;
  name_en: string | null;
  category: string | null;
  category_id: string | null;
  barcode: string | null;
  unit: string;
  is_active: boolean;
};

export type ShippingRoute = {
  id: string;
  shipping_port: string;
  arrival_port: string;
  duration_days: number;
  is_active: boolean;
};

export type ProductCategory = {
  id: string;
  name_ar: string;
  code: string | null;
  parent_id: string | null;
  is_active: boolean;
  created_at?: string;
  parent?: Pick<ProductCategory, "id" | "name_ar"> | null;
};

export type Shipment = {
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
  shipment_type: string;
  total_weight_kg: number | null;
  total_cartons: number | null;
  route: string | null;
  status: ShipmentStatus;
  notes: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  companies?: Pick<Company, "name_ar"> | null;
  suppliers?: Pick<Supplier, "name_ar"> | null;
};

export type ShipmentContainer = {
  id: string;
  shipment_id: string;
  container_number: string;
  weight_kg: number | null;
  cartons_count: number | null;
  notes: string | null;
};

export type ShipmentProduct = {
  id: string;
  shipment_id: string;
  product_id: string;
  quantity: number;
  cartons_count: number | null;
  notes: string | null;
  is_new_incoming_product: boolean;
  products?: Pick<Product, "sku" | "name_ar" | "unit"> | null;
};

export type ShipmentCost = {
  id: string;
  shipment_id: string;
  customs_cost: number;
  shipping_cost: number;
  clearance_cost: number;
  local_transport_cost: number;
  other_expenses: number;
  total_cost: number;
  closing_notes: string | null;
  closed_by: string | null;
  closed_at: string;
  updated_at: string;
};

export type TimelineEvent = {
  id: string;
  shipment_id: string;
  event_type: string;
  title_ar: string;
  description_ar: string | null;
  created_at: string;
};

export type ContainerFile = {
  id: string;
  container_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_at: string;
  shipment_containers?: Pick<ShipmentContainer, "container_number"> | null;
};

export type ShipmentDocument = {
  id: string;
  shipment_id: string;
  doc_type: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_at: string;
};

export type ShipmentFormValues = {
  acid: string;
  company_id: string;
  supplier_id: string;
  shipping_port: string;
  arrival_port: string;
  shipped_at: string;
  eta: string;
  shipping_duration_days: string;
  shipment_type: string;
  total_weight_kg: string;
  total_cartons: string;
  containers_count: string;
  route: string;
  notes: string;
};

export type ContainerDraft = {
  container_number: string;
  weight_kg: string;
  cartons_count: string;
  notes: string;
};

export type ShipmentProductDraft = {
  product_id: string;
  quantity: string;
  cartons_count: string;
  notes: string;
  is_new_incoming_product: boolean;
};
