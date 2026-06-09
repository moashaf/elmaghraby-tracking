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

function formatArrivalLine(line: ProductLine) {
  const cartons = line.cartons_count ?? line.quantity;
  const kind = line.is_disassembled ? "مفكك" : "كامل";
  return `${cartons} كرت — ${line.eta} — ${kind}`;
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

  const grouped = new Map<
    string,
    {
      sku: string;
      name: string;
      category_name: string | null;
      image_path: string | null;
      details: string[];
      totalCartons: number;
    }
  >();

  for (const line of filtered) {
    if (!line.sku) continue;
    const current = grouped.get(line.sku) ?? {
      sku: line.sku,
      name: line.name,
      category_name: line.category_name,
      image_path: line.image_path,
      details: [],
      totalCartons: 0,
    };
    current.details.push(formatArrivalLine(line));
    current.totalCartons += Number(line.cartons_count ?? line.quantity ?? 0);
    if (!current.image_path && line.image_path) current.image_path = line.image_path;
    if (!current.category_name && line.category_name) current.category_name = line.category_name;
    grouped.set(line.sku, current);
  }

  return Array.from(grouped.values())
    .sort((a, b) => a.name.localeCompare(b.name, "ar"))
    .map((row) => ({
      SKU: row.sku,
      المنتج: row.name,
      التصنيف: row.category_name ?? "-",
      "تفاصيل الوصول": row.details.join(" | "),
      "إجمالي الكرتين": row.totalCartons,
      ...(row.image_path ? { _imagePath: row.image_path } : {}),
    }));
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
