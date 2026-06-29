"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, Download, FileSpreadsheet, Printer, RefreshCw } from "lucide-react";
import { downloadExcelWithOptionalImages } from "@/lib/excel-export";
import { SearchableSelect } from "@/components/searchable-select";
import { ErrorMessage, PageHeader } from "@/components/ui";
import { useLanguage } from "@/context/language-context";
import { buildCategorySelectOptions } from "@/lib/category-options";
import { findLocalizedReport, getStatusLabel, languageToLocale, localizeReportCell } from "@/lib/i18n";
import { signedProductImageUrls } from "@/lib/product-images";
import { buildReport } from "@/lib/reports/build-reports";
import type { ProductKindFilter } from "@/lib/reports/constants";
import { supportsIncomingFilters, supportsProductImages, hasShipmentLinks, hasDocumentDownload, supportsReportPagination, INCOMING_PRODUCTS_PAGE_SIZE, SHIPMENT_SERIAL_COLUMN } from "@/lib/reports/constants";
import { todayIso, type ReportRow } from "@/lib/reports/shipment-helpers";
import { sumReportColumn, OPEN_SHIPMENT_STATUS_SORT_ORDER, type ShipmentStatusSummary } from "@/lib/shipment-container-count";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { fetchAllFromTable } from "@/lib/supabase/fetch-all";
import type { ProductCategory } from "@/lib/types";

const bucket = "container-files";

function printColumnClass(column: string) {
  if (column === "م") return "report-print-col-serial";
  if (column === "SKU") return "report-print-col-sku";
  if (column === "المنتج") return "report-print-col-product";
  if (column === "التصنيف") return "report-print-col-category";
  if (column === "إجمالي الكرتين" || column === "إجمالي القطع") return "report-print-col-total";
  if (/^\d{2}-\d{2}-\d{4}$/.test(column)) return "report-print-col-eta";
  return "";
}

