"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye } from "lucide-react";
import { PurchaseOrderStatusPill } from "@/components/purchase-order-status-pill";
import { ErrorMessage, PageHeader } from "@/components/ui";
import { useLanguage } from "@/context/language-context";
import { useProfile } from "@/context/profile-context";
import { formatDisplayDate } from "@/lib/format";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { PurchaseOrder } from "@/lib/types";

export default function SupplierPurchaseOrdersPage() {
  const { tr, ui } = useLanguage();
  const { supplierId, isAdmin } = useProfile();
  const [rows, setRows] = useState<PurchaseOrder[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      if (!isSupabaseConfigured()) {
        setLoading(false);
        return;
      }
      if (!isAdmin && !supplierId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      let request = createClient()
        .from("purchase_orders")
        .select("*,companies(name_ar),suppliers(name_ar)")
        .order("created_at", { ascending: false });
      if (!isAdmin && supplierId) {
        request = request.eq("supplier_id", supplierId);
      }
      const result = await request;
      setLoading(false);
      if (result.error) {
        setError(result.error.message);
        return;
      }
      setRows((result.data ?? []) as PurchaseOrder[]);
    })();
  }, [supplierId, isAdmin]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => row.po_number.toLowerCase().includes(term));
  }, [query, rows]);

  return (
    <div className="space-y-5">
      <PageHeader
        title={tr("أوامر الشراء", "Purchase orders", "采购订单")}
        description={
          isAdmin
            ? tr(
                "عرض كل أوامر الشراء وتشغيل دور المورد للتجربة.",
                "View all POs and run supplier workflow for testing.",
                "查看所有采购订单，并可用供应商流程进行测试。"
              )
            : tr("أوامر الشراء المرسلة إليك.", "Purchase orders assigned to you.", "分配给你的采购订单。")
        }
      />
      <ErrorMessage message={error} />

      <input
        className="input max-w-md"
        placeholder={ui("بحث برقم الأمر...")}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-right">
            <tr>
              <th className="p-3">{ui("رقم الأمر")}</th>
              {isAdmin ? <th className="p-3">{ui("المورد")}</th> : null}
              <th className="p-3">{ui("الشركة")}</th>
              <th className="p-3">{ui("التاريخ")}</th>
              <th className="p-3">{ui("الحالة")}</th>
              <th className="p-3">{ui("إجراء")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="p-6 text-center text-[var(--muted)]" colSpan={isAdmin ? 6 : 5}>
                  {ui("جاري التحميل...")}
                </td>
              </tr>
            ) : filtered.length ? (
              filtered.map((row) => (
                <tr className="border-t border-[var(--border)]" key={row.id}>
                  <td className="p-3 font-medium">{row.po_number}</td>
                  {isAdmin ? <td className="p-3">{row.suppliers?.name_ar}</td> : null}
                  <td className="p-3">{row.companies?.name_ar}</td>
                  <td className="p-3">{formatDisplayDate(row.order_date)}</td>
                  <td className="p-3">
                    <PurchaseOrderStatusPill status={row.status} />
                  </td>
                  <td className="p-3">
                    <Link className="btn btn-secondary text-xs" href={`/supplier/purchase-orders/${row.id}`}>
                      <Eye className="h-3.5 w-3.5" />
                      {ui("عرض")}
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="p-6 text-center text-[var(--muted)]" colSpan={isAdmin ? 6 : 5}>
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
