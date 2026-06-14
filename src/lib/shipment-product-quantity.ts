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
