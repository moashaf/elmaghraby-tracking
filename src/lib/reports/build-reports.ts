import { createClient } from "@/lib/supabase/client";
import { fetchAllFromTable } from "@/lib/supabase/fetch-all";
import { SHIPMENT_STATUS_LABELS } from "@/lib/constants";
import { collectDescendantCategoryIds } from "@/lib/category-tree";
import type { ProductCategory } from "@/lib/types";
import type { ProductKindFilter } from "@/lib/reports/constants";
import { GROUPED_PRODUCT_REPORT_SLUGS } from "@/lib/reports/constants";
import {
  groupProductLines,
  productLinesToDetailRows,
  statusLabel,
  type ProductLine,
} from "@/lib/reports/group-products";
import {
  filterShipmentByDate,
  normalizeShipment,
  shipmentSelect,
  todayIso,
  unwrapRelation,
  type ReportRow,
  type ShipmentReportRow,
} from "@/lib/reports/shipment-helpers";

type ShipmentProductJoin = {
  quantity: number;
  cartons_count: number | null;
  is_new_incoming_product: boolean;
  is_disassembled: boolean;
  products: {
    sku: string;
    name_ar: string;
    category_id: string | null;
    category: string | null;
    image_url: string | null;
  } | null;
  shipments: ShipmentReportRow | ShipmentReportRow[] | null;
};

type ContainerJoin = {
  container_number: string;
  weight_kg: number | null;
  cartons_count: number | null;
  shipments: ShipmentReportRow | ShipmentReportRow[] | null;
};

type ContainerFileJoin = {
  file_name: string;
  storage_path: string;
  size_bytes: number | null;
  uploaded_at: string;
  shipment_containers: {
    container_number: string;
    shipments: ShipmentReportRow | ShipmentReportRow[] | null;
  } | null;
};

type CostJoin = {
  customs_cost: number;
  shipping_cost: number;
  clearance_cost: number;
  local_transport_cost: number;
  other_expenses: number;
  total_cost: number;
  closing_notes: string | null;
  shipments: ShipmentReportRow | ShipmentReportRow[] | null;
};

function shipmentToReportRow(row: ShipmentReportRow): ReportRow {
  return {
    "رقم الشحنة": row.shipment_number,
    ACID: row.acid,
    الشركة: row.company,
    المورد: row.supplier,
    "ميناء الشحن": row.shipping_port,
    "ميناء الوصول": row.arrival_port,
    "تاريخ الشحن": row.shipped_at,
    ETA: row.eta,
    الحالة: SHIPMENT_STATUS_LABELS[row.status],
    "تاريخ الإغلاق": row.closed_at,
    ...(row.id ? { _shipmentId: row.id } : {}),
  };
}

function normalizeShipmentJoin(value: ShipmentReportRow | ShipmentReportRow[] | null): ShipmentReportRow | null {
  const row = unwrapRelation(value);
  if (!row) return null;
  return normalizeShipment(row as unknown as Record<string, unknown>);
}

function toProductLine(row: ShipmentProductJoin): ProductLine | null {
  const shipment = normalizeShipmentJoin(row.shipments);
  if (!row.products || !shipment) return null;
  return {
    sku: row.products.sku,
    name: row.products.name_ar,
    category_id: row.products.category_id,
    category_name: row.products.category,
    image_path: row.products.image_url,
    cartons_count: row.cartons_count,
    quantity: row.quantity,
    eta: shipment.eta,
    acid: shipment.acid,
    shipment_number: shipment.shipment_number,
    is_disassembled: row.is_disassembled,
    is_new: row.is_new_incoming_product,
    status: statusLabel(shipment.status),
  };
}

export type BuildReportOptions = {
  categoryId?: string;
  productKind?: ProductKindFilter;
};

