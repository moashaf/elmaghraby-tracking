"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { PurchaseOrderStatusPill } from "@/components/purchase-order-status-pill";
import { ErrorMessage, PageHeader } from "@/components/ui";
import { useLanguage } from "@/context/language-context";
import { useProfile } from "@/context/profile-context";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { PurchaseOrder } from "@/lib/types";

export default function SupplierDashboardPage() {
  const { tr, ui } = useLanguage();
  const { supplierId } = useProfile();
  const [rows, setRows] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      if (!isSupabaseConfigured() || !supplierId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const result = await createClient()
        .from("purchase_orders")
        .select("id,po_number,status,order_date,expected_eta")
        .eq("supplier_id", supplierId)
        .order("created_at", { ascending: false })
        .limit(5);
      setLoading(false);
      if (result.error) {
        setError(result.error.message);
        return;
      }
      setRows((result.data ?? []) as PurchaseOrder[]);
    })();
  }, [supplierId]);

  return (
    <div className="space-y-5">
      <PageHeader
        title={tr("بوابة المورد", "Supplier portal", "供应商门户")}
        description={tr(
          "عرض وتأكيد أوامر الشراء الخاصة بك.",
          "View and confirm your purchase orders.",
          "查看并确认你的采购订单。"
        )}
        actions={
          <Link className="btn btn-primary" href="/supplier/purchase-orders">
            <ClipboardList className="h-4 w-4" />
            {tr("أوامر الشراء", "Purchase orders", "采购订单")}
          </Link>
        }
      />
      <ErrorMessage message={error} />

      <div className="card p-5">
        <h2 className="mb-3 font-semibold">{ui("آخر أوامر الشراء")}</h2>
        {loading ? (
          <p className="text-sm text-[var(--muted)]">{ui("جاري التحميل...")}</p>
        ) : rows.length ? (
          <div className="space-y-2">
            {rows.map((row) => (
              <Link
                className="flex items-center justify-between rounded-md border border-[var(--border)] p-3 hover:bg-slate-50"
                href={`/supplier/purchase-orders/${row.id}`}
                key={row.id}
              >
                <span className="font-medium">{row.po_number}</span>
                <PurchaseOrderStatusPill status={row.status} />
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">{ui("لا توجد أوامر شراء.")}</p>
        )}
      </div>
    </div>
  );
}
