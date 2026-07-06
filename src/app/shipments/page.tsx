"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, FileSpreadsheet, Pencil, Plus, Printer, RefreshCw, Trash2 } from "lucide-react";
import { ErrorMessage, PageHeader } from "@/components/ui";
import {
  getNextStatusAction,
  SHIPMENT_STATUSES,
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
import type { Shipment } from "@/lib/types";

export default function ShipmentsPage() {
  const router = useRouter();
  const { canWrite, isAdmin } = useProfile();
  const { tr, lang, ui } = useLanguage();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [status, setStatus] = useState<ShipmentStatus | "">(() => {
    if (typeof window === "undefined") return "";
    const value = new URLSearchParams(window.location.search).get("status");
    return SHIPMENT_STATUSES.includes(value as ShipmentStatus) ? (value as ShipmentStatus) : "";
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
      await supabase.rpc("auto_move_shipments_to_customs");
      let request = supabase
        .from("shipments")
        .select("*,companies(name_ar),suppliers(name_ar),shipment_containers(count)")
        .order("created_at", { ascending: false });

      if (status) request = request.eq("status", status);

      const [result, documentsResult] = await Promise.all([
        request,
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

  const reloadSilently = useCallback(() => load({ silent: true }), [status, ui]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useSupabaseRealtimeReload(reloadSilently, [{ table: "shipments" }, { table: "shipment_documents" }]);

  const filteredShipments = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return shipments;
    return shipments.filter((shipment) => {
      const invoice = invoiceByShipmentId.get(shipment.id);
      const invoiceLabel = invoice ? displayInvoiceNumber(invoice).toLowerCase() : "";
      return (
        shipment.acid.toLowerCase().includes(term) ||
        shipment.shipment_number.toLowerCase().includes(term) ||
        invoiceLabel.includes(term)
      );
    });
  }, [shipments, query, invoiceByShipmentId]);

  const counts = useMemo(
    () =>
      SHIPMENT_STATUSES.map((item) => ({
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
        {tr("الشحنات", "Shipments")} — {new Date().toLocaleDateString(languageToLocale(lang))}
      </div>
      <div className="print:hidden">
        <PageHeader
          title={tr("الشحنات", "Shipments")}
          description={tr(
            "قائمة الشحنات مع فلترة الحالة وإجراءات سريعة لكل شحنة.",
            "Shipments list with status filters and quick actions."
          )}
          actions={
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-secondary" onClick={() => void exportExcel()} type="button">
                <FileSpreadsheet className="h-4 w-4" />
                Excel
              </button>
              <button className="btn btn-secondary" onClick={() => window.print()} type="button">
                <Printer className="h-4 w-4" />
                {tr("طباعة", "Print")}
              </button>
              {canWrite ? (
                <Link className="btn" href="/shipments/new">
                  <Plus className="h-4 w-4" />
                  {tr("شحنة جديدة", "New shipment")}
                </Link>
              ) : null}
            </div>
          }
        />
      </div>

      <div className="print:hidden">
        <ErrorMessage message={error} />
      </div>

      <div className="grid gap-4 md:grid-cols-3 print:hidden">
        {counts.map((item) => (
          <button
            className={`card p-4 text-right transition hover:border-[#0f766e] ${status === item.status ? "border-[#0f766e]" : ""}`}
            key={item.status}
            onClick={() => setStatus(status === item.status ? "" : item.status)}
            type="button"
          >
            <span className={`status-badge status-${item.status}`}>{statusLabel(item.status)}</span>
            <div className="mt-3 text-3xl font-bold">{item.count}</div>
          </button>
        ))}
      </div>

      <div className="card grid gap-3 p-4 md:grid-cols-[1fr_220px_auto] print:hidden">
        <input className="input" placeholder="بحث برقم الفاتورة أو ACID" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select className="input" value={status} onChange={(event) => setStatus(event.target.value as ShipmentStatus | "")}>
          <option value="">كل الحالات</option>
          {SHIPMENT_STATUSES.map((item) => (
            <option key={item} value={item}>
              {statusLabel(item)}
            </option>
          ))}
        </select>
        <button className="btn btn-secondary" onClick={() => void load()} type="button">
          <RefreshCw className="h-4 w-4" />
          تحديث
        </button>
      </div>

      <div className="card overflow-hidden report-print-table-wrap">
        <div className="overflow-auto">
          <table className={`report-print-table ${SHIPMENT_TABLE_CLASS}`}>
            <thead className="table-head">
              <tr>
                <th className="table-actions-first text-right print:hidden">{ui("إجراءات")}</th>
                <th className="text-right col-invoice">{ui("رقم الفاتورة")}</th>
                <th className="text-right col-cargo-type">{ui("نوع البضاعة")}</th>
                <th className="text-right">{ui("عدد الكراتين")}</th>
                <th className="text-right">{ui("عدد الحاويات")}</th>
                <th className="text-right col-amount">{ui("قيمة الشحنة (USD)")}</th>
                <th className="text-right">{ui("تاريخ الشحن")}</th>
                <th className="text-right">{ui("تاريخ الوصول المتوقع")}</th>
                <th className="text-right col-acid">ACID</th>
                <th className="text-right">{ui("الحالة")}</th>
                <th className="text-right">{ui("الشركة")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="p-4 text-[var(--muted)]" colSpan={11}>{ui("جاري التحميل...")}</td>
                </tr>
              ) : filteredShipments.length ? (
                filteredShipments.map((shipment) => {
                  const action = getNextStatusAction(shipment.status);
                  const invoiceFile = invoiceByShipmentId.get(shipment.id);
                  return (
                    <tr className="row-hover border-t border-[var(--border)]" key={shipment.id}>
                      <td className="table-actions-first print:hidden">
                        <div className="flex flex-wrap gap-1">
                          <Link className="btn btn-secondary px-2 py-1 text-xs" href={`/shipments/${shipment.id}/report`} title={ui("تقرير / PDF")}>
                            <Eye className="h-4 w-4" />
                          </Link>
                          {isAdmin ? (
                            <>
                              <Link className="btn btn-secondary px-2 py-1 text-xs" href={`/shipments/${shipment.id}?edit=1`} title={ui("تعديل")}>
                                <Pencil className="h-4 w-4" />
                              </Link>
                              <button
                                className="btn btn-secondary px-2 py-1 text-xs text-red-700"
                                disabled={deleteLoading === shipment.id}
                                onClick={() => removeShipment(shipment)}
                                title={ui("حذف")}
                                type="button"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          ) : null}
                          {action && canWrite ? (
                            <button className="btn px-2 py-1 text-xs" disabled={actionLoading === shipment.id} onClick={() => transition(shipment)} type="button">
                              {actionLoading === shipment.id ? "..." : getNextActionLabel(action, lang)}
                            </button>
                          ) : null}
                        </div>
                      </td>
                      <td className="font-semibold col-invoice">
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
                      <td className="font-semibold col-amount">{formatUsd(shipment.value_usd)}</td>
                      <td>{formatDisplayDate(shipment.shipped_at, lang)}</td>
                      <td>{formatDisplayDate(shipment.eta, lang)}</td>
                      <td className="font-semibold col-acid" title={shipment.acid}>
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
                  <td className="p-4 text-[var(--muted)]" colSpan={11}>{ui("لا توجد شحنات مطابقة.")}</td>
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
