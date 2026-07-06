import { createClient } from "@/lib/supabase/client";
import { fetchAllFromTable, fetchAllWhereIn } from "@/lib/supabase/fetch-all";
import { SHIPMENT_STATUS_LABELS } from "@/lib/constants";
import { formatUsd, formatDisplayDate } from "@/lib/format";
import {
  computeShipmentStatusSummary,
  type ShipmentStatusSummary,
} from "@/lib/shipment-container-count";
import { compareShipmentsByInvoiceNumber, displayInvoiceNumber, shipmentInvoiceLabel } from "@/lib/shipment-invoice-number";
import { CUSTOMS_RELEASE_DOC_TYPE } from "@/lib/storage-path";
import { fetchSystemSettings, isShipmentDelayed } from "@/lib/system-settings";
import { collectDescendantCategoryIds } from "@/lib/category-tree";
import type { ProductCategory } from "@/lib/types";
import type { ProductKindFilter } from "@/lib/reports/constants";
import { GROUPED_PRODUCT_REPORT_SLUGS, INCOMING_PRODUCTS_PAGE_SIZE } from "@/lib/reports/constants";
import {
  groupProductLines,
  productLinesToDetailRows,
  statusLabel,
  type ProductLine,
} from "@/lib/reports/group-products";
import {
  inRange,
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

type ShipmentDocumentJoin = {
  file_name: string;
  storage_path: string;
  uploaded_at: string;
  shipments: ShipmentReportRow | ShipmentReportRow[] | null;
};

function documentReportRow(dateIso: string | null | undefined, fileName: string, storagePath: string): ReportRow {
  return {
    التاريخ: dateIso ? formatDisplayDate(dateIso.slice(0, 10)) : "-",
    "اسم الملف": fileName,
    الرابط: "فتح الملف",
    _downloadPath: storagePath,
  };
}

function filterDocumentByDate(
  row: ShipmentDocumentJoin,
  from: string,
  to: string,
  mode: "closed" | "uploaded"
) {
  const shipment = normalizeShipmentJoin(row.shipments);
  const date =
    mode === "closed"
      ? shipment?.closed_at ?? row.uploaded_at.slice(0, 10)
      : row.uploaded_at.slice(0, 10);
  return inRange(date, from, to);
}

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
    "رقم الفاتورة": row.invoice_file_name ? displayInvoiceNumber(row.invoice_file_name) : "-",
    ACID: row.acid,
    الشركة: row.company,
    "عدد الكراتين": row.total_cartons ?? "-",
    "عدد الحاويات": row.containers_count,
    "قيمة الفاتورة ($)": formatUsd(row.value_usd),
    "تاريخ الشحن": formatDisplayDate(row.shipped_at),
    "تاريخ الوصول المتوقع": formatDisplayDate(row.eta),
    الحالة: SHIPMENT_STATUS_LABELS[row.status],
    "نوع البضاعة": row.shipment_type || "-",
    _status: row.status,
    ...(row.id ? { _shipmentId: row.id } : {}),
  };
}

async function fetchInvoiceFileNamesByShipmentId(): Promise<Map<string, string>> {
  const result = await fetchAllFromTable(
    createClient(),
    "shipment_documents",
    "shipment_id,doc_type,file_name,uploaded_at",
    { column: "uploaded_at", ascending: false }
  );
  if (result.error) return new Map();

  const map = new Map<string, string>();
  for (const row of result.data as Array<{ shipment_id: string; doc_type: string; file_name: string }>) {
    if (row.doc_type?.toUpperCase() !== "INV") continue;
    if (!map.has(row.shipment_id)) map.set(row.shipment_id, row.file_name);
  }
  return map;
}

function attachInvoiceNumbers(shipments: ShipmentReportRow[], invoiceMap: Map<string, string>): ShipmentReportRow[] {
  return shipments.map((row) => ({
    ...row,
    invoice_file_name: invoiceMap.get(row.id) ?? null,
  }));
}

function sortShipmentsByInvoiceNumber(shipments: ShipmentReportRow[]): ShipmentReportRow[] {
  return [...shipments].sort(compareShipmentsByInvoiceNumber);
}

function normalizeShipmentJoin(value: ShipmentReportRow | ShipmentReportRow[] | null): ShipmentReportRow | null {
  const row = unwrapRelation(value);
  if (!row) return null;
  return normalizeShipment(row as unknown as Record<string, unknown>);
}

function toProductLine(row: ShipmentProductJoin, invoiceMap: Map<string, string>): ProductLine | null {
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
    shipment_id: shipment.id,
    shipment_number: shipment.shipment_number,
    invoice_file_name: invoiceMap.get(shipment.id) ?? null,
    is_disassembled: row.is_disassembled,
    is_new: row.is_new_incoming_product,
    status: statusLabel(shipment.status),
  };
}

