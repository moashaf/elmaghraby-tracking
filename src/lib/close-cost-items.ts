export type CloseCostItemKey =
  | "delivery_permit_egp"
  | "delivery_permit_usd"
  | "customs_certificate_fees"
  | "bank_form"
  | "shipping_agency_fine"
  | "customs_storage"
  | "misc_handling"
  | "explosives"
  | "container_transport"
  | "misc_fikri"
  | "taxes"
  | "form_fees"
  | "warehouse_unload_transport"
  | "port_labor_classification"
  | "storage_capacity_letter"
  | "import_file_industrial"
  | "import_file_food"
  | "ilac"
  | "lab_fees"
  | "sample_fees"
  | "factory_registration"
  | "policy_approval"
  | "stamps_scales"
  | "movement_officer"
  | "movement_supervisor"
  | "surveyor"
  | "appraiser"
  | "complex_manager"
  | "investigations"
  | "security"
  | "narcotics_investigations"
  | "tariff_manager"
  | "scanner_transfer"
  | "salah_expenses";

export type CloseCostGroupId = "customs_admin" | "taxes_forms" | "warehouse_port" | "processing_fees";

export type CloseCostItem = {
  key: CloseCostItemKey;
  labelAr: string;
  group: CloseCostGroupId;
};

export type CloseCostGroup = {
  id: CloseCostGroupId;
  labelAr: string;
  rollup: "customs_cost" | "clearance_cost" | "local_transport_cost" | "other_expenses";
};

export const CLOSE_COST_GROUPS: CloseCostGroup[] = [
  { id: "customs_admin", labelAr: "إدارية وجمركية", rollup: "customs_cost" },
  { id: "taxes_forms", labelAr: "ضرائب ونماذج", rollup: "clearance_cost" },
  { id: "warehouse_port", labelAr: "مخزن وميناء", rollup: "local_transport_cost" },
  { id: "processing_fees", labelAr: "كتابة ملفات ورسوم حركة", rollup: "other_expenses" },
];

export const CLOSE_COST_ITEMS: CloseCostItem[] = [
  { key: "delivery_permit_egp", labelAr: "إذن تسليم مصري", group: "customs_admin" },
  { key: "delivery_permit_usd", labelAr: "إذن تسليم دولار", group: "customs_admin" },
  { key: "customs_certificate_fees", labelAr: "رسوم شهادة جمركية", group: "customs_admin" },
  { key: "bank_form", labelAr: "استمارة بنك", group: "customs_admin" },
  { key: "shipping_agency_fine", labelAr: "غرامة توكيل ملاحي دولار", group: "customs_admin" },
  { key: "customs_storage", labelAr: "ارضيات الجمرك", group: "customs_admin" },
  { key: "misc_handling", labelAr: "مصاريف متنوعة (تعتيقات)", group: "customs_admin" },
  { key: "explosives", labelAr: "مفرقعات", group: "customs_admin" },
  { key: "container_transport", labelAr: "نقل الحاويات (ثابت للحاوية الواحدة)", group: "customs_admin" },
  { key: "misc_fikri", labelAr: "متنوع (على فكري)", group: "customs_admin" },
  { key: "taxes", labelAr: "ضرائب", group: "taxes_forms" },
  { key: "form_fees", labelAr: "مصاريف نموذج", group: "taxes_forms" },
  { key: "warehouse_unload_transport", labelAr: "مصاريف تنزيل ونقل في المخزن", group: "warehouse_port" },
  { key: "port_labor_classification", labelAr: "تصنيف عمال داخل الميناء", group: "warehouse_port" },
  { key: "storage_capacity_letter", labelAr: "جواب سعه تخزينيه (منزلي فقط)", group: "warehouse_port" },
  { key: "import_file_industrial", labelAr: "كتابة ملف واردات (صناعي)", group: "processing_fees" },
  { key: "import_file_food", labelAr: "كتابة ملف واردات (غذائي)", group: "processing_fees" },
  { key: "ilac", labelAr: "ايلاك", group: "processing_fees" },
  { key: "lab_fees", labelAr: "مصاريف معمل", group: "processing_fees" },
  { key: "sample_fees", labelAr: "مصاريف عينات", group: "processing_fees" },
  { key: "factory_registration", labelAr: "تسجيل مصنع", group: "processing_fees" },
  { key: "policy_approval", labelAr: "موافقة سياسات", group: "processing_fees" },
  { key: "stamps_scales", labelAr: "دمغة وموازين", group: "processing_fees" },
  { key: "movement_officer", labelAr: "مأمور حركة", group: "processing_fees" },
  { key: "movement_supervisor", labelAr: "مشرف حركة", group: "processing_fees" },
  { key: "surveyor", labelAr: "معاين", group: "processing_fees" },
  { key: "appraiser", labelAr: "مثمن", group: "processing_fees" },
  { key: "complex_manager", labelAr: "مدير مجمع", group: "processing_fees" },
  { key: "investigations", labelAr: "مباحث", group: "processing_fees" },
  { key: "security", labelAr: "امن", group: "processing_fees" },
  { key: "narcotics_investigations", labelAr: "مباحث مخدرات", group: "processing_fees" },
  { key: "tariff_manager", labelAr: "مدير التعريفة", group: "processing_fees" },
  { key: "scanner_transfer", labelAr: "تحويل كشاف", group: "processing_fees" },
  { key: "salah_expenses", labelAr: "مصاريف صلاح", group: "processing_fees" },
];

