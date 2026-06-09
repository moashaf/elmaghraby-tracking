"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { ErrorMessage, PageHeader } from "@/components/ui";
import {
  getNextStatusAction,
  NEXT_ACTION_LABELS,
  SHIPMENT_STATUS_LABELS,
  SHIPMENT_STATUS_LABELS_EN,
  SHIPMENT_STATUSES,
  type ShipmentStatus,
} from "@/lib/constants";
import { useProfile } from "@/context/profile-context";
import { useLanguage } from "@/context/language-context";
import { formatUsd } from "@/lib/format";
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
        .select("*,companies(name_ar),suppliers(name_ar)")
        .order("created_at", { ascending: false });

      if (status) request = request.eq("status", status);
      if (query.trim()) request = request.or(`shipment_number.ilike.%${query.trim()}%,acid.ilike.%${query.trim()}%`);

      const result = await request;

      if (result.error) {
        setError(getSupabaseErrorMessage(result.error));
        return;
      }

      setShipments((result.data as Shipment[] | null) ?? []);
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

  return (
    <div className="space-y-5">
      <PageHeader
        title={tr("الشحنات", "Shipments")}
        description={tr(
          "قائمة الشحنات مع فلترة الحالة وزر التالي بجانب كل حالة.",
          "Shipments list with status filters and next-action shortcuts."
        )}
        actions={
          canWrite ? (
            <Link className="btn" href="/shipments/new">
              <Plus className="h-4 w-4" />
              {tr("شحنة جديدة", "New shipment")}
            </Link>
          ) : null
        }
      />

      <ErrorMessage message={error} />

      <div className="grid gap-4 md:grid-cols-3">
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

      <div className="card grid gap-3 p-4 md:grid-cols-[1fr_220px_auto]">
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

      <div className="card overflow-hidden">
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="table-head">
              <tr>
                <th className="p-3 text-right">نوع البضاعة</th>
                <th className="p-3 text-right">عدد الكراتين</th>
                <th className="p-3 text-right">قيمة الشحنة ($)</th>
                <th className="p-3 text-right">تاريخ الشحن</th>
                <th className="p-3 text-right">تاريخ الوصول</th>
                <th className="p-3 text-right">ACID</th>
                <th className="p-3 text-right">الحالة</th>
                <th className="p-3 text-right">الشركة</th>
                <th className="p-3 text-right">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="p-4 text-[var(--muted)]" colSpan={9}>جاري التحميل...</td>
                </tr>
              ) : shipments.length ? (
                shipments.map((shipment) => {
                  const action = getNextStatusAction(shipment.status);
                  return (
                    <tr className="row-hover border-t border-[var(--border)]" key={shipment.id}>
                      <td className="p-3">{shipment.shipment_type || "-"}</td>
                      <td className="p-3">{shipment.total_cartons ?? "-"}</td>
                      <td className="p-3 font-semibold">{formatUsd(shipment.value_usd)}</td>
                      <td className="p-3">{shipment.shipped_at || "-"}</td>
                      <td className="p-3">{shipment.eta || "-"}</td>
                      <td className="p-3 font-semibold">{shipment.acid}</td>
                      <td className="p-3">
                        <span className={`status-badge status-${shipment.status}`}>{statusLabels[shipment.status]}</span>
                      </td>
                      <td className="p-3">{shipment.companies?.name_ar ?? "-"}</td>
                      <td className="p-3">
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
                  <td className="p-4 text-[var(--muted)]" colSpan={9}>لا توجد شحنات مطابقة.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
