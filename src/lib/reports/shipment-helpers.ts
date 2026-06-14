import type { ShipmentStatus } from "@/lib/constants";

export type ReportRow = Record<string, string | number | null> & {
  _downloadPath?: string;
  _imagePath?: string;
  _shipmentId?: string;
};

export type ShipmentReportRow = {
  id: string;
  shipment_number: string;
  acid: string;
  company: string;
  supplier: string;
  shipping_port: string;
  arrival_port: string;
  shipped_at: string;
  eta: string;
  status: ShipmentStatus;
  closed_at: string | null;
  shipment_type: string;
  total_cartons: number | null;
  value_usd: number | null;
};

export const shipmentSelect =
  "shipment_number,acid,shipment_type,total_cartons,value_usd,shipping_port,arrival_port,shipped_at,eta,status,closed_at,companies(name_ar),suppliers(name_ar)";

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function inRange(date: string | null | undefined, from: string, to: string) {
  if (!from && !to) return true;
  if (!date) return false;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

export function filterShipmentByDate(row: ShipmentReportRow, from: string, to: string, mode: "eta" | "closed" | "none") {
  if (mode === "none") return true;
  if (mode === "closed") return inRange(row.closed_at, from, to);
  return inRange(row.eta, from, to);
}

export function normalizeShipment(row: Record<string, unknown>): ShipmentReportRow {
  const company = row.companies as { name_ar?: string } | null;
  const supplier = row.suppliers as { name_ar?: string } | null;
  return {
    id: String(row.id ?? ""),
    shipment_number: String(row.shipment_number ?? ""),
    acid: String(row.acid ?? ""),
    company: company?.name_ar ?? "-",
    supplier: supplier?.name_ar ?? "-",
    shipping_port: String(row.shipping_port ?? ""),
    arrival_port: String(row.arrival_port ?? ""),
    shipped_at: String(row.shipped_at ?? ""),
    eta: String(row.eta ?? ""),
    status: row.status as ShipmentStatus,
    closed_at: row.closed_at ? String(row.closed_at).slice(0, 10) : null,
    shipment_type: String(row.shipment_type ?? ""),
    total_cartons: row.total_cartons == null ? null : Number(row.total_cartons),
    value_usd: row.value_usd == null ? null : Number(row.value_usd),
  };
}

export function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