export type BuildReportOptions = {
  categoryId?: string;
  productKind?: ProductKindFilter;
  page?: number;
  pageSize?: number;
  /** When true, return all matching rows (e.g. Excel export) instead of one page. */
  exportAll?: boolean;
};

export type BuildReportResult = {
  rows: ReportRow[];
  statusSummary?: ShipmentStatusSummary;
  totalRows?: number;
  page?: number;
  pageSize?: number;
};

export async function buildReport(
  slug: string,
  from: string,
  to: string,
  options: BuildReportOptions = {}
): Promise<BuildReportResult | { error: string }> {
  const supabase = createClient();

  if (slug === "all-products") return allProductsReport();

  if (slug === "customs-releases") return customsReleasesReport(from, to);
  if (slug === "shipment-invoices") return shipmentInvoicesReport(from, to);

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

  const invoiceMap = await fetchInvoiceFileNamesByShipmentId();
  const systemSettings = slug === "delayed" ? await fetchSystemSettings() : null;
  const shipments = attachInvoiceNumbers(
    ((result.data ?? []) as Array<Record<string, unknown>>).map(normalizeShipment),
    invoiceMap
  );
  const today = todayIso();
  const next10 = new Date();
  next10.setDate(next10.getDate() + 10);
  const next10Iso = next10.toISOString().slice(0, 10);

  let filtered = shipments.filter((row) => filterShipmentByDate(row, from, to, slug === "closed" ? "closed" : "eta"));
  if (slug === "in-sea") filtered = filtered.filter((row) => row.status === "in_sea");
  if (slug === "customs" || slug === "ready-to-close") filtered = filtered.filter((row) => row.status === "customs");
  if (slug === "closed") filtered = filtered.filter((row) => row.status === "closed");
  if (slug === "delayed") {
    filtered = filtered.filter((row) => isShipmentDelayed(row.eta, row.status, systemSettings ?? { delayed_after_eta_days: 0, require_costs_before_close: true, require_customs_document: false }));
  }
  if (slug === "arriving-10") {
    filtered = filtered.filter((row) => row.status !== "closed" && row.eta >= today && row.eta <= next10Iso);
  }

  if (slug === "suppliers") {
    const grouped = new Map<string, number>();
    shipments.forEach((row) => grouped.set(row.supplier, (grouped.get(row.supplier) ?? 0) + 1));
    return {
      rows: Array.from(grouped.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([supplier, count]) => ({ المورد: supplier, "عدد الشحنات": count })),
    };
  }

  if (slug === "companies") {
    const grouped = new Map<string, number>();
    shipments.forEach((row) => grouped.set(row.company, (grouped.get(row.company) ?? 0) + 1));
    return {
      rows: Array.from(grouped.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([company, count]) => ({ الشركة: company, "عدد الشحنات": count })),
    };
  }

  if (slug === "summary") {
    const openShipments = filtered.filter((row) => row.status !== "closed");
    const sorted = sortShipmentsByInvoiceNumber(openShipments);
    return {
      rows: sorted.map(shipmentToReportRow),
      statusSummary: computeShipmentStatusSummary(openShipments),
    };
  }

  return { rows: sortShipmentsByInvoiceNumber(filtered).map(shipmentToReportRow) };
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

type ShipmentProductLightRow = {
  product_id: string;
  shipment_id: string;
  quantity: number;
  cartons_count: number | null;
  is_new_incoming_product: boolean;
  is_disassembled: boolean;
};

type ProductMeta = {
  id: string;
  sku: string;
  name_ar: string;
  category_id: string | null;
  category: string | null;
  image_url: string | null;
};

async function resolveReportCategoryIds(categoryId?: string): Promise<{ categoryIds?: Set<string>; error?: string }> {
  if (!categoryId) return {};

  const categoriesResult = await fetchAllFromTable<ProductCategory>(
    createClient(),
    "product_categories",
    "id,name_ar,parent_id,is_active"
  );
  if (categoriesResult.error) return { error: categoriesResult.error };
  return { categoryIds: collectDescendantCategoryIds(categoriesResult.data, categoryId) };
}

function filterLightRowsByKind(rows: ShipmentProductLightRow[], productKind?: ProductKindFilter) {
  if (productKind === "disassembled") return rows.filter((row) => row.is_disassembled);
  if (productKind === "complete") return rows.filter((row) => !row.is_disassembled);
  return rows;
}

function lightRowsToProductLines(
  rows: ShipmentProductLightRow[],
  productById: Map<string, ProductMeta>,
  shipmentById: Map<string, ShipmentReportRow>,
  invoiceMap: Map<string, string>
): ProductLine[] {
  const lines: ProductLine[] = [];

  for (const row of rows) {
    const product = productById.get(row.product_id);
    const shipment = shipmentById.get(row.shipment_id);
    if (!product || !shipment) continue;

    lines.push({
      sku: product.sku,
      name: product.name_ar,
      category_id: product.category_id,
      category_name: product.category,
      image_path: product.image_url,
      cartons_count: row.cartons_count,
      quantity: Number(row.quantity ?? 0),
      eta: shipment.eta,
      acid: shipment.acid,
      shipment_id: shipment.id,
      shipment_number: shipment.shipment_number,
      invoice_file_name: invoiceMap.get(shipment.id) ?? null,
      is_disassembled: row.is_disassembled,
      is_new: row.is_new_incoming_product,
      status: statusLabel(shipment.status),
    });
  }

  return lines;
}

async function incomingProductsReport(
  from: string,
  to: string,
  options: BuildReportOptions
): Promise<BuildReportResult | { error: string }> {
  const pageSize = options.pageSize ?? INCOMING_PRODUCTS_PAGE_SIZE;
  const page = Math.max(1, options.page ?? 1);
  const paginate = !options.exportAll;

  const shipmentsResult = await fetchAllFromTable(
    createClient(),
    "shipments",
    `id,${shipmentSelect}`,
    { column: "created_at", ascending: false }
  );
  if (shipmentsResult.error) return { error: shipmentsResult.error };

  const shipments = (shipmentsResult.data as Array<Record<string, unknown>>)
    .map(normalizeShipment)
    .filter((row) => filterShipmentByDate(row, from, to, "eta"));

  const shipmentById = new Map(shipments.map((row) => [row.id, row]));
  const shipmentIds = shipments.map((row) => row.id);
  const dateColumns = [...new Set(shipments.map((row) => row.eta).filter(Boolean))].sort();

  if (!shipmentIds.length) {
    return { rows: [], totalRows: 0, page, pageSize };
  }

  const categoryResult = await resolveReportCategoryIds(options.categoryId);
  if (categoryResult.error) return { error: categoryResult.error };
  const categoryIds = categoryResult.categoryIds;

  const lightResult = await fetchAllWhereIn<ShipmentProductLightRow>(
    createClient(),
    "shipment_products",
    "product_id,shipment_id,quantity,cartons_count,is_new_incoming_product,is_disassembled",
    "shipment_id",
    shipmentIds
  );
  if (lightResult.error) return { error: lightResult.error };

  let lightRows = filterLightRowsByKind(lightResult.data, options.productKind);
  if (!lightRows.length) {
    return { rows: [], totalRows: 0, page, pageSize };
  }

  const allProductIds = [...new Set(lightRows.map((row) => row.product_id))];
  const productsResult = await fetchAllWhereIn<ProductMeta>(
    createClient(),
    "products",
    "id,sku,name_ar,category_id,category,image_url",
    "id",
    allProductIds
  );
  if (productsResult.error) return { error: productsResult.error };

  const productById = new Map(productsResult.data.map((row) => [row.id, row]));

  if (categoryIds?.size) {
    lightRows = lightRows.filter((row) => {
      const product = productById.get(row.product_id);
      return product?.category_id && categoryIds.has(product.category_id);
    });
  }

  const sortedProductIds = [...new Set(lightRows.map((row) => row.product_id))]
    .filter((id) => productById.has(id))
    .sort((a, b) => productById.get(a)!.name_ar.localeCompare(productById.get(b)!.name_ar, "ar"));

  const totalRows = sortedProductIds.length;
  const pageProductIds = paginate
    ? sortedProductIds.slice((page - 1) * pageSize, page * pageSize)
    : sortedProductIds;

  const pageLightRows = lightRows.filter((row) => pageProductIds.includes(row.product_id));
  const invoiceMap = await fetchInvoiceFileNamesByShipmentId();
  const lines = lightRowsToProductLines(pageLightRows, productById, shipmentById, invoiceMap);

  return {
    rows: groupProductLines(lines, {
      productKind: options.productKind,
      categoryIds,
      dateColumns,
    }),
    totalRows,
    page: paginate ? page : 1,
    pageSize: paginate ? pageSize : totalRows,
  };
}

async function productsReport(
  slug: string,
  from: string,
  to: string,
  options: BuildReportOptions
): Promise<BuildReportResult | { error: string }> {
  if (slug === "incoming-products") {
    return incomingProductsReport(from, to, options);
  }

  const result = await fetchAllFromTable(
    createClient(),
    "shipment_products",
    `quantity,cartons_count,is_new_incoming_product,is_disassembled,products(sku,name_ar,category_id,category,image_url),shipments(${shipmentSelect})`
  );

  if (result.error) return { error: result.error };

  const invoiceMap = await fetchInvoiceFileNamesByShipmentId();

  let joins = (result.data as unknown as ShipmentProductJoin[])
    .map((row) => ({ ...row, shipments: normalizeShipmentJoin(row.shipments) }))
    .filter((row) => row.shipments && filterShipmentByDate(row.shipments!, from, to, "eta"));

  if (slug === "new-products") joins = joins.filter((row) => row.is_new_incoming_product);
  if (slug === "disassembled-products") joins = joins.filter((row) => row.is_disassembled);

  if (slug === "duplicate-products") {
    const openShipmentsBySku = new Map<string, Set<string>>();
    joins.forEach((row) => {
      if (row.shipments?.status !== "closed" && row.products?.sku && row.shipments?.id) {
        const set = openShipmentsBySku.get(row.products.sku) ?? new Set<string>();
        set.add(row.shipments.id);
        openShipmentsBySku.set(row.products.sku, set);
      }
    });
    joins = joins.filter((row) => row.products?.sku && (openShipmentsBySku.get(row.products.sku)?.size ?? 0) > 1);
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

  const lines = joins.map((row) => toProductLine(row, invoiceMap)).filter((line): line is ProductLine => line !== null);

  if (slug === "product-history") {
    const grouped = new Map<
      string,
      { name: string; quantity: number; shipmentIds: Set<string>; lastSeen: string; image_path: string | null }
    >();
    lines.forEach((line) => {
      const current = grouped.get(line.sku) ?? {
        name: line.name,
        quantity: 0,
        shipmentIds: new Set<string>(),
        lastSeen: "",
        image_path: line.image_path,
      };
      current.quantity += Number(line.quantity ?? 0);
      if (line.shipment_id) current.shipmentIds.add(line.shipment_id);
      current.lastSeen = current.lastSeen > line.eta ? current.lastSeen : line.eta;
      if (!current.image_path && line.image_path) current.image_path = line.image_path;
      grouped.set(line.sku, current);
    });
    return {
      rows: Array.from(grouped.entries()).map(([sku, value]) => ({
        SKU: sku,
        المنتج: value.name,
        "إجمالي الكمية": value.quantity,
        "مرات الاستيراد": value.shipmentIds.size,
        "آخر وصول": value.lastSeen,
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
  const invoiceMap = await fetchInvoiceFileNamesByShipmentId();
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
    rows: sortShipmentsByInvoiceNumber(
      rows.map((row) => ({
        ...row.shipments!,
        invoice_file_name: invoiceMap.get(row.shipments!.id) ?? null,
      }))
    ).flatMap((shipment) => {
      const containerRows = rows.filter((r) => r.shipments?.id === shipment.id);
      return containerRows.map((row) => ({
        "رقم الحاوية": row.container_number,
        الوزن: row.weight_kg,
        الكرتين: row.cartons_count,
        "رقم الفاتورة": shipmentInvoiceLabel(shipment.invoice_file_name),
        الشركة: row.shipments?.company ?? "-",
        المورد: row.shipments?.supplier ?? "-",
        "تاريخ الوصول المتوقع": row.shipments?.eta ?? "-",
        الحالة: row.shipments ? SHIPMENT_STATUS_LABELS[row.shipments.status] : "-",
        _shipmentId: shipment.id,
      }));
    }),
  };
}

async function fetchShipmentDocuments(docType: string): Promise<{ rows: ShipmentDocumentJoin[]; error: string | null }> {
  const result = await fetchAllFromTable(
    createClient(),
    "shipment_documents",
    `file_name,storage_path,uploaded_at,doc_type,shipments(${shipmentSelect})`,
    { column: "uploaded_at", ascending: false }
  );
  if (result.error) return { rows: [], error: result.error };

  const rows = (result.data as unknown as Array<ShipmentDocumentJoin & { doc_type: string }>).filter(
    (row) => row.doc_type?.toUpperCase() === docType.toUpperCase()
  );
  return { rows, error: null };
}

async function customsReleasesReport(from: string, to: string): Promise<{ rows: ReportRow[] } | { error: string }> {
  const { rows, error } = await fetchShipmentDocuments(CUSTOMS_RELEASE_DOC_TYPE);
  if (error) return { error };

  const filtered = rows
    .filter((row) => filterDocumentByDate(row, from, to, "closed"))
    .sort((a, b) => {
      const dateA = normalizeShipmentJoin(a.shipments)?.closed_at ?? a.uploaded_at;
      const dateB = normalizeShipmentJoin(b.shipments)?.closed_at ?? b.uploaded_at;
      return dateB.localeCompare(dateA);
    });

  return {
    rows: filtered.map((row) => {
      const shipment = normalizeShipmentJoin(row.shipments);
      const closedAt = shipment?.closed_at ?? row.uploaded_at.slice(0, 10);
      return documentReportRow(closedAt, row.file_name, row.storage_path);
    }),
  };
}

async function shipmentInvoicesReport(from: string, to: string): Promise<{ rows: ReportRow[] } | { error: string }> {
  const { rows, error } = await fetchShipmentDocuments("INV");
  if (error) return { error };

  const filtered = rows
    .filter((row) => filterDocumentByDate(row, from, to, "uploaded"))
    .sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));

  return {
    rows: filtered.map((row) => documentReportRow(row.uploaded_at.slice(0, 10), row.file_name, row.storage_path)),
  };
}

async function containerFilesReport(): Promise<{ rows: ReportRow[] } | { error: string }> {
  const invoiceMap = await fetchInvoiceFileNamesByShipmentId();
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
        "رقم الفاتورة": shipmentInvoiceLabel(shipment?.id ? invoiceMap.get(shipment.id) ?? null : null),
        ACID: shipment?.acid ?? "-",
        الحاوية: row.shipment_containers?.container_number ?? "-",
        الملف: row.file_name,
        "حجم الملف (بايت)": row.size_bytes ?? "-",
        "تاريخ الرفع": row.uploaded_at.slice(0, 10),
        "تاريخ الوصول المتوقع": shipment?.eta ?? "-",
        _downloadPath: row.storage_path,
        ...(shipment?.id ? { _shipmentId: shipment.id } : {}),
      };
    }),
  };
}

