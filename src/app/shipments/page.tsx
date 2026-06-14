"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, FileSpreadsheet, Pencil, Plus, Printer, RefreshCw, Trash2 } from "lucide-react";
import { ErrorMessage, PageHeader } from "@/components/ui";
import {
  getNextStatusAction,
  NEXT_ACTION_LABELS,
  SHIPMENT_STATUS_LABELS,
  SHIPMENT_STATUS_LABELS_EN,
  SHIPMENT_STATUSES,
  type ShipmentStatus,
} from "@/lib/constants";
import { downloadExcelWithOptionalImages } from "@/lib/excel-export";
import { useProfile } from "@/context/profile-context";
import { useLanguage } from "@/context/language-context";
import { formatUsd } from "@/lib/format";
import { readEmbeddedContainerCount } from "@/lib/shipment-container-count";
import { displayInvoiceNumber, invoiceMapFromDocuments } from "@/lib/shipment-invoice-number";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { getSupabaseErrorMessage } from "@/lib/supabase/errors";
import type { Shipment } from "@/lib/types";

export default function ShipmentsPage() {
  const router = useRouter();
  const { canWrite, isAdmin } = useProfile();
  const { tr, lang } = useLanguage();
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

  async function load() {
    setError("");
    if (!isSupabaseConfigured()) {
      setLoading(false);
      setError("اضبط ملف .env.local أولا بقيم Supabase.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      await supabase.rpc("auto_move_shipments_to_customs");
      let request = supabase
        .from("shipments")
        .select("*,companies(name_ar),suppliers(name_ar),shipment_containers(count)")
        .order("created_at", { ascending: false });

      if (status) request = request.eq("status", status);
      if (query.trim()) request = request.or(`shipment_number.ilike.%${query.trim()}%,acid.ilike.%${query.trim()}%`);

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
      setLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

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
      cartons: shipments.reduce((sum, shipment) => sum + Number(shipment.total_cartons ?? 0), 0),
      containers: shipments.reduce(
        (sum, shipment) => sum + readEmbeddedContainerCount((shipment as Shipment & { shipment_containers?: unknown }).shipment_containers),
        0
      ),
    }),
    [shipments]
  );

  const statusLabels = lang === "ar" ? SHIPMENT_STATUS_LABELS : SHIPMENT_STATUS_LABELS_EN;

  async function transition(shipment: Shipment) {
    const action = getNextStatusAction(shipment.status);
    if (!action) return;
    if (action !== "to_customs") {
      router.push(`/shipments/${shipment.id}`);
      return;
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    if (shipment.eta && todayIso < shipment.eta) {
      setError("لا يمكن تحويل الشحنة إلى «في الجمرك» قبل تاريخ الوصول المتوقع (ETA).");
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
    if (!window.confirm(`حذف الشحنة ${shipment.shipment_number} نهائيا؟`)) return;

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
    const rows = shipments.map((shipment) => {
      const invoiceFile = invoiceByShipmentId.get(shipment.id);
      return {
        [tr("رقم الشحنة", "Shipment no.")]: invoiceFile ? displayInvoiceNumber(invoiceFile) : "-",
        ACID: shipment.acid,
      [tr("الشركة", "Company")]: shipment.companies?.name_ar ?? "-",
      [tr("عدد الكراتين", "Cartons")]: shipment.total_cartons ?? "",
      [tr("عدد الحاويات", "Containers")]: readEmbeddedContainerCount(
        (shipment as Shipment & { shipment_containers?: unknown }).shipment_containers
      ),
      [tr("القيمة ($)", "Value (USD)")]: shipment.value_usd ?? "",
      [tr("تاريخ الشحن", "Shipped")]: shipment.shipped_at || "-",
      [tr("تاريخ الوصول", "ETA")]: shipment.eta || "-",
      [tr("الحالة", "Status")]: statusLabels[shipment.status],
      [tr("نوع البضاعة", "Cargo type")]: shipment.shipment_type || "-",
      };
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
        {tr("الشحنات", "Shipments")} — {new Date().toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB")}
      </div>
      <div className="print:hidden">
        <PageHeader
          title={tr("الشحنات", "Shipments")}
          description={tr(
            "قائمة الشحنات مع فلترة الحالة وزر التالي بجانب كل حالة.",
            "Shipments list with status filters and next-action shortcuts."
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
            <span className={`status-badge status-${item.status}`}>{statusLabels[item.status]}</span>
            <div className="mt-3 text-3xl font-bold">{item.count}</div>
          </button>
        ))}
      </div>

      <div className="card grid gap-3 p-4 md:grid-cols-[1fr_220px_auto] print:hidden">
        <input className="input" placeholder="بحث برقم الشحنة أو ACID" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select className="input" value={status} onChange={(event) => setStatus(event.target.value as ShipmentStatus | "")}>
          <option value="">كل الحالات</option>
          {SHIPMENT_STATUSES.map((item) => (
            <option key={item} value={item}>
              {statusLabels[item]}
            </option>
          ))}
        </select>
        <button className="btn btn-secondary" onClick={load} type="button">
          <RefreshCw className="h-4 w-4" />
          تحديث
        </button>
      </div>

      <div className="card overflow-hidden report-print-table-wrap">
        <div className="overflow-auto">
          <table className="report-print-table table-nowrap min-w-full text-sm">
            <thead className="table-head">
              <tr>
                <th className="p-3 text-right">رقم الشحنة</th>
                <th className="p-3 text-right">نوع البضاعة</th>
                <th className="p-3 text-right">عدد الكراتين</th>
                <th className="p-3 text-right">عدد الحاويات</th>
                <th className="p-3 text-right">قيمة الشحنة ($)</th>
                <th className="p-3 text-right">تاريخ الشحن</th>
                <th className="p-3 text-right">تاريخ الوصول</th>
                <th className="p-3 text-right">ACID</th>
                <th className="p-3 text-right">الحالة</th>
                <th className="p-3 text-right">الشركة</th>
                <th className="p-3 text-right print:hidden">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="p-4 text-[var(--muted)]" colSpan={11}>جاري التحميل...</td>
                </tr>
              ) : shipments.length ? (
                shipments.map((shipment) => {
                  const action = getNextStatusAction(shipment.status);
                  const invoiceFile = invoiceByShipmentId.get(shipment.id);
                  return (
                    <tr className="row-hover border-t border-[var(--border)]" key={shipment.id}>
                      <td className="p-3 font-semibold">
                        {invoiceFile ? displayInvoiceNumber(invoiceFile) : "-"}
                      </td>
                      <td className="p-3">{shipment.shipment_type || "-"}</td>
                      <td className="p-3">{shipment.total_cartons ?? "-"}</td>
                      <td className="p-3">
                        {readEmbeddedContainerCount(
                          (shipment as Shipment & { shipment_containers?: unknown }).shipment_containers
                        )}
                      </td>
                      <td className="p-3 font-semibold">{formatUsd(shipment.value_usd)}</td>
                      <td className="p-3">{shipment.shipped_at || "-"}</td>
                      <td className="p-3">{shipment.eta || "-"}</td>
                      <td className="p-3 font-semibold">{shipment.acid}</td>
                      <td className="p-3">
                        <span className={`status-badge status-${shipment.status}`}>{statusLabels[shipment.status]}</span>
                      </td>
                      <td className="p-3">{shipment.companies?.name_ar ?? "-"}</td>
                      <td className="p-3 print:hidden">
                        <div className="flex flex-wrap gap-2">
                          <Link className="btn btn-secondary px-2 py-1 text-xs" href={`/shipments/${shipment.id}/report`} title="تقرير للطباعة">
                            <Eye className="h-4 w-4" />
                          </Link>
                          {isAdmin ? (
                            <>
                              <Link className="btn btn-secondary px-2 py-1 text-xs" href={`/shipments/${shipment.id}?edit=1`} title="تعديل">
                                <Pencil className="h-4 w-4" />
                              </Link>
                              <button
                                className="btn btn-secondary px-2 py-1 text-xs text-red-700"
                                disabled={deleteLoading === shipment.id}
                                onClick={() => removeShipment(shipment)}
                                title="حذف"
                                type="button"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          ) : null}
                          {action && canWrite ? (
                            <button className="btn px-2 py-1 text-xs" disabled={actionLoading === shipment.id} onClick={() => transition(shipment)} type="button">
                              {actionLoading === shipment.id ? "..." : NEXT_ACTION_LABELS[action]}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="p-4 text-[var(--muted)]" colSpan={11}>لا توجد شحنات مطابقة.</td>
                </tr>
            )}
          </tbody>
          {!loading && shipments.length ? (
            <tfoot className="table-head font-bold">
              <tr>
                <td className="p-3">الإجمالي</td>
                <td className="p-3" />
                <td className="p-3">{listTotals.cartons.toLocaleString("ar-EG")}</td>
                <td className="p-3">{listTotals.containers.toLocaleString("ar-EG")}</td>
                <td className="p-3" colSpan={7} />
              </tr>
            </tfoot>
          ) : null}
        </table>
        </div>
      </div>
    </div>
  );
}
