function trimNumber(value: number) {
  if (Math.abs(value - Math.round(value)) < 1e-9) return String(Math.round(value));
  return String(parseFloat(value.toFixed(4)));
}

export function unitFromCartonsAndTotal(cartons: number | null | undefined, total: number | null | undefined) {
  if (cartons == null || total == null || cartons <= 0 || total <= 0) return "";
  const unit = total / cartons;
  if (!Number.isFinite(unit) || unit <= 0) return "";
  return trimNumber(unit);
}

export function totalFromCartonsAndUnit(cartons: number | null | undefined, unit: number | null | undefined) {
  if (cartons == null || unit == null || cartons <= 0 || unit <= 0) return "";
  const total = cartons * unit;
  if (!Number.isFinite(total) || total <= 0) return "";
  return trimNumber(total);
}

export function displayUnitPerCarton(cartons: number | null | undefined, total: number) {
  const unit = unitFromCartonsAndTotal(cartons, total);
  return unit || "-";
}

export function syncProductQuantityFields<T extends { cartons_count: string; unit_quantity: string; quantity: string }>(
  row: T
): T {
  const total = totalFromCartonsAndUnit(Number(row.cartons_count), Number(row.unit_quantity));
  return { ...row, quantity: total };
}

function toPositiveQuantity(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export type ProductLineSpecs = {
  product_id: string;
  cartons_count: string;
  unit_quantity: string;
  quantity: string;
  notes: string;
  is_new_incoming_product: boolean;
  is_disassembled: boolean;
};

export function sameProductLineSpecs(a: ProductLineSpecs, b: ProductLineSpecs) {
  return (
    a.product_id === b.product_id &&
    toPositiveQuantity(a.unit_quantity) === toPositiveQuantity(b.unit_quantity) &&
    Boolean(a.is_disassembled) === Boolean(b.is_disassembled) &&
    Boolean(a.is_new_incoming_product) === Boolean(b.is_new_incoming_product) &&
    a.notes.trim() === b.notes.trim()
  );
}

export function mergeOrAppendProductLine<T extends ProductLineSpecs>(
  list: T[],
  draft: T,
  replaceIndex: number | null = null
): T[] {
  if (replaceIndex != null) {
    return list.map((row, index) => (index === replaceIndex ? draft : row));
  }

  const matchIndex = list.findIndex((row) => sameProductLineSpecs(row, draft));
  if (matchIndex < 0) return [...list, draft];

  const current = list[matchIndex];
  const mergedCartons = toPositiveQuantity(current.cartons_count) + toPositiveQuantity(draft.cartons_count);
  const merged = syncProductQuantityFields({
    ...current,
    cartons_count: String(mergedCartons),
    notes: current.notes.trim() || draft.notes.trim(),
  });
  return list.map((row, index) => (index === matchIndex ? merged : row));
}