export async function buildReport(
  slug: string,
  from: string,
  to: string,
  options: BuildReportOptions = {}
): Promise<{ rows: ReportRow[] } | { error: string }> {
  const supabase = createClient();

  if (slug === "all-products") return allProductsReport();

  if (
    [
      "containers",
      "container-files",
      "incoming-products",
      "new-products",
      "disassembled-products",
      "duplicate-products",
      "date-range-products",
      "product-history",
      "costs",
    ].includes(slug)
  ) {
    if (slug === "containers") return containersReport(from, to);
    if (slug === "container-files") return containerFilesReport();
    if (slug === "costs") return costsReport(from, to);
    return productsReport(slug, from, to, options);
  }

  const result = await supabase.from("shipments").select(`id,${shipmentSelect}`).order("created_at", { ascending: false });
  if (result.error) return { error: result.error.message };

  const shipments = ((result.data ?? []) as Array<Record<string, unknown>>).map(normalizeShipment);
  const today = todayIso();
  const next10 = new Date();
  next10.setDate(next10.getDate() + 10);
  const next10Iso = next10.toISOString().slice(0, 10);

  let filtered = shipments.filter((row) => filterShipmentByDate(row, from, to, slug === "closed" ? "closed" : "eta"));
  if (slug === "in-sea") filtered = filtered.filter((row) => row.status === "in_sea");
  if (slug === "customs" || slug === "ready-to-close") filtered = filtered.filter((row) => row.status === "customs");
  if (slug === "closed") filtered = filtered.filter((row) => row.status === "closed");
  if (slug === "delayed") filtered = filtered.filter((row) => row.status !== "closed" && row.eta < today);
  if (slug === "arriving-10" || slug === "arriving-30") {
    filtered = filtered.filter((row) => row.status !== "closed" && row.eta >= today && row.eta <= next10Iso);
  }

  if (slug === "suppliers") {
    const grouped = new Map<string, number>();
    shipments.forEach((row) => grouped.set(row.supplier, (grouped.get(row.supplier) ?? 0) + 1));
    return { rows: Array.from(grouped.entries()).map(([supplier, count]) => ({ المورد: supplier, "عدد الشحنات": count })) };
  }

  if (slug === "companies") {
    const grouped = new Map<string, number>();
    shipments.forEach((row) => grouped.set(row.company, (grouped.get(row.company) ?? 0) + 1));
    return { rows: Array.from(grouped.entries()).map(([company, count]) => ({ الشركة: company, "عدد الشحنات": count })) };
  }

  return { rows: filtered.map(shipmentToReportRow) };
}

async function allProductsReport(): Promise<{ rows: ReportRow[] } | { error: string }> {
  const result = await fetchAllFromTable(
    createClient(),
    "products",
    "sku,name_ar,barcode,category,is_active,image_url",
    { column: "name_ar", ascending: true }
  );

  if (result.error) return { error: result.error };

  return {
    rows: (result.data as Array<{
      sku: string;
      name_ar: string;
      barcode: string | null;
      category: string | null;
      is_active: boolean;
      image_url: string | null;
    }>).map((row) => ({
      الكود: row.sku,
      "اسم الصنف": row.name_ar,
      الباركود: row.barcode ?? "",
      التصنيف: row.category ?? "",
      الحالة: row.is_active ? "نشط" : "متوقف",
      ...(row.image_url ? { _imagePath: row.image_url } : {}),
    })),
  };
}

