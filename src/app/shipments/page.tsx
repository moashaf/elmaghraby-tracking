"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, FileSpreadsheet, Pencil, Plus, Printer, RefreshCw, Trash2 } from "lucide-react";
import { ActionsMenu } from "@/components/actions-menu";
import { EmptyState, ErrorMessage, FilterBar, FilterChip, PageHeader, Skeleton } from "@/components/ui";
import {
  getNextStatusAction,
  type ShipmentStatus,
} from "@/lib/constants";
import { getNextActionLabel, getStatusLabel, languageToLocale } from "@/lib/i18n";
import { downloadExcelWithOptionalImages } from "@/lib/excel-export";
import { SHIPMENT_TABLE_CLASS } from "@/lib/reports/constants";
import { useLanguage } from "@/context/language-context";
import { useProfile } from "@/context/profile-context";
import { formatUsd, formatDisplayDate } from "@/lib/format";
import { readEmbeddedContainerCount } from "@/lib/shipment-container-count";
import { displayInvoiceNumber, invoiceMapFromDocuments, shipmentInvoiceLabel } from "@/lib/shipment-invoice-number";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { getSupabaseErrorMessage } from "@/lib/supabase/errors";
import { useSupabaseRealtimeReload } from "@/lib/supabase/use-realtime-reload";
import { DEFAULT_SYSTEM_SETTINGS, isShipmentDelayed } from "@/lib/system-settings";
import type { Shipment } from "@/lib/types";