async function costsReport(from: string, to: string): Promise<{ rows: ReportRow[] } | { error: string }> {
  const invoiceMap = await fetchInvoiceFileNamesByShipmentId();
  const result = await fetchAllFromTable(
    createClient(),
    "shipment_costs",
    `customs_cost,shipping_cost,clearance_cost,local_transport_cost,other_expenses,total_cost,closing_notes,shipments(${shipmentSelect})`
  );
  if (result.error) return { error: result.error };
  const rows = (result.data as unknown as CostJoin[])
    .map((row) => ({ ...row, shipments: normalizeShipmentJoin(row.shipments) }))
    .filter((row) => row.shipments && filterShipmentByDate(row.shipments, from, to, "closed"));
  const enriched = rows
    .map((row) => ({
      row,
      shipment: row.shipments!,
      invoice: invoiceMap.get(row.shipments!.id) ?? null,
    }))
    .sort((a, b) => compareShipmentsByInvoiceNumber(
      { invoice_file_name: a.invoice },
      { invoice_file_name: b.invoice }
    ));

  return {
    rows: enriched.map(({ row, shipment, invoice }) => ({
      "رقم الفاتورة": shipmentInvoiceLabel(invoice),
      ACID: shipment.acid,
      الشركة: shipment.company,
      المورد: shipment.supplier,
      "تاريخ الإغلاق": shipment.closed_at ?? "-",
      جمارك: row.customs_cost,
      شحن: row.shipping_cost,
      تخليص: row.clearance_cost,
      "نقل داخلي": row.local_transport_cost,
      أخرى: row.other_expenses,
      الإجمالي: row.total_cost,
      ملاحظات: row.closing_notes,
      _shipmentId: shipment.id,
    })),
  };
}

export async function fetchCategoryShippedProducts(categoryId: string, categories: ProductCategory[]) {
  const categoryIds = collectDescendantCategoryIds(categories, categoryId);
  const invoiceMap = await fetchInvoiceFileNamesByShipmentId();
  const result = await fetchAllFromTable(
    createClient(),
    "shipment_products",
    `quantity,cartons_count,is_disassembled,is_new_incoming_product,products(sku,name_ar,category_id,category,image_url),shipments(${shipmentSelect})`
  );
  if (result.error) return { error: result.error, rows: [] as ReportRow[] };

  const lines: ProductLine[] = [];
  for (const raw of result.data as unknown as ShipmentProductJoin[]) {
    const product = raw.products;
    if (!product?.category_id || !categoryIds.has(product.category_id)) continue;
    const line = toProductLine({ ...raw, shipments: normalizeShipmentJoin(raw.shipments) }, invoiceMap);
    if (line) lines.push(line);
  }

  return { rows: groupProductLines(lines) };
}
