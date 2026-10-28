import type { ContainerDraft, ShipmentFormValues, ShipmentProductDraft } from "@/lib/types";

const DRAFT_VERSION = 1;
const PREFIX = "elmaghraby:shipment-draft:";

export type ShipmentFormDraftPayload = {
  form: ShipmentFormValues;
  containers: ContainerDraft[];
  committedProducts: ShipmentProductDraft[];
  productDraft: ShipmentProductDraft;
  editingProductIndex: number | null;
  chinaWarehouseOnly: boolean;
};

export type ShipmentFormDraft = ShipmentFormDraftPayload & {
  version: number;
  savedAt: string;
};

export function shipmentDraftStorageKey(shipmentId?: string) {
  return `${PREFIX}${shipmentId ?? "new"}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isProductDraft(value: unknown): value is ShipmentProductDraft {
  if (!isRecord(value)) return false;
  return (
    typeof value.product_id === "string" &&
    typeof value.quantity === "string" &&
    typeof value.cartons_count === "string" &&
    typeof value.unit_quantity === "string" &&
    typeof value.notes === "string" &&
    typeof value.is_new_incoming_product === "boolean" &&
    typeof value.is_disassembled === "boolean"
  );
}

function isContainerDraft(value: unknown): value is ContainerDraft {
  if (!isRecord(value)) return false;
  return (
    typeof value.container_number === "string" &&
    typeof value.weight_kg === "string" &&
    typeof value.cartons_count === "string" &&
    typeof value.notes === "string"
  );
}

function isFormValues(value: unknown): value is ShipmentFormValues {
  if (!isRecord(value)) return false;
  const keys: Array<keyof ShipmentFormValues> = [
    "acid",
    "customs_certificate_number",
    "company_id",
    "supplier_id",
    "shipping_port",
    "arrival_port",
    "shipped_at",
    "eta",
    "vessel_name",
    "shipping_duration_days",
    "shipment_type",
    "total_weight_kg",
    "total_cartons",
    "value_usd",
    "containers_count",
    "route",
    "notes",
  ];
  return keys.every((key) => typeof value[key] === "string");
}

export function readShipmentDraft(key: string): ShipmentFormDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== DRAFT_VERSION) return null;
    if (!isFormValues(parsed.form) || !Array.isArray(parsed.containers) || !Array.isArray(parsed.committedProducts)) {
      return null;
    }
    if (!parsed.containers.every(isContainerDraft) || !parsed.committedProducts.every(isProductDraft)) return null;
    if (!isProductDraft(parsed.productDraft)) return null;
    const editing = parsed.editingProductIndex;
    if (editing !== null && (typeof editing !== "number" || editing < 0)) return null;
    return {
      version: DRAFT_VERSION,
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : new Date().toISOString(),
      form: parsed.form,
      containers: parsed.containers,
      committedProducts: parsed.committedProducts,
      productDraft: parsed.productDraft,
      editingProductIndex: editing,
      chinaWarehouseOnly: parsed.chinaWarehouseOnly === true,
    };
  } catch {
    return null;
  }
}

export function writeShipmentDraft(key: string, payload: ShipmentFormDraftPayload) {
  if (typeof window === "undefined") return;
  try {
    const draft: ShipmentFormDraft = {
      version: DRAFT_VERSION,
      savedAt: new Date().toISOString(),
      ...payload,
    };
    window.localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    /* quota / private mode */
  }
}

export function shipmentDraftFingerprint(payload: Pick<ShipmentFormDraftPayload, "form" | "containers" | "committedProducts" | "productDraft" | "editingProductIndex">) {
  return JSON.stringify({
    form: payload.form,
    containers: payload.containers,
    committedProducts: payload.committedProducts,
    productDraft: payload.productDraft,
    editingProductIndex: payload.editingProductIndex,
  });
}

export function clearShipmentDraft(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
