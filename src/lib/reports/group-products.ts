import { SHIPMENT_STATUS_LABELS } from "@/lib/constants";
import type { ProductKindFilter } from "@/lib/reports/constants";
import type { ReportRow } from "@/lib/reports/shipment-helpers";

export type ProductLine = {
  sku: string;
  name: string;
  category_id: string | null;
  category_name: string | null;
  image_path: string | null;
  cartons_count: number | null;
  quantity: number;
  eta: string;
  acid: string;
  shipment_number: string;
  is_disassembled: boolean;
  is_new: boolean;
  status: string;
};

type GroupedSku = {
  sku: string;
  name: string;
  category_name: string | null;
  image_path: string | null;
  byEta: Map<string, string[]>;
  totalCartons: number;
  totalPieces: number;
};

/** ETA column header: DD-MM-YYYY */
export function formatEtaHeader(eta: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(eta);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  return eta;
}

export function formatQuantityCell(line: ProductLine) {
  const cartons = line.cartons_count;
  const pieces = Number(line.quantity ?? 0);
  const qtyPart =
    cartons != null && cartons > 0 ? `${cartons} كرتونة (${pieces} قطعة)` : `${pieces} قطعة`;
  const kind = line.is_disassembled ? "مفكك" : "كامل";
  return `${qtyPart} — ${kind}`;
}

function collectDateColumns(grouped: GroupedSku[]) {
  const dates = new Set<string>();
  for (const row of grouped) {
    for (const eta of row.byEta.keys()) {
      if (eta && eta !== "-") dates.add(eta);
    }
  }
  return Array.from(dates).sort();
}

function rowsToReportRows(grouped: GroupedSku[]): ReportRow[] {
  const dateColumns = collectDateColumns(grouped);

  return grouped
    .sort((a, b) => a.name.localeCompare(b.name, "ar"))
    .map((row) => {
      const reportRow: ReportRow = {
        SKU: row.sku,
        المنتج: row.name,
        التصنيف: row.category_name ?? "-",
      };

      for (const eta of dateColumns) {
        const header = formatEtaHeader(eta);
        const cells = row.byEta.get(eta);
        reportRow[header] = cells?.length ? cells.join(" | ") : "-";
      }

      reportRow["إجمالي الكرتين"] = row.totalCartons;
      reportRow["إجمالي القطع"] = row.totalPieces;

      if (row.image_path) reportRow._imagePath = row.image_path;

      return reportRow;
    });
}

export function groupProductLines(
  lines: ProductLine[],
  options: {
    productKind?: ProductKindFilter;
    categoryIds?: Set<string>;
  } = {}
): ReportRow[] {
  let filtered = lines;

  if (options.categoryIds?.size) {
    filtered = filtered.filter((line) => line.category_id && options.categoryIds!.has(line.category_id));
  }

  if (options.productKind === "disassembled") {
    filtered = filtered.filter((line) => line.is_disassembled);
  } else if (options.productKind === "complete") {
    filtered = filtered.filter((line) => !line.is_disassembled);
  }

  const grouped = new Map<string, GroupedSku>();

  for (const line of filtered) {
    if (!line.sku) continue;
    const current = grouped.get(line.sku) ?? {
      sku: line.sku,
      name: line.name,
      category_name: line.category_name,
      image_path: line.image_path,
      byEta: new Map<string, string[]>(),
      totalCartons: 0,
      totalPieces: 0,
    };

    const eta = line.eta?.trim() || "-";
    const cell = formatQuantityCell(line);
    const cells = current.byEta.get(eta) ?? [];
    cells.push(cell);
    current.byEta.set(eta, cells);

    current.totalCartons += Number(line.cartons_count ?? 0);
    current.totalPieces += Number(line.quantity ?? 0);
    if (!current.image_path && line.image_path) current.image_path = line.image_path;
    if (!current.category_name && line.category_name) current.category_name = line.category_name;
    grouped.set(line.sku, current);
  }

  return rowsToReportRows(Array.from(grouped.values()));
}

export function productLinesToDetailRows(lines: ProductLine[], withImagePath = false): ReportRow[] {
  return lines.map((row) => ({
    SKU: row.sku,
    المنتج: row.name,
    التصنيف: row.category_name ?? "-",
    الكمية: row.quantity,
    الكرتين: row.cartons_count,
    "منتج جديد": row.is_new ? "نعم" : "لا",
    مفكك: row.is_disassembled ? "نعم" : "لا",
    "رقم الشحنة": row.shipment_number,
    ACID: row.acid,
    ETA: row.eta,
    الحالة: row.status,
    ...(withImagePath && row.image_path ? { _imagePath: row.image_path } : {}),
  }));
}

export function statusLabel(status: string) {
  return SHIPMENT_STATUS_LABELS[status as keyof typeof SHIPMENT_STATUS_LABELS] ?? status;
}