export default function ReportDetailPage() {
  const params = useParams<{ slug: string }>();
  const { ui, tc, tr, lang } = useLanguage();
  const report = findLocalizedReport(params.slug, lang);
  const kindTabs = useMemo<Array<{ id: ProductKindFilter; label: string }>>(
    () => [
      { id: "all", label: ui("الكل") },
      { id: "disassembled", label: ui("مفكك") },
      { id: "complete", label: ui("كامل") },
    ],
    [ui]
  );
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [statusSummary, setStatusSummary] = useState<ShipmentStatusSummary | null>(null);
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
  const [page, setPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [printSnapshot, setPrintSnapshot] = useState<ReportRow[] | null>(null);
  const [printImageUrls, setPrintImageUrls] = useState<Map<string, string>>(new Map());

  const paginatedReport = supportsReportPagination(params.slug);

  const showImages = withImages && supportsProductImages(params.slug);
  const showIncomingFilters = supportsIncomingFilters(params.slug);
  const showShipmentLinks = hasShipmentLinks(params.slug);
  const showDocumentLinks = params.slug === "customs-releases" || params.slug === "shipment-invoices";
  const showDocumentDownload = hasDocumentDownload(params.slug) && params.slug === "container-files";

  useEffect(() => {
    if (!showIncomingFilters) return;
    void fetchAllFromTable<ProductCategory>(createClient(), "product_categories", "id,name_ar,code,parent_id,is_active", {
      column: "name_ar",
    }).then((result) => {
      if (!result.error) setCategories(result.data);
    });
  }, [showIncomingFilters]);

  async function load(targetPage = page, exportAll = false) {
    if (!report) return;
    setError("");
    if (!isSupabaseConfigured()) {
      setLoading(false);
      setError(ui("اضبط ملف .env.local أولا بقيم Supabase."));
      return;
    }

    setLoading(true);
    const result = await buildReport(params.slug, from, to, {
      categoryId: categoryId || undefined,
      productKind: showIncomingFilters ? productKind : undefined,
      page: paginatedReport && !exportAll ? targetPage : undefined,
      pageSize: paginatedReport && !exportAll ? INCOMING_PRODUCTS_PAGE_SIZE : undefined,
      exportAll: paginatedReport && exportAll,
    });
    setLoading(false);

    if ("error" in result) {
      setError(result.error);
      setRows([]);
      setStatusSummary(null);
      setImageUrls(new Map());
      setTotalRows(0);
      return result;
    }

    if (!exportAll) {
      setRows(result.rows);
      setStatusSummary(result.statusSummary ?? null);
      setTotalRows(result.totalRows ?? result.rows.length);
      if (result.page) setPage(result.page);

      if (withImages && supportsProductImages(params.slug)) {
        const paths = result.rows.map((row) => row._imagePath).filter((path): path is string => Boolean(path));
        const urls = await signedProductImageUrls(paths);
        setImageUrls(urls);
      } else {
        setImageUrls(new Map());
      }
    }

    return result;
  }

  function applyFilters() {
    setPage(1);
    void load(1);
  }

  function goToPage(nextPage: number) {
    setPage(nextPage);
    void load(nextPage);
  }

  useEffect(() => {
    setPage(1);
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.slug]);

  useEffect(() => {
    if (!showIncomingFilters) return;
    setPage(1);
    void load(1);
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
    return rows.filter((row) => {
      if (row._sectionHeader) return true;
      return Object.entries(row)
        .filter(([key]) => !key.startsWith("_"))
        .some(([, value]) => String(value ?? "").toLowerCase().includes(term));
    });
  }, [query, rows]);

  const tableRows = printSnapshot ?? filteredRows;
  const tableImageUrls = printSnapshot ? printImageUrls : imageUrls;
  const tableShowImages = printSnapshot ? printSnapshot.some((row) => row._imagePath) : showImages;

  const dataRows = useMemo(() => tableRows.filter((row) => !row._sectionHeader), [tableRows]);

  const columns = useMemo(() => {
    const sample = dataRows[0] ?? tableRows.find((row) => !row._sectionHeader);
    const keys = sample ? Object.keys(sample).filter((key) => !key.startsWith("_")) : [];
    return showShipmentLinks ? [SHIPMENT_SERIAL_COLUMN, ...keys] : keys;
  }, [dataRows, tableRows, showShipmentLinks]);

  const printableExtraColumns =
    (tableShowImages ? 1 : 0) + (showDocumentDownload ? 1 : 0);

  const shipmentTotals = useMemo(() => {
    if (!hasShipmentLinks(params.slug) || !dataRows.length) return null;
    return {
      cartons: sumReportColumn(dataRows, "عدد الكراتين"),
      containers: sumReportColumn(dataRows, "عدد الحاويات"),
    };
  }, [dataRows, params.slug]);

  const totalPages = Math.max(1, Math.ceil(totalRows / INCOMING_PRODUCTS_PAGE_SIZE));
  const pageStart = totalRows ? (page - 1) * INCOMING_PRODUCTS_PAGE_SIZE + 1 : 0;
  const pageEnd = Math.min(page * INCOMING_PRODUCTS_PAGE_SIZE, totalRows);

  const categoryOptions = useMemo(() => buildCategorySelectOptions(categories), [categories]);

  useEffect(() => {
    const restore = () => {
      setPrintSnapshot(null);
      setPrintImageUrls(new Map());
    };
    window.addEventListener("afterprint", restore);
    return () => window.removeEventListener("afterprint", restore);
  }, []);

  async function handlePrint() {
    let rowsForPrint = dataRows;

    if (paginatedReport) {
      const result = await load(page, true);
      if (result && !("error" in result)) {
        rowsForPrint = result.rows.filter((row) => !row._sectionHeader);
        setPrintSnapshot(result.rows);
      }
    }

    if (supportsProductImages(params.slug)) {
      const paths = rowsForPrint.map((row) => row._imagePath).filter((path): path is string => Boolean(path));
      if (paths.length) {
        const urls = await signedProductImageUrls(paths);
        if (paginatedReport) {
          setPrintImageUrls(urls);
        } else {
          if (!withImages) setWithImages(true);
          setImageUrls(urls);
        }
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
    }

    window.print();
  }

  async function downloadFile(path: string) {
    const result = await createClient().storage.from(bucket).createSignedUrl(path, 120);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    window.open(result.data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function exportExcel() {
    const exportResult = paginatedReport
      ? await load(page, true)
      : null;

    const sourceRows =
      exportResult && !("error" in exportResult)
        ? exportResult.rows.filter((row) => !row._sectionHeader)
        : dataRows;

    const exportRows = sourceRows.map((row, index) => {
      const copy: Record<string, string | number | null> = {};
      if (showShipmentLinks) copy[SHIPMENT_SERIAL_COLUMN] = index + 1;
      for (const [key, value] of Object.entries(row)) {
        if (key.startsWith("_")) continue;
        copy[key] = value ?? "";
      }
      return copy;
    });

    let linkUrls: Array<string | null> | undefined;
    if (showDocumentLinks) {
      linkUrls = await Promise.all(
        dataRows.map(async (row) => {
          const path = row._downloadPath;
          if (!path) return null;
          const result = await createClient().storage.from(bucket).createSignedUrl(String(path), 3600);
          return result.error ? null : result.data.signedUrl;
        })
      );
    }

    if (shipmentTotals && columns.length) {
      const totalRow: Record<string, string | number | null> = {};
      columns.forEach((column) => {
        if (column === SHIPMENT_SERIAL_COLUMN) totalRow[column] = "";
        else if (column === "عدد الكراتين") totalRow[column] = shipmentTotals.cartons;
        else if (column === "عدد الحاويات") totalRow[column] = shipmentTotals.containers;
        else if (column === "رقم الفاتورة") totalRow[column] = ui("الإجمالي");
        else totalRow[column] = "";
      });
      exportRows.push(totalRow);
    }

    if (params.slug === "summary" && statusSummary) {
      const summaryLabelColumn = columns.find((column) => column === "رقم الفاتورة") ?? columns[0] ?? tc("ملخص");
      exportRows.push({});
      exportRows.push({ [summaryLabelColumn]: ui("ملخص حسب الحالة") });
      const summaryRow: Record<string, string | number | null> = { [summaryLabelColumn]: ui("عدد الشحنات") };
      const containerRow: Record<string, string | number | null> = { [summaryLabelColumn]: ui("عدد الحاويات") };
      OPEN_SHIPMENT_STATUS_SORT_ORDER.forEach((status) => {
        const label = getStatusLabel(status, lang);
        summaryRow[label] = statusSummary[status].shipments;
        containerRow[label] = statusSummary[status].containers;
      });
      exportRows.push(summaryRow, containerRow);
    }

    let imageUrlList: Array<string | null | undefined> | undefined;
    if (showImages) {
      const paths = sourceRows.map((row) => row._imagePath).filter((path): path is string => Boolean(path));
      const urlMap =
        paginatedReport && exportResult && !("error" in exportResult)
          ? await signedProductImageUrls(paths)
          : imageUrls;
      imageUrlList = sourceRows.map((row) => (row._imagePath ? urlMap.get(row._imagePath) : null));
    }

    await downloadExcelWithOptionalImages({
      filename: `${params.slug}-${todayIso()}.xlsx`,
      sheetName: report?.title ?? "Report",
      rows: exportRows,
      imageUrls: imageUrlList,
      linkColumn: showDocumentLinks ? "الرابط" : undefined,
      linkUrls,
      linkLabel: ui("فتح الملف"),
    });
  }

  if (!report) {
    return <ErrorMessage message={ui("التقرير غير موجود.")} />;
  }

  return (
    <div className="report-print-root space-y-5">
      <div className="report-print-title hidden">
        {report.title} — {new Date().toLocaleDateString(languageToLocale(lang))}
      </div>

      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 shadow-sm print:hidden">
        <Link className="btn btn-secondary shrink-0" href="/reports">
          <ArrowRight className="h-4 w-4" />
          {ui("رجوع للتقارير")}
        </Link>
        <button className="btn btn-secondary" onClick={() => void load(page)} type="button">
          <RefreshCw className="h-4 w-4" />
          {ui("تحديث")}
        </button>
        <button className="btn btn-secondary" onClick={() => void exportExcel()} type="button">
          <FileSpreadsheet className="h-4 w-4" />
          Excel
        </button>
        <button className="btn" onClick={() => void handlePrint()} type="button">
          <Printer className="h-4 w-4" />
          {ui("طباعة PDF")}
        </button>
        {supportsProductImages(params.slug) ? (
          <label className="ms-auto flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm">
            <input checked={withImages} onChange={(event) => setWithImages(event.target.checked)} type="checkbox" />
            {ui("بالصور")}
          </label>
        ) : null}
      </div>

      <div className="print:hidden">
        <PageHeader title={report.title} description={report.description} />
      </div>

      <div className="print:hidden">
        <ErrorMessage message={error ? ui(error) : ""} />
      </div>

      <div className="card space-y-3 p-4 print:hidden">
        {report.dateFilter !== "none" ? (
          <p className="text-xs text-[var(--muted)]">
            {report.dateHint ??
              (report.dateFilter === "closed"
                ? ui("فلترة حسب تاريخ الإغلاق")
                : report.dateFilter === "uploaded"
                  ? ui("فلترة حسب تاريخ رفع الملف")
                  : ui("فلترة حسب ETA"))}
          </p>
        ) : null}

        {showIncomingFilters ? (
          <div className="flex flex-wrap gap-2">
            {kindTabs.map((tab) => (
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
              options={[{ value: "", label: ui("كل الفئات"), keywords: "" }, ...categoryOptions]}
              placeholder={ui("فلتر حسب الفئة...")}
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
          <input className="input" placeholder={ui("بحث داخل التقرير")} value={query} onChange={(event) => setQuery(event.target.value)} />
          {report.dateFilter !== "none" || showIncomingFilters ? (
            <button className="btn" onClick={applyFilters} type="button">
              {ui("تطبيق")}
            </button>
          ) : null}
        </div>
      </div>

      <div className="card overflow-auto print:overflow-visible report-print-table-wrap">
        <table className="report-print-table table-nowrap min-w-full text-sm">
          <thead className="table-head">
            <tr>
              {tableShowImages ? <th className="report-print-image-col p-3 text-center">{ui("صورة")}</th> : null}
              {columns.map((column) => (
                <th className={`p-3 text-right ${printColumnClass(column)}`} key={column}>
                  {tc(column)}
                </th>
              ))}
              {showDocumentDownload ? <th className="p-3 text-right">{ui("تحميل")}</th> : null}
              {showShipmentLinks ? <th className="p-3 text-right print:hidden">{ui("فتح الشحنة")}</th> : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="p-4 text-[var(--muted)]" colSpan={Math.max(columns.length, 1) + printableExtraColumns + (showShipmentLinks ? 1 : 0)}>
                  {ui("جاري التحميل...")}
                </td>
              </tr>
            ) : tableRows.length ? (
              (() => {
                let shipmentSerial = 0;
                return tableRows.map((row, index) =>
                row._sectionHeader ? (
                  <tr className="report-section-row bg-slate-100 font-bold print:bg-slate-100" key={`section-${index}`}>
                    <td className="p-3" colSpan={Math.max(columns.length, 1) + printableExtraColumns + (showShipmentLinks ? 1 : 0)}>
                      {row._sectionHeader}
                    </td>
                  </tr>
                ) : (
                  (() => {
                    shipmentSerial += 1;
                    const serial = shipmentSerial;
                    return (
                  <tr className="border-t border-[var(--border)]" key={index}>
                    {tableShowImages ? (
                      <td className="report-print-image-col p-2 text-center">
                        {row._imagePath && tableImageUrls.get(row._imagePath) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            alt=""
                            className="report-print-product-img"
                            src={tableImageUrls.get(row._imagePath)}
                          />
                        ) : (
                          <span className="text-[var(--muted)]">-</span>
                        )}
                      </td>
                    ) : null}
                    {columns.map((column) => (
                      <td className={`p-3 ${printColumnClass(column)}`} key={column}>
                        {column === SHIPMENT_SERIAL_COLUMN ? (
                          serial
                        ) : column === "الرابط" && row._downloadPath ? (
                          <button
                            className="text-[#0f766e] underline hover:opacity-80 print:text-inherit print:no-underline"
                            onClick={() => downloadFile(String(row._downloadPath))}
                            type="button"
                          >
                            {ui("فتح الملف")}
                          </button>
                        ) : (
                          localizeReportCell(column, row[column], lang, row)
                        )}
                      </td>
                    ))}
                    {showDocumentDownload && row._downloadPath ? (
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
                    ) : showDocumentDownload ? (
                      <td className="p-3 text-[var(--muted)]">-</td>
                    ) : null}
                    {showShipmentLinks ? (
                      <td className="p-3 print:hidden">
                        {row._shipmentId ? (
                          <Link className="btn btn-secondary px-2 py-1 text-xs whitespace-nowrap" href={`/shipments/${row._shipmentId}`}>
                            {ui("عرض الشحنة")}
                          </Link>
                        ) : (
                          <span className="text-[var(--muted)]">-</span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                    );
                  })()
                )
              );
              })()
            ) : (
              <tr>
                <td className="p-4 text-[var(--muted)]" colSpan={Math.max(columns.length, 1) + printableExtraColumns + (showShipmentLinks ? 1 : 0)}>
                  {ui("لا توجد بيانات.")}
                </td>
              </tr>
            )}
          </tbody>
          {shipmentTotals ? (
            <tfoot className="table-head font-bold">
              <tr>
                {tableShowImages ? <td className="p-3" /> : null}
                {columns.map((column) => {
                  if (column === SHIPMENT_SERIAL_COLUMN) {
                    return <td className="p-3" key={column} />;
                  }
                  if (column === "عدد الكراتين") {
                    return (
                      <td className="p-3" key={column}>
                        {shipmentTotals.cartons.toLocaleString(languageToLocale(lang))}
                      </td>
                    );
                  }
                  if (column === "عدد الحاويات") {
                    return (
                      <td className="p-3" key={column}>
                        {shipmentTotals.containers.toLocaleString(languageToLocale(lang))}
                      </td>
                    );
                  }
                  return (
                    <td className="p-3" key={column}>
                      {column === "رقم الفاتورة" ? ui("الإجمالي") : ""}
                    </td>
                  );
                })}
                {showDocumentDownload ? <td className="p-3" /> : null}
                {showShipmentLinks ? <td className="p-3 print:hidden" /> : null}
              </tr>
            </tfoot>
          ) : null}
        </table>

        {paginatedReport && totalRows > 0 && !printSnapshot ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] p-3 print:hidden">
            <p className="text-sm text-[var(--muted)]">
              {tr(
                `عرض ${pageStart.toLocaleString(languageToLocale(lang))}–${pageEnd.toLocaleString(languageToLocale(lang))} من ${totalRows.toLocaleString(languageToLocale(lang))} صنف`,
                `Showing ${pageStart}–${pageEnd} of ${totalRows} products`
              )}
            </p>
            <div className="flex items-center gap-2">
              <button
                className="btn btn-secondary px-3 py-1 text-sm"
                disabled={page <= 1 || loading}
                onClick={() => goToPage(page - 1)}
                type="button"
              >
                {ui("السابق")}
              </button>
              <span className="text-sm font-semibold">
                {tr(`صفحة ${page} من ${totalPages}`, `Page ${page} of ${totalPages}`)}
              </span>
              <button
                className="btn btn-secondary px-3 py-1 text-sm"
                disabled={page >= totalPages || loading}
                onClick={() => goToPage(page + 1)}
                type="button"
              >
                {ui("التالي")}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {params.slug === "summary" && statusSummary ? (
        <div className="report-status-summary report-print-section card overflow-auto print-avoid">
          <h3 className="border-b border-[var(--border)] p-3 text-base font-bold">{ui("ملخص حسب الحالة")}</h3>
          <table className="report-print-table table-nowrap min-w-full text-sm">
            <thead className="table-head">
              <tr>
                <th className="p-3 text-right w-40" />
                {OPEN_SHIPMENT_STATUS_SORT_ORDER.map((status) => (
                  <th className="p-3 text-right" key={status}>
                    {getStatusLabel(status, lang)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-[var(--border)]">
                <td className="p-3 font-semibold">{ui("عدد الشحنات")}</td>
                {OPEN_SHIPMENT_STATUS_SORT_ORDER.map((status) => (
                  <td className="p-3 text-center text-xl font-bold" key={status}>
                    {statusSummary[status].shipments}
                  </td>
                ))}
              </tr>
              <tr className="border-t border-[var(--border)]">
                <td className="p-3 font-semibold">{ui("عدد الحاويات")}</td>
                {OPEN_SHIPMENT_STATUS_SORT_ORDER.map((status) => (
                  <td className="p-3 text-center text-xl font-bold text-[#0f766e]" key={status}>
                    {statusSummary[status].containers}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