export default function ShipmentsPage() {
  const router = useRouter();
  const { canWrite, isAdmin } = useProfile();
  const { tr, lang, ui } = useLanguage();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [status, setStatus] = useState<ShipmentStatus | "">(() => {
    if (typeof window === "undefined") return "";
    const value = new URLSearchParams(window.location.search).get("status");
    return value === "in_sea" || value === "customs" ? value : "";
  });
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [invoiceByShipmentId, setInvoiceByShipmentId] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState("");

  async function load(options?: { silent?: boolean }) {
    setError("");
    if (!isSupabaseConfigured()) {
      setLoading(false);
      setError(ui("اضبط ملف .env.local أولا بقيم Supabase."));
      return;
    }

    if (!options?.silent) setLoading(true);
    try {
      const supabase = createClient();
      const [result, documentsResult] = await Promise.all([
        supabase
          .from("shipments")
          .select("*,companies(name_ar),suppliers(name_ar),shipment_containers(count)")
          .neq("status", "closed")
          .order("created_at", { ascending: false }),
        supabase
          .from("shipment_documents")
          .select("shipment_id,doc_type,file_name,uploaded_at")
          .eq("doc_type", "INV")
          .order("uploaded_at", { ascending: false }),
      ]);

      if (result.error) {
        setError(getSupabaseErrorMessage(result.error));
        return;
      }
      if (documentsResult.error) {
        setError(getSupabaseErrorMessage(documentsResult.error));
        return;
      }

      setShipments((result.data as Shipment[] | null) ?? []);
      setInvoiceByShipmentId(
        invoiceMapFromDocuments(
          (documentsResult.data as Array<{ shipment_id: string; doc_type: string; file_name: string }> | null) ?? []
        )
      );
    } catch (loadError) {
      setError(getSupabaseErrorMessage(loadError));
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }

  const reloadSilently = useCallback(() => load({ silent: true }), [ui]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useSupabaseRealtimeReload(reloadSilently, [{ table: "shipments" }, { table: "shipment_documents" }]);

  const filteredShipments = useMemo(() => {
    const term = query.trim().toLowerCase();
    return shipments.filter((shipment) => {
      if (status && shipment.status !== status) return false;
      if (!term) return true;
      const invoice = invoiceByShipmentId.get(shipment.id);
      const invoiceLabel = invoice ? displayInvoiceNumber(invoice).toLowerCase() : "";
      return (
        shipment.acid.toLowerCase().includes(term) ||
        shipment.shipment_number.toLowerCase().includes(term) ||
        invoiceLabel.includes(term)
      );
    });
  }, [shipments, query, invoiceByShipmentId, status]);

  const openStatusFilters = ["in_sea", "customs"] as const;

  const counts = useMemo(
    () =>
      openStatusFilters.map((item) => ({
        status: item,
        count: shipments.filter((shipment) => shipment.status === item).length,
      })),
    [shipments]
  );

  const listTotals = useMemo(
    () => ({
      cartons: filteredShipments.reduce((sum, shipment) => sum + Number(shipment.total_cartons ?? 0), 0),
      containers: filteredShipments.reduce(
        (sum, shipment) => sum + readEmbeddedContainerCount((shipment as Shipment & { shipment_containers?: unknown }).shipment_containers),
        0
      ),
    }),
    [filteredShipments]
  );

  const statusLabel = (status: ShipmentStatus) => getStatusLabel(status, lang);

  async function transition(shipment: Shipment) {
    const action = getNextStatusAction(shipment.status);
    if (!action) return;
    if (action !== "to_customs") {
      router.push(`/shipments/${shipment.id}`);
      return;
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    if (shipment.eta && todayIso < shipment.eta) {
      setError(ui("لا يمكن تحويل الشحنة إلى «في الجمرك» قبل تاريخ الوصول المتوقع (ETA)."));
      return;
    }

    setActionLoading(shipment.id);
    const result = await createClient().rpc("transition_shipment_status", {
      shipment_id: shipment.id,
      target_status: "customs",
    });
    setActionLoading(null);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    await load();
  }

  async function removeShipment(shipment: Shipment) {
    if (!window.confirm(`حذف الشحنة ${shipmentInvoiceLabel(invoiceByShipmentId.get(shipment.id))} نهائيا؟`)) return;

    setDeleteLoading(shipment.id);
    const result = await createClient().rpc("delete_shipment", { p_shipment_id: shipment.id });
    setDeleteLoading(null);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    await load();
  }

  async function exportExcel() {
    const rows = filteredShipments.map((shipment) => {
      const invoiceFile = invoiceByShipmentId.get(shipment.id);
      return {
        [tr("رقم الفاتورة", "Shipment no.")]: invoiceFile ? displayInvoiceNumber(invoiceFile) : "-",
        ACID: shipment.acid,
      [tr("الشركة", "Company")]: shipment.companies?.name_ar ?? "-",
      [tr("عدد الكراتين", "Cartons")]: shipment.total_cartons ?? "",
      [tr("عدد الحاويات", "Containers")]: readEmbeddedContainerCount(
        (shipment as Shipment & { shipment_containers?: unknown }).shipment_containers
      ),
      [tr("موقع المركب", "Vessel location")]:
        shipment.vessel_name?.trim() && shipment.vessel_location_text?.trim()
          ? shipment.vessel_location_text
          : "-",
      [tr("القيمة ($)", "Value (USD)")]: shipment.value_usd ?? "",
      [tr("تاريخ الشحن", "Shipped")]: formatDisplayDate(shipment.shipped_at, lang),
      [tr("تاريخ الوصول المتوقع", "ETA")]: formatDisplayDate(shipment.eta, lang),
      [tr("الحالة", "Status")]: statusLabel(shipment.status),
      [tr("نوع البضاعة", "Cargo type")]: shipment.shipment_type || "-",
      };
    });

    rows.push({
      [tr("رقم الفاتورة", "Shipment no.")]: tr("الإجمالي", "Total"),
      ACID: "",
      [tr("الشركة", "Company")]: "",
      [tr("عدد الكراتين", "Cartons")]: listTotals.cartons,
      [tr("عدد الحاويات", "Containers")]: listTotals.containers,
      [tr("موقع المركب", "Vessel location")]: "",
      [tr("القيمة ($)", "Value (USD)")]: "",
      [tr("تاريخ الشحن", "Shipped")]: "",
      [tr("تاريخ الوصول المتوقع", "ETA")]: "",
      [tr("الحالة", "Status")]: "",
      [tr("نوع البضاعة", "Cargo type")]: "",
    });

    await downloadExcelWithOptionalImages({
      filename: `shipments-${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheetName: tr("الشحنات", "Shipments"),
      rows,
    });
  }

  return (
    <div className="shipments-print-root space-y-5">
      <div className="shipments-print-title hidden">
        {tr("الشحنات", "Shipments", "货运")} — {new Date().toLocaleDateString(languageToLocale(lang))}
      </div>
      <div className="print:hidden">
        <PageHeader
          title={tr("الشحنات", "Shipments", "货运")}
          description={tr(
            "الشحنات المفتوحة فقط — المغلقة تظهر في تقرير الشحنات المغلقة.",
            "Open shipments only — closed ones live in the closed shipments report.",
            "仅显示未关闭货运 — 已关闭的在关闭货运报表中。"
          )}
          actions={
            <>
              <button className="btn btn-secondary" onClick={() => void exportExcel()} type="button">
                <FileSpreadsheet className="h-4 w-4" />
                {tr("تصدير Excel", "Export Excel", "导出 Excel")}
              </button>
              <button className="btn btn-secondary" onClick={() => window.print()} type="button">
                <Printer className="h-4 w-4" />
                {tr("طباعة", "Print", "打印")}
              </button>
              {canWrite ? (
                <Link className="btn" href="/shipments/new">
                  <Plus className="h-4 w-4" />
                  {tr("شحنة جديدة", "New shipment", "新建货运")}
                </Link>
              ) : null}
            </>
          }
        />
      </div>

      <div className="print:hidden">
        <ErrorMessage message={error} />
      </div>

      <FilterBar className="print:hidden">
        <input
          className="input min-w-0 flex-1"
          placeholder={ui("بحث برقم الفاتورة أو ACID")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <FilterChip active={!status} count={shipments.length} onClick={() => setStatus("")}>
            {ui("كل الحالات")}
          </FilterChip>
          {counts.map((item) => (
            <FilterChip
              active={status === item.status}
              count={item.count}
              key={item.status}
              onClick={() => setStatus(status === item.status ? "" : item.status)}
            >
              {statusLabel(item.status)}
            </FilterChip>
          ))}
        </div>
        <button className="btn btn-secondary" onClick={() => void load()} type="button">
          <RefreshCw className="h-4 w-4" />
          {ui("تحديث")}
        </button>
      </FilterBar>

      <div className="space-y-3 md:hidden print:hidden">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => <Skeleton className="h-28 w-full" key={index} />)
        ) : filteredShipments.length ? (
          filteredShipments.map((shipment) => {
            const invoiceFile = invoiceByShipmentId.get(shipment.id);
            const delayed = isShipmentDelayed(
              shipment.eta,
              shipment.status,
              DEFAULT_SYSTEM_SETTINGS,
              undefined,
              shipment.shipped_at,
              shipment.shipping_duration_days
            );
            return (
              <Link
                className={`card block p-4 ${delayed ? "row-delayed" : ""}`}
                href={`/shipments/${shipment.id}`}
                key={shipment.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-bold">
                      {invoiceFile ? displayInvoiceNumber(invoiceFile) : shipment.shipment_number}
                    </div>
                    <div className="mt-1 text-sm text-[var(--muted)]">{shipment.companies?.name_ar ?? "-"}</div>
                  </div>
                  <span className={`status-badge status-${shipment.status}`}>{statusLabel(shipment.status)}</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm text-[var(--muted)]">
                  <span>ETA {formatDisplayDate(shipment.eta, lang)}</span>
                  <span className="font-semibold text-[var(--foreground)]">{formatUsd(shipment.value_usd)}</span>
                </div>
              </Link>
            );
          })
        ) : (
          <EmptyState title={ui("لا توجد شحنات مطابقة.")} description={ui("غيّر الفلتر أو أضف شحنة جديدة.")} />
        )}
      </div>

      <div className="card hidden overflow-hidden report-print-table-wrap md:block">
        <div className="overflow-auto">
          <table className={`report-print-table ${SHIPMENT_TABLE_CLASS}`}>
            <thead className="table-head">
              <tr>
                <th className="table-actions-first text-right print:hidden">{ui("إجراءات")}</th>
                <th className="col-invoice text-right">{ui("رقم الفاتورة")}</th>
                <th className="col-cargo-type text-right">{ui("نوع البضاعة")}</th>
                <th className="text-right">{ui("عدد الكراتين")}</th>
                <th className="text-right">{ui("عدد الحاويات")}</th>
                <th className="text-right">{ui("موقع المركب")}</th>
                <th className="col-amount text-right">{ui("قيمة الشحنة (USD)")}</th>
                <th className="text-right">{ui("تاريخ الشحن")}</th>
                <th className="text-right">{ui("تاريخ الوصول المتوقع")}</th>
                <th className="col-acid text-right">ACID</th>
                <th className="text-right">{ui("الحالة")}</th>
                <th className="text-right">{ui("الشركة")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="p-4 text-[var(--muted)]" colSpan={12}>
                    <Skeleton className="h-8 w-full" />
                  </td>
                </tr>
              ) : filteredShipments.length ? (
                filteredShipments.map((shipment) => {
                  const action = getNextStatusAction(shipment.status);
                  const invoiceFile = invoiceByShipmentId.get(shipment.id);
                  const delayed = isShipmentDelayed(
                    shipment.eta,
                    shipment.status,
                    DEFAULT_SYSTEM_SETTINGS,
                    undefined,
                    shipment.shipped_at,
                    shipment.shipping_duration_days
                  );
                  return (
                    <tr
                      className={`row-hover border-t border-[var(--border)] ${delayed ? "row-delayed" : ""}`}
                      key={shipment.id}
                    >
                      <td className="table-actions-first print:hidden">
                        <ActionsMenu label={ui("إجراءات")}>
                          <Link
                            className="btn btn-ghost btn-sm w-full justify-start"
                            href={`/shipments/${shipment.id}`}
                          >
                            <Eye className="h-4 w-4" />
                            {ui("عرض")}
                          </Link>
                          <Link
                            className="btn btn-ghost btn-sm w-full justify-start"
                            href={`/shipments/${shipment.id}/report`}
                          >
                            <Eye className="h-4 w-4" />
                            {ui("تقرير / PDF")}
                          </Link>
                          {isAdmin ? (
                            <>
                              <Link
                                className="btn btn-ghost btn-sm w-full justify-start"
                                href={`/shipments/${shipment.id}?edit=1`}
                              >
                                <Pencil className="h-4 w-4" />
                                {ui("تعديل")}
                              </Link>
                              <button
                                className="btn btn-ghost btn-sm w-full justify-start text-red-700"
                                disabled={deleteLoading === shipment.id}
                                onClick={() => removeShipment(shipment)}
                                type="button"
                              >
                                <Trash2 className="h-4 w-4" />
                                {ui("حذف")}
                              </button>
                            </>
                          ) : null}
                          {action && canWrite ? (
                            <button
                              className="btn btn-sm mt-1 w-full"
                              disabled={actionLoading === shipment.id}
                              onClick={() => transition(shipment)}
                              type="button"
                            >
                              {actionLoading === shipment.id ? "..." : getNextActionLabel(action, lang)}
                            </button>
                          ) : null}
                        </ActionsMenu>
                      </td>
                      <td className="col-invoice font-semibold">
                        {invoiceFile ? displayInvoiceNumber(invoiceFile) : "-"}
                      </td>
                      <td className="col-cargo-type" title={shipment.shipment_type || undefined}>
                        {shipment.shipment_type || "-"}
                      </td>
                      <td>{shipment.total_cartons ?? "-"}</td>
                      <td>
                        {readEmbeddedContainerCount(
                          (shipment as Shipment & { shipment_containers?: unknown }).shipment_containers
                        )}
                      </td>
                      <td className="text-[var(--muted)]" title={shipment.vessel_location_text ?? undefined}>
                        {shipment.vessel_name?.trim() && shipment.vessel_location_text?.trim()
                          ? shipment.vessel_location_text
                          : "-"}
                      </td>
                      <td className="col-amount font-semibold">{formatUsd(shipment.value_usd)}</td>
                      <td>{formatDisplayDate(shipment.shipped_at, lang)}</td>
                      <td>{formatDisplayDate(shipment.eta, lang)}</td>
                      <td className="col-acid font-semibold" title={shipment.acid}>
                        {shipment.acid}
                      </td>
                      <td>
                        <span className={`status-badge status-${shipment.status}`}>{statusLabel(shipment.status)}</span>
                      </td>
                      <td>{shipment.companies?.name_ar ?? "-"}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="p-4 text-[var(--muted)]" colSpan={12}>
                    {ui("لا توجد شحنات مطابقة.")}
                  </td>
                </tr>
              )}
            </tbody>
            {!loading && filteredShipments.length ? (
              <tfoot className="table-head font-bold">
                <tr>
                  <td className="print:hidden" />
                  <td>{ui("الإجمالي")}</td>
                  <td />
                  <td>{listTotals.cartons.toLocaleString(languageToLocale(lang))}</td>
                  <td>{listTotals.containers.toLocaleString(languageToLocale(lang))}</td>
                  <td />
                  <td colSpan={6} />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>
    </div>
  );
}