async function productsReport(
  slug: string,
  from: string,
  to: string,
  options: BuildReportOptions
): Promise<{ rows: ReportRow[] } | { error: string }> {
  const result = await fetchAllFromTable(
    createClient(),
    "shipment_products",
    `quantity,cartons_count,is_new_incoming_product,is_disassembled,products(sku,name_ar,category_id,category,image_url),shipments(${shipmentSelect})`
  );

  if (result.error) return { error: result.error };

  let joins = (result.data as unknown as ShipmentProductJoin[])
    .map((row) => ({ ...row, shipments: normalizeShipmentJoin(row.shipments) }))
    .filter((row) => row.shipments && filterShipmentByDate(row.shipments!, from, to, "eta"));

  if (slug === "new-products") joins = joins.filter((row) => row.is_new_incoming_product);
  if (slug === "disassembled-products") joins = joins.filter((row) => row.is_disassembled);

  if (slug === "duplicate-products") {
    const openCounts = new Map<string, number>();
    joins.forEach((row) => {
      if (row.shipments?.status !== "closed" && row.products?.sku) {
        openCounts.set(row.products.sku, (openCounts.get(row.products.sku) ?? 0) + 1);
      }
    });
    joins = joins.filter((row) => row.products?.sku && (openCounts.get(row.products.sku) ?? 0) > 1);
  }

  let categoryIds: Set<string> | undefined;
  if (options.categoryId) {
    const categoriesResult = await fetchAllFromTable<ProductCategory>(
      createClient(),
      "product_categories",
      "id,name_ar,parent_id,is_active"
    );
    if (categoriesResult.error) return { error: categoriesResult.error };
    categoryIds = collectDescendantCategoryIds(categoriesResult.data, options.categoryId);
  }

  const lines = joins.map(toProductLine).filter((line): line is ProductLine => line !== null);

  if (slug === "product-history") {
    const grouped = new Map<string, { name: string; quantity: number; shipments: number; lastSeen: string; image_path: string | null }>();
    lines.forEach((line) => {
      const current = grouped.get(line.sku) ?? {
        name: line.name,
        quantity: 0,
        shipments: 0,
        lastSeen: "",
        image_path: line.image_path,
      };
      current.quantity += Number(line.quantity ?? 0);
      current.shipments += 1;
      current.lastSeen = current.lastSeen > line.eta ? current.lastSeen : line.eta;
      if (!current.image_path && line.image_path) current.image_path = line.image_path;
      grouped.set(line.sku, current);
    });
    return {
      rows: Array.from(grouped.entries()).map(([sku, value]) => ({
        SKU: sku,
        المنتج: value.name,
        "إجمالي الكمية": value.quantity,
        "مرات الاستيراد": value.shipments,
        "آخر ETA": value.lastSeen,
        ...(value.image_path ? { _imagePath: value.image_path } : {}),
      })),
    };
  }

  if (GROUPED_PRODUCT_REPORT_SLUGS.includes(slug as (typeof GROUPED_PRODUCT_REPORT_SLUGS)[number])) {
    return {
      rows: groupProductLines(lines, {
        productKind: options.productKind,
        categoryIds,
      }),
    };
  }

  return { rows: productLinesToDetailRows(lines, true) };
}

async function containersReport(from: string, to: string): Promise<{ rows: ReportRow[] } | { error: string }> {
  const result = await fetchAllFromTable(
    createClient(),
    "shipment_containers",
    `container_number,weight_kg,cartons_count,shipments(${shipmentSelect})`
  );
  if (result.error) return { error: result.error };
  const rows = (result.data as unknown as ContainerJoin[])
    .map((row) => ({ ...row, shipments: normalizeShipmentJoin(row.shipments) }))
    .filter((row) => row.shipments && filterShipmentByDate(row.shipments, from, to, "eta"));
  return {
    rows: rows.map((row) => ({
      "رقم الحاوية": row.container_number,
      الوزن: row.weight_kg,
      الكرتين: row.cartons_count,
      "رقم الشحنة": row.shipments?.shipment_number ?? "-",
      الشركة: row.shipments?.company ?? "-",
      المورد: row.shipments?.supplier ?? "-",
      ETA: row.shipments?.eta ?? "-",
      الحالة: row.shipments ? SHIPMENT_STATUS_LABELS[row.shipments.status] : "-",
    })),
  };
}

