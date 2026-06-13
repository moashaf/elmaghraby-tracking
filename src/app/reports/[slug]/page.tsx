"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, Download, FileSpreadsheet, Printer, RefreshCw } from "lucide-react";
import { downloadExcelWithOptionalImages } from "@/lib/excel-export";
import { SearchableSelect } from "@/components/searchable-select";
import { ErrorMessage, PageHeader } from "@/components/ui";
import { buildCategorySelectOptions } from "@/lib/category-options";
import { getReport } from "@/lib/report-definitions";
import { signedProductImageUrls } from "@/lib/product-images";
import { buildReport } from "@/lib/reports/build-reports";
import type { ProductKindFilter } from "@/lib/reports/constants";
import { supportsIncomingFilters, supportsProductImages, hasShipmentLinks } from "@/lib/reports/constants";
import { todayIso, type ReportRow } from "@/lib/reports/shipment-helpers";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { fetchAllFromTable } from "@/lib/supabase/fetch-all";
import type { ProductCategory } from "@/lib/types";

const bucket = "container-files";

const KIND_TABS: Array<{ id: ProductKindFilter; label: string }> = [
  { id: "all", label: "الكل" },
  { id: "disassembled", label: "مفكك" },
  { id: "complete", label: "كامل" },
];

export default function ReportDetailPage() {
  const params = useParams<{ slug: string }>();
  const report = getReport(params.slug);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [query, setQuery] = useState("");
  const [productKind, setProductKind] = useState<ProductKindFilter>("all");
  const [categoryId, setCategoryId] = useState("");
  const [withImages, setWithImages] = useState(false);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [imageUrls, setImageUrls] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const showImages = withImages && supportsProductImages(params.slug);
  const showIncomingFilters = supportsIncomingFilters(params.slug);
  const showShipmentLinks = hasShipmentLinks(params.slug);

  const extraColumns = (showImages ? 1 : 0) + (params.slug === "container-files" ? 1 : 0) + (showShipmentLinks ? 1 : 0);

  useEffect(() => {
    if (!showIncomingFilters) return;
    void fetchAllFromTable<ProductCategory>(createClient(), "product_categories", "id,name_ar,code,parent_id,is_active", {
      column: "name_ar",
    }).then((result) => {
      if (!result.error) setCategories(result.data);
    });
  }, [showIncomingFilters]);

  async function load() {
    if (!report) return;
    setError("");
    if (!isSupabaseConfigured()) {
      setLoading(false);
      setError("اضبط ملف .env.local أولا بقيم Supabase.");
      return;
    }

    setLoading(true);
    const result = await buildReport(params.slug, from, to, {
      categoryId: categoryId || undefined,
      productKind: showIncomingFilters ? productKind : undefined,
    });
    setLoading(false);

    if ("error" in result) {
      setError(result.error);
      setRows([]);
      setImageUrls(new Map());
      return;
    }

    setRows(result.rows);

    if (withImages && supportsProductImages(params.slug)) {
      const paths = result.rows.map((row) => row._imagePath).filter((path): path is string => Boolean(path));
      const urls = await signedProductImageUrls(paths);
      setImageUrls(urls);
    } else {
      setImageUrls(new Map());
    }
  }

  useEffect(() => {
    void Promise.resolve().then(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.slug]);

  useEffect(() => {
    if (!showIncomingFilters) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productKind, categoryId]);

  useEffect(() => {
    if (!showImages) {
      setImageUrls(new Map());
      return;
    }
    void (async () => {
      const paths = rows.map((row) => row._imagePath).filter((path): path is string => Boolean(path));
      setImageUrls(await signedProductImageUrls(paths));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withImages, rows, params.slug]);

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      Object.entries(row)
        .filter(([key]) => !key.startsWith("_"))
        .some(([, value]) => String(value ?? "").toLowerCase().includes(term))
    );
  }, [query, rows]);

  const columns = filteredRows[0]
    ? Object.keys(filteredRows[0]).filter((key) => !key.startsWith("_"))
    : [];

  const categoryOptions = useMemo(() => buildCategorySelectOptions(categories), [categories]);

  async function downloadFile(path: string) {
    const result = await createClient().storage.from(bucket).createSignedUrl(path, 120);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    window.open(result.data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function exportExcel() {
    const exportRows = filteredRows.map((row) => {
      const copy: Record<string, string | number | null> = {};
      for (const [key, value] of Object.entries(row)) {
        if (key.startsWith("_")) continue;
        copy[key] = value ?? "";
      }
      return copy;
    });
    const imageUrlList = showImages
      ? filteredRows.map((row) => (row._imagePath ? imageUrls.get(row._imagePath) : null))
      : undefined;

    await downloadExcelWithOptionalImages({
      filename: `${params.slug}-${todayIso()}.xlsx`,
      sheetName: "Report",
      rows: exportRows,
      imageUrls: imageUrlList,
    });
  }

  if (!report) {
    return <ErrorMessage message="التقرير غير موجود." />;
  }

  return (
    <div className="report-print-root space-y-5">
      <div className="report-print-title hidden">
        {report.title} — {report.description}
      </div>

      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 shadow-sm print:hidden">
        <Link className="btn btn-secondary shrink-0" href="/reports">
          <ArrowRight className="h-4 w-4" />
          رجوع للتقارير
        </Link>
        <button className="btn btn-secondary" onClick={load} type="button">
          <RefreshCw className="h-4 w-4" />
          تحديث
        </button>
        <button className="btn btn-secondary" onClick={() => void exportExcel()} type="button">
          <FileSpreadsheet className="h-4 w-4" />
          Excel
        </button>
        <button className="btn" onClick={() => window.print()} type="button">
          <Printer className="h-4 w-4" />
          طباعة PDF
        </button>
        {supportsProductImages(params.slug) ? (
          <label className="ms-auto flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm">
            <input checked={withImages} onChange={(event) => setWithImages(event.target.checked)} type="checkbox" />
            بالصور
          </label>
        ) : null}
      </div>

      <PageHeader title={report.title} description={report.description} />

      <ErrorMessage message={error} />

      <div className="card space-y-3 p-4 print:hidden">
        {report.dateFilter !== "none" ? (
          <p className="text-xs text-[var(--muted)]">
            {report.dateHint ?? (report.dateFilter === "closed" ? "فلترة حسب تاريخ الإغلاق" : "فلترة حسب ETA")}
          </p>
        ) : null}

        {showIncomingFilters ? (
          <div className="flex flex-wrap gap-2">
            {KIND_TABS.map((tab) => (
              <button
                className={`rounded-full px-3 py-1 text-sm font-semibold ${productKind === tab.id ? "bg-[#0f766e] text-white" : "bg-slate-100 text-slate-700"}`}
                key={tab.id}
                onClick={() => setProductKind(tab.id)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : null}

        <div
          className={`grid gap-3 ${
            report.dateFilter !== "none" || showIncomingFilters
              ? "sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_160px_160px_auto]"
              : "sm:grid-cols-[minmax(0,1fr)_auto]"
          }`}
        >
          {showIncomingFilters ? (
            <SearchableSelect
              options={[{ value: "", label: "كل الفئات", keywords: "" }, ...categoryOptions]}
              placeholder="فلتر حسب الفئة..."
              value={categoryId}
              onChange={setCategoryId}
            />
          ) : null}
          {report.dateFilter !== "none" ? (
            <>
              <input className="input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
              <input className="input" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </>
          ) : null}
          <input className="input" placeholder="بحث داخل التقرير" value={query} onChange={(event) => setQuery(event.target.value)} />
          {report.dateFilter !== "none" || showIncomingFilters ? (
            <button className="btn" onClick={load} type="button">
              تطبيق
            </button>
          ) : null}
        </div>
      </div>

      <div className="card overflow-auto print:overflow-visible">
        <table className="min-w-full text-sm">
          <thead className="table-head">
            <tr>
              {showImages ? <th className="p-3 text-right w-16">صورة</th> : null}
              {columns.map((column) => (
                <th className="p-3 text-right" key={column}>
                  {column}
                </th>
              ))}
              {params.slug === "container-files" ? <th className="p-3 text-right">تحميل</th> : null}
              {showShipmentLinks ? <th className="p-3 text-right print:hidden">فتح الشحنة</th> : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="p-4 text-[var(--muted)]" colSpan={Math.max(columns.length, 1) + extraColumns}>
                  جاري التحميل...
                </td>
              </tr>
            ) : filteredRows.length ? (
              filteredRows.map((row, index) => (
                <tr className="border-t border-[var(--border)]" key={index}>
                  {showImages ? (
                    <td className="p-2">
                      {row._imagePath && imageUrls.get(row._imagePath) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt=""
                          className="h-12 w-12 rounded object-cover print:h-10 print:w-10"
                          src={imageUrls.get(row._imagePath)}
                        />
                      ) : (
                        <span className="text-[var(--muted)]">-</span>
                      )}
                    </td>
                  ) : null}
                  {columns.map((column) => (
                    <td className="p-3" key={column}>
                      {row[column] ?? "-"}
                    </td>
                  ))}
                  {params.slug === "container-files" && row._downloadPath ? (
                    <td className="p-3">
                      <button
                        className="btn btn-secondary px-2 py-1 text-xs"
                        onClick={() => downloadFile(String(row._downloadPath))}
                        type="button"
                      >
                        <Download className="h-4 w-4" />
                        Excel
                      </button>
                    </td>
                  ) : params.slug === "container-files" ? (
                    <td className="p-3 text-[var(--muted)]">-</td>
                  ) : null}
                  {showShipmentLinks ? (
                    <td className="p-3 print:hidden">
                      {row._shipmentId ? (
                        <Link className="btn btn-secondary px-2 py-1 text-xs whitespace-nowrap" href={`/shipments/${row._shipmentId}`}>
                          عرض الشحنة
                        </Link>
                      ) : (
                        <span className="text-[var(--muted)]">-</span>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))
            ) : (
              <tr>
                <td className="p-4 text-[var(--muted)]" colSpan={Math.max(columns.length, 1) + extraColumns}>
                  لا توجد بيانات.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
