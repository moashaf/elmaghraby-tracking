"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, Download, FileSpreadsheet, Printer, RefreshCw } from "lucide-react";
import * as XLSX from "xlsx";
import { ErrorMessage, PageHeader } from "@/components/ui";
import { SHIPMENT_STATUS_LABELS, type ShipmentStatus } from "@/lib/constants";
import { getReport } from "@/lib/report-definitions";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

type ReportRow = Record<string, string | number | null> & { _downloadPath?: string };

const bucket = "container-files";

type ShipmentReportRow = {
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
};

type ShipmentProductJoin = {
  quantity: number;
  cartons_count: number | null;
  is_new_incoming_product: boolean;
  products: { sku: string; name_ar: string } | null;
  shipments: ShipmentReportRow | null;
};

type ContainerJoin = {
  container_number: string;
  weight_kg: number | null;
  cartons_count: number | null;
  shipments: ShipmentReportRow | null;
};

type ContainerFileJoin = {
  file_name: string;
  storage_path: string;
  size_bytes: number | null;
  uploaded_at: string;
  shipment_containers: {
    container_number: string;
    shipments: ShipmentReportRow | null;
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
  shipments: ShipmentReportRow | null;
};

const shipmentSelect = "shipment_number,acid,shipping_port,arrival_port,shipped_at,eta,status,closed_at,companies(name_ar),suppliers(name_ar)";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function inRange(date: string | null | undefined, from: string, to: string) {
  if (!from && !to) return true;
  if (!date) return false;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function filterShipmentByDate(row: ShipmentReportRow, from: string, to: string, mode: "eta" | "closed" | "none") {
  if (mode === "none") return true;
  if (mode === "closed") return inRange(row.closed_at, from, to);
  return inRange(row.eta, from, to);
}

function normalizeShipment(row: Record<string, unknown>): ShipmentReportRow {
  const company = row.companies as { name_ar?: string } | null;
  const supplier = row.suppliers as { name_ar?: string } | null;
  return {
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
  };
}

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
  };
}