async function containerFilesReport(): Promise<{ rows: ReportRow[] } | { error: string }> {
  const result = await fetchAllFromTable(
    createClient(),
    "container_files",
    `file_name,storage_path,size_bytes,uploaded_at,shipment_containers(container_number,shipments(${shipmentSelect}))`,
    { column: "uploaded_at", ascending: false }
  );
  if (result.error) return { error: result.error };

  const rows = result.data as unknown as ContainerFileJoin[];
  return {
    rows: rows.map((row) => {
      const shipment = normalizeShipmentJoin(row.shipment_containers?.shipments ?? null);
      return {
        "رقم الشحنة": shipment?.shipment_number ?? "-",
        ACID: shipment?.acid ?? "-",
        الحاوية: row.shipment_containers?.container_number ?? "-",
        الملف: row.file_name,
        "تاريخ الرفع": row.uploaded_at.slice(0, 10),
        ETA: shipment?.eta ?? "-",
        _downloadPath: row.storage_path,
      };
    }),
  };
}

async function costsReport(from: string, to: string): Promise<{ rows: ReportRow[] } | { error: string }> {
  const result = await fetchAllFromTable(
    createClient(),
    "shipment_costs",
    `customs_cost,shipping_cost,clearance_cost,local_transport_cost,other_expenses,total_cost,closing_notes,shipments(${shipmentSelect})`
  );
  if (result.error) return { error: result.error };
  const rows = (result.data as unknown as CostJoin[])
    .map((row) => ({ ...row, shipments: normalizeShipmentJoin(row.shipments) }))
    .filter((row) => row.shipments && filterShipmentByDate(row.shipments, from, to, "closed"));
  return {
    rows: rows.map((row) => ({
      "رقم الشحنة": row.shipments?.shipment_number ?? "-",
      الشركة: row.shipments?.company ?? "-",
      المورد: row.shipments?.supplier ?? "-",
      جمارك: row.customs_cost,
      شحن: row.shipping_cost,
      تخليص: row.clearance_cost,
      "نقل داخلي": row.local_transport_cost,
      أخرى: row.other_expenses,
      الإجمالي: row.total_cost,
      ملاحظات: row.closing_notes,
    })),
  };
}

export async function fetchCategoryShippedProducts(categoryId: string, categories: ProductCategory[]) {
  const categoryIds = collectDescendantCategoryIds(categories, categoryId);
  const result = await fetchAllFromTable(
    createClient(),
    "shipment_products",
    `quantity,cartons_count,is_disassembled,products(sku,name_ar,category_id,category,image_url),shipments(shipment_number,eta,acid,status,companies(name_ar))`
  );
  if (result.error) return { error: result.error, rows: [] as ReportRow[] };

  const grouped = new Map<string, ReportRow>();
  for (const raw of result.data as unknown as ShipmentProductJoin[]) {
    const product = raw.products;
    if (!product?.category_id || !categoryIds.has(product.category_id)) continue;
    const shipmentRaw = unwrapRelation(raw.shipments) as Record<string, unknown> | null;
    if (!shipmentRaw) continue;
    const company = unwrapRelation(shipmentRaw.companies as { name_ar?: string } | { name_ar?: string }[] | null);
    const key = product.sku;
    const line = `${raw.cartons_count ?? raw.quantity} كرت — ${String(shipmentRaw.eta ?? "-")} — ${raw.is_disassembled ? "مفكك" : "كامل"}`;
    const existing = grouped.get(key);
    if (existing) {
      existing["تفاصيل الشحن"] = `${existing["تفاصيل الشحن"]} | ${line}`;
      existing["إجمالي الكرتين"] = Number(existing["إجمالي الكرتين"] ?? 0) + Number(raw.cartons_count ?? raw.quantity ?? 0);
    } else {
      grouped.set(key, {
        SKU: product.sku,
        المنتج: product.name_ar,
        التصنيف: product.category ?? "-",
        "تفاصيل الشحن": line,
        "إجمالي الكرتين": Number(raw.cartons_count ?? raw.quantity ?? 0),
        ACID: String(shipmentRaw.acid ?? "-"),
        الشركة: company?.name_ar ?? "-",
        ...(product.image_url ? { _imagePath: product.image_url } : {}),
      });
    }
  }

  return { rows: Array.from(grouped.values()).sort((a, b) => String(a.المنتج).localeCompare(String(b.المنتج), "ar")) };
}
