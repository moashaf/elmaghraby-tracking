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
  image_url?: string | null;
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
  vessel_name?: string | null;
  vessel_imo?: string | null;
  vessel_mmsi?: string | null;
  weiyun_ship_id?: string | null;
  vessel_location_text?: string | null;
  vessel_tracked_at?: string | null;
  vessel_tracking_status?: "pending" | "ok" | "not_found" | "error" | null;
  shipping_duration_days: number | null;
  shipment_type: string;
  total_weight_kg: number | null;
  total_cartons: number | null;
  value_usd: number | null;
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
  is_disassembled: boolean;
  products?: Pick<Product, "sku" | "name_ar" | "unit" | "image_url"> | null;
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
  vessel_name: string;
  shipping_duration_days: string;
  shipment_type: string;
  total_weight_kg: string;
  total_cartons: string;
  value_usd: string;
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
  unit_quantity: string;
  notes: string;
  is_new_incoming_product: boolean;
  is_disassembled: boolean;
};

export type PoStatus =
  | "draft"
  | "confirmed"
  | "partially_received"
  | "received"
  | "over_received"
  | "cancelled";

export type PurchaseOrder = {
  id: string;
  po_number: string;
  supplier_id: string;
  company_id: string;
  order_date: string;
  expected_eta: string | null;
  status: PoStatus;
  notes: string | null;
  created_by: string | null;
  received_at: string | null;
  created_at: string;
  updated_at: string;
  suppliers?: Pick<Supplier, "name_ar"> | null;
  companies?: Pick<Company, "name_ar"> | null;
};

export type PoItemStatus = "draft" | "awaiting_receipt" | "received" | "cancelled";

export type PurchaseOrderItem = {
  id: string;
  purchase_order_id: string;
  product_id: string;
  order_quantity: number;
  order_cartons: number | null;
  accepted_quantity: number | null;
  accepted_cartons: number | null;
  is_disassembled: boolean;
  is_new_incoming_product: boolean;
  confirmed_at: string | null;
  item_status: PoItemStatus;
  notes: string | null;
  products?: Pick<Product, "sku" | "name_ar" | "unit"> | null;
};

export type PurchaseOrderDeliveryBatch = {
  id: string;
  purchase_order_item_id: string;
  planned_quantity: number;
  planned_cartons: number | null;
  planned_date: string | null;
  status: "scheduled" | "received" | "cancelled";
  notes: string | null;
  created_at: string;
};

export type PurchaseOrderReceipt = {
  id: string;
  purchase_order_id: string;
  purchase_order_item_id: string;
  delivery_batch_id?: string | null;
  received_date: string;
  received_quantity: number;
  received_cartons: number | null;
  notes: string | null;
  received_by: string | null;
  created_at: string;
  purchase_order_items?: Pick<PurchaseOrderItem, "product_id"> & {
    products?: Pick<Product, "sku" | "name_ar"> | null;
  } | null;
};

export type ShipmentAllocation = {
  id: string;
  purchase_order_receipt_id: string;
  shipment_id: string;
  shipment_product_id: string;
  allocated_quantity: number;
  allocated_cartons: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  purchase_order_receipts?: Pick<PurchaseOrderReceipt, "received_quantity" | "received_date"> & {
    purchase_order_items?: { products?: Pick<Product, "sku" | "name_ar"> | null } | null;
  } | null;
};

export type PoTimelineEvent = {
  id: string;
  purchase_order_id: string;
  event_type: string;
  title_ar: string;
  description_ar: string | null;
  created_at: string;
};

export type PurchaseOrderItemDraft = {
  product_id: string;
  cartons_count: string;
  unit_quantity: string;
  quantity: string;
  is_disassembled: boolean;
  is_new_incoming_product: boolean;
  notes: string;
};

export type PurchaseOrderFormValues = {
  supplier_id: string;
  company_id: string;
  order_date: string;
  notes: string;
};