export default function ReportDetailPage() {
  const params = useParams<{ slug: string }>();
  const report = getReport(params.slug);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    if (!report) return;
    setError("");
    if (!isSupabaseConfigured()) {
      setLoading(false);
      setError("اضبط ملف .env.local أولا بقيم Supabase.");
      return;
    }

    setLoading(true);
    const result = await buildReport(params.slug, from, to);
    setLoading(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }

    setRows(result.rows);
  }

  useEffect(() => {
    void Promise.resolve().then(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.slug]);

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(term))
    );
  }, [query, rows]);

  const columns = filteredRows[0]
    ? Object.keys(filteredRows[0]).filter((key) => !key.startsWith("_"))
    : [];

  async function downloadFile(path: string) {
    const result = await createClient().storage.from(bucket).createSignedUrl(path, 120);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    window.open(result.data.signedUrl, "_blank", "noopener,noreferrer");
  }

  function exportExcel() {
    const exportRows = filteredRows.map((row) => {
      const copy = { ...row };
      delete copy._downloadPath;
      return copy;
    });
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
    XLSX.writeFile(workbook, `${params.slug}-${todayIso()}.xlsx`);
  }

  if (!report) {
    return <ErrorMessage message="التقرير غير موجود." />;
  }

  return (
    <div className="report-print-root space-y-5">
      <div className="report-print-title hidden">
        {report.title} — {report.description}
      </div>
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 print:hidden">
        <Link className="btn btn-secondary" href="/reports">
          <ArrowRight className="h-4 w-4" />
          رجوع للتقارير
        </Link>
        <button className="btn btn-secondary" onClick={load} type="button">
          <RefreshCw className="h-4 w-4" />
          تحديث
        </button>
        <button className="btn btn-secondary" onClick={exportExcel} type="button">
          <FileSpreadsheet className="h-4 w-4" />
          Excel
        </button>
        <button className="btn" onClick={() => window.print()} type="button">
          <Printer className="h-4 w-4" />
          طباعة PDF
        </button>
      </div>

      <PageHeader title={report.title} description={report.description} />

      <ErrorMessage message={error} />

      <div className="card space-y-3 p-4 print:hidden">
        {report.dateFilter !== "none" ? (
          <p className="text-xs text-[var(--muted)]">
            {report.dateHint ?? (report.dateFilter === "closed" ? "فلترة حسب تاريخ الإغلاق" : "فلترة حسب ETA")}
          </p>
        ) : null}
        <div className={`grid gap-3 ${report.dateFilter !== "none" ? "sm:grid-cols-2 lg:grid-cols-[160px_160px_minmax(0,1fr)_auto]" : "sm:grid-cols-[minmax(0,1fr)_auto]"}`}>
          {report.dateFilter !== "none" ? (
            <>
              <input className="input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
              <input className="input" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </>
          ) : null}
          <input className="input" placeholder="بحث داخل التقرير" value={query} onChange={(event) => setQuery(event.target.value)} />
          {report.dateFilter !== "none" ? (
            <button className="btn" onClick={load} type="button">تطبيق</button>
          ) : null}
        </div>
      </div>

      <div className="card overflow-auto print:overflow-visible">
        <table className="min-w-full text-sm">
          <thead className="table-head">
            <tr>
              {columns.map((column) => (
                <th className="p-3 text-right" key={column}>{column}</th>
              ))}
              {params.slug === "container-files" ? <th className="p-3 text-right">تحميل</th> : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-4 text-[var(--muted)]" colSpan={Math.max(columns.length, 1) + (params.slug === "container-files" ? 1 : 0)}>جاري التحميل...</td></tr>
            ) : filteredRows.length ? filteredRows.map((row, index) => (
              <tr className="border-t border-[var(--border)]" key={index}>
                {columns.map((column) => (
                  <td className="p-3" key={column}>{row[column] ?? "-"}</td>
                ))}
                {params.slug === "container-files" && row._downloadPath ? (
                  <td className="p-3">
                    <button className="btn btn-secondary px-2 py-1 text-xs" onClick={() => downloadFile(String(row._downloadPath))} type="button">
                      <Download className="h-4 w-4" />
                      Excel
                    </button>
                  </td>
                ) : params.slug === "container-files" ? (
                  <td className="p-3 text-[var(--muted)]">-</td>
                ) : null}
              </tr>
            )) : (
              <tr><td className="p-4 text-[var(--muted)]" colSpan={Math.max(columns.length, 1) + (params.slug === "container-files" ? 1 : 0)}>لا توجد بيانات.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function buildReport(slug: string, from: string, to: string): Promise<{ rows: ReportRow[] } | { error: string }> {
  const supabase = createClient();

  if (["containers", "container-files", "incoming-products", "new-products", "duplicate-products", "date-range-products", "product-history", "costs"].includes(slug)) {
    if (slug === "containers") return containersReport(from, to);
    if (slug === "container-files") return containerFilesReport();
    if (slug === "costs") return costsReport(from, to);
    return productsReport(slug, from, to);
  }

  const result = await supabase.from("shipments").select(shipmentSelect).order("created_at", { ascending: false });
  if (result.error) return { error: result.error.message };

  const shipments = ((result.data ?? []) as Array<Record<string, unknown>>).map(normalizeShipment);
  const today = todayIso();
  const next30 = new Date();
  next30.setDate(next30.getDate() + 30);
  const next30Iso = next30.toISOString().slice(0, 10);

  let filtered = shipments.filter((row) => filterShipmentByDate(row, from, to, slug === "closed" ? "closed" : "eta"));
  if (slug === "in-sea") filtered = filtered.filter((row) => row.status === "in_sea");
  if (slug === "customs" || slug === "ready-to-close") filtered = filtered.filter((row) => row.status === "customs");
  if (slug === "closed") filtered = filtered.filter((row) => row.status === "closed");
  if (slug === "delayed") filtered = filtered.filter((row) => row.status !== "closed" && row.eta < today);
  if (slug === "arriving-30") filtered = filtered.filter((row) => row.status !== "closed" && row.eta >= today && row.eta <= next30Iso);

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

async function productsReport(slug: string, from: string, to: string): Promise<{ rows: ReportRow[] } | { error: string }> {
  const result = await createClient()
    .from("shipment_products")
    .select(`quantity,cartons_count,is_new_incoming_product,products(sku,name_ar),shipments(${shipmentSelect})`);

  if (result.error) return { error: result.error.message };

  let rows = ((result.data ?? []) as unknown as ShipmentProductJoin[])
    .filter((row) => row.shipments && filterShipmentByDate(row.shipments, from, to, "eta"));

  if (slug === "new-products") rows = rows.filter((row) => row.is_new_incoming_product);

  if (slug === "duplicate-products") {
    const openCounts = new Map<string, number>();
    rows.forEach((row) => {
      if (row.shipments?.status !== "closed" && row.products?.sku) {
        openCounts.set(row.products.sku, (openCounts.get(row.products.sku) ?? 0) + 1);
      }
    });
    rows = rows.filter((row) => row.products?.sku && (openCounts.get(row.products.sku) ?? 0) > 1);
  }

  if (slug === "product-history") {
    const grouped = new Map<string, { name: string; quantity: number; shipments: number; lastSeen: string }>();
    rows.forEach((row) => {
      if (!row.products || !row.shipments) return;
      const current = grouped.get(row.products.sku) ?? { name: row.products.name_ar, quantity: 0, shipments: 0, lastSeen: "" };
      current.quantity += Number(row.quantity ?? 0);
      current.shipments += 1;
      current.lastSeen = current.lastSeen > row.shipments.eta ? current.lastSeen : row.shipments.eta;
      grouped.set(row.products.sku, current);
    });
    return {
      rows: Array.from(grouped.entries()).map(([sku, value]) => ({
        SKU: sku,
        المنتج: value.name,
        "إجمالي الكمية": value.quantity,
        "مرات الاستيراد": value.shipments,
        "آخر ETA": value.lastSeen,
      })),
    };
  }

  return {
    rows: rows.map((row) => ({
      SKU: row.products?.sku ?? "-",
      المنتج: row.products?.name_ar ?? "-",
      الكمية: row.quantity,
      الكرتين: row.cartons_count,
      "منتج جديد": row.is_new_incoming_product ? "نعم" : "لا",
      "رقم الشحنة": row.shipments?.shipment_number ?? "-",
      المورد: row.shipments?.supplier ?? "-",
      ETA: row.shipments?.eta ?? "-",
      الحالة: row.shipments ? SHIPMENT_STATUS_LABELS[row.shipments.status] : "-",
    })),
  };
}

async function containersReport(from: string, to: string): Promise<{ rows: ReportRow[] } | { error: string }> {
  const result = await createClient()
    .from("shipment_containers")
    .select(`container_number,weight_kg,cartons_count,shipments(${shipmentSelect})`);
  if (result.error) return { error: result.error.message };
  const rows = ((result.data ?? []) as unknown as ContainerJoin[]).filter((row) => row.shipments && filterShipmentByDate(row.shipments, from, to, "eta"));
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
  const result = await createClient()
    .from("container_files")
    .select(`file_name,storage_path,size_bytes,uploaded_at,shipment_containers(container_number,shipments(${shipmentSelect}))`)
    .order("uploaded_at", { ascending: false });
  if (result.error) return { error: result.error.message };
  const rows = ((result.data ?? []) as unknown as ContainerFileJoin[]);
  return {
    rows: rows.map((row) => ({
      "رقم الشحنة": row.shipment_containers?.shipments?.shipment_number ?? "-",
      ACID: row.shipment_containers?.shipments?.acid ?? "-",
      الحاوية: row.shipment_containers?.container_number ?? "-",
      الملف: row.file_name,
      "تاريخ الرفع": row.uploaded_at.slice(0, 10),
      ETA: row.shipment_containers?.shipments?.eta ?? "-",
      _downloadPath: row.storage_path,
    })),
  };
}

async function costsReport(from: string, to: string): Promise<{ rows: ReportRow[] } | { error: string }> {
  const result = await createClient()
    .from("shipment_costs")
    .select(`customs_cost,shipping_cost,clearance_cost,local_transport_cost,other_expenses,total_cost,closing_notes,shipments(${shipmentSelect})`);
  if (result.error) return { error: result.error.message };
  const rows = ((result.data ?? []) as unknown as CostJoin[]).filter((row) => row.shipments && filterShipmentByDate(row.shipments, from, to, "closed"));
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
