"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, Plus, Trash2, UserCog } from "lucide-react";
import { PurchaseOrderStatusPill } from "@/components/purchase-order-status-pill";
import { ErrorMessage, PageHeader } from "@/components/ui";
import { useLanguage } from "@/context/language-context";
import { useProfile } from "@/context/profile-context";
import { PO_STATUSES } from "@/lib/purchase-order-status";
import { formatDisplayDate } from "@/lib/format";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { PoStatus, PurchaseOrder } from "@/lib/types";

export default function PurchaseOrdersPage() {
  const { tr, ui } = useLanguage();
  const { canWrite, isAdmin } = useProfile();
  const [rows, setRows] = useState<PurchaseOrder[]>([]);
  const [status, setStatus] = useState<PoStatus | "">("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    if (!isSupabaseConfigured()) {
      setLoading(false);
      setError(ui("اضبط ملف .env.local أولا بقيم Supabase."));
      return;
    }

    setLoading(true);
    let request = createClient()
      .from("purchase_orders")
      .select("*,suppliers(name_ar),companies(name_ar)")
      .order("created_at", { ascending: false });
    if (status) request = request.eq("status", status);

    const result = await request;
    setLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setRows((result.data ?? []) as PurchaseOrder[]);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      [row.po_number, row.suppliers?.name_ar, row.companies?.name_ar].some((value) =>
        value?.toLowerCase().includes(term)
      )
    );
  }, [query, rows]);

  async function deletePo(row: PurchaseOrder) {
    if (!isAdmin || !window.confirm(ui(`حذف أمر الشراء ${row.po_number} نهائيا؟`))) return;
    setError("");
    setDeleteLoading(row.id);
    const result = await createClient().from("purchase_orders").delete().eq("id", row.id);
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
        title={tr("أوامر الشراء", "Purchase orders", "采购订单")}
        description={tr(
          "إدارة طلبات الشراء من الموردين واستلامها في المستودع.",
          "Manage supplier POs and warehouse receipts.",
          "管理供应商采购订单及仓库收货。"
        )}
        actions={
          canWrite ? (
            <Link className="btn btn-primary" href="/purchase-orders/new">
              <Plus className="h-4 w-4" />
              {tr("أمر شراء جديد", "New PO", "新建采购单")}
            </Link>
          ) : null
        }
      />
      <ErrorMessage message={error} />

      <div className="flex flex-wrap gap-2">
        <button
          className={`btn text-sm ${status === "" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setStatus("")}
          type="button"
        >
          {ui("الكل")}
        </button>
        {PO_STATUSES.map((item) => (
          <button
            className={`btn text-sm ${status === item ? "btn-primary" : "btn-secondary"}`}
            key={item}
            onClick={() => setStatus(item)}
            type="button"
          >
            <PurchaseOrderStatusPill status={item} />
          </button>
        ))}
      </div>

      <input
        className="input max-w-md"
        placeholder={ui("بحث برقم الأمر أو المورد...")}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-right">
            <tr>
              <th className="p-3">{ui("رقم الأمر")}</th>
              <th className="p-3">{ui("المورد")}</th>
              <th className="p-3">{ui("الشركة")}</th>
              <th className="p-3">{ui("التاريخ")}</th>
              <th className="p-3">{ui("الحالة")}</th>
              <th className="p-3">{ui("إجراء")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="p-6 text-center text-[var(--muted)]" colSpan={6}>
                  {ui("جاري التحميل...")}
                </td>
              </tr>
            ) : filtered.length ? (
              filtered.map((row) => (
                <tr className="border-t border-[var(--border)]" key={row.id}>
                  <td className="p-3 font-medium">{row.po_number}</td>
                  <td className="p-3">{row.suppliers?.name_ar}</td>
                  <td className="p-3">{row.companies?.name_ar}</td>
                  <td className="p-3">{formatDisplayDate(row.order_date)}</td>
                  <td className="p-3">
                    <PurchaseOrderStatusPill status={row.status} />
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      <Link className="btn btn-secondary text-xs" href={`/purchase-orders/${row.id}`}>
                        <Eye className="h-3.5 w-3.5" />
                        {ui("عرض")}
                      </Link>
                      {isAdmin ? (
                        <>
                          <Link
                            className="btn btn-secondary text-xs"
                            href={`/supplier/purchase-orders/${row.id}`}
                            title={ui("تشغيل كمورد")}
                          >
                            <UserCog className="h-3.5 w-3.5" />
                            {ui("كمورد")}
                          </Link>
                          <button
                            className="btn btn-secondary text-xs text-red-700"
                            disabled={deleteLoading === row.id}
                            onClick={() => void deletePo(row)}
                            type="button"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {deleteLoading === row.id ? ui("...") : ui("حذف")}
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="p-6 text-center text-[var(--muted)]" colSpan={6}>
                  {ui("لا توجد أوامر شراء.")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