export type CloseCostLineItems = Partial<Record<CloseCostItemKey, number>>;

export type CloseCostRollups = {
  customs_cost: number;
  shipping_cost: number;
  clearance_cost: number;
  local_transport_cost: number;
  other_expenses: number;
  total_cost: number;
};

export function emptyCloseCostLineItems(): Record<CloseCostItemKey, number> {
  return Object.fromEntries(CLOSE_COST_ITEMS.map((item) => [item.key, 0])) as Record<CloseCostItemKey, number>;
}

export function normalizeCloseCostLineItems(raw: unknown): Record<CloseCostItemKey, number> {
  const base = emptyCloseCostLineItems();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;

  const source = raw as Record<string, unknown>;
  for (const item of CLOSE_COST_ITEMS) {
    const value = Number(source[item.key]);
    base[item.key] = Number.isFinite(value) && value > 0 ? value : 0;
  }
  return base;
}

export function lineItemsToFormStrings(raw: unknown): Record<CloseCostItemKey, string> {
  const normalized = normalizeCloseCostLineItems(raw);
  return Object.fromEntries(
    CLOSE_COST_ITEMS.map((item) => [item.key, String(normalized[item.key] || 0)])
  ) as Record<CloseCostItemKey, string>;
}

export function formStringsToLineItems(form: Record<CloseCostItemKey, string>): Record<CloseCostItemKey, number> {
  const result = emptyCloseCostLineItems();
  for (const item of CLOSE_COST_ITEMS) {
    const value = Number(form[item.key]);
    result[item.key] = Number.isFinite(value) && value > 0 ? value : 0;
  }
  return result;
}

export function sumCloseCostLineItems(items: CloseCostLineItems): number {
  return CLOSE_COST_ITEMS.reduce((sum, item) => sum + (Number(items[item.key]) || 0), 0);
}

export function toCloseCostRollups(items: CloseCostLineItems): CloseCostRollups {
  const rollups: CloseCostRollups = {
    customs_cost: 0,
    shipping_cost: 0,
    clearance_cost: 0,
    local_transport_cost: 0,
    other_expenses: 0,
    total_cost: 0,
  };

  for (const group of CLOSE_COST_GROUPS) {
    const groupSum = CLOSE_COST_ITEMS.filter((item) => item.group === group.id).reduce(
      (sum, item) => sum + (Number(items[item.key]) || 0),
      0
    );
    rollups[group.rollup] = groupSum;
  }

  rollups.total_cost =
    rollups.customs_cost +
    rollups.shipping_cost +
    rollups.clearance_cost +
    rollups.local_transport_cost +
    rollups.other_expenses;

  return rollups;
}

export function nonZeroCloseCostItems(items: CloseCostLineItems) {
  return CLOSE_COST_ITEMS.filter((item) => (Number(items[item.key]) || 0) > 0).map((item) => ({
    ...item,
    amount: Number(items[item.key]) || 0,
  }));
}
