"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PackageCheck, RefreshCw } from "lucide-react";
import { ErrorMessage, PageHeader } from "@/components/ui";
import { PurchaseOrderStatusPill } from "@/components/purchase-order-status-pill";
import { useLanguage } from "@/context/language-context";
import { useProfile } from "@/context/profile-context";
import { formatDisplayDate } from "@/lib/format";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { PurchaseOrderDeliveryBatch, PurchaseOrderItem, PurchaseOrder, PurchaseOrderReceipt } from "@/lib/types";

type AwaitingRow = PurchaseOrderDeliveryBatch & {
  purchase_order_items?: PurchaseOrderItem & {
    purchase_orders?: Pick<PurchaseOrder, "id" | "po_number" | "status"> & {
      suppliers?: { name_ar?: string } | null;
      companies?: { name_ar?: string } | null;
    };
    products?: { sku?: string; name_ar?: string } | null;
  };
};

export default function SupplierAwaitingReceiptPage() {
  const { ui, tr } = useLanguage();
  const { supplierId, isAdmin } = useProfile();
  const [rows, setRows] = useState<AwaitingRow[]>([]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    if (!isSupabaseConfigured()) {
      setLoading(false);
      setError(ui("اضبط ملف .env.local أولا بقيم Supabase."));
      return;
    }
    if (!isAdmin && !supplierId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const supabase = createClient();

    // Supplier RLS filters automatically for supplier users.
    // For admin we pull all scheduled batches.
    let request = supabase
      .from("purchase_order_delivery_batches")
      .select(
        "*,purchase_order_items(*,products(sku,name_ar),purchase_orders(id,po_number,status,suppliers(name_ar),companies(name_ar)))"
      )
      .eq("status", "scheduled")
      .order("planned_date", { ascending: true })
      .order("created_at", { ascending: true });

    if (date) request = request.eq("planned_date", date);

    const result = await request;
    setLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setRows((result.data ?? []) as AwaitingRow[]);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const grouped = useMemo(() => rows, [rows]);

  async function receive(row: AwaitingRow) {
    setError("");
    if (!row.purchase_order_items?.purchase_order_id) return;

    const po = row.purchase_order_items.purchase_orders;
    const item = row.purchase_order_items;
    if (!po?.id || !item?.id) return;

    setReceivingId(row.id);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const insertResult = await supabase.from("purchase_order_receipts").insert({
      purchase_order_id: po.id,
      purchase_order_item_id: item.id,
      delivery_batch_id: row.id,
      received_date: row.planned_date ?? new Date().toISOString().slice(0, 10),
      received_quantity: row.planned_quantity,
      received_cartons: row.planned_cartons,
      received_by: user?.id ?? null,
    } satisfies Partial<PurchaseOrderReceipt>);

    setReceivingId(null);
    if (insertResult.error) {
      setError(insertResult.error.message);
      return;
    }

    await load();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={tr("أصناف تحت الاستلام", "Awaiting receipt", "待收货清单")}
        description={tr(
          "تجميع كل دفعات التسليم المنتظرة في يوم واحد لتسجيل الاستلام بسرعة.",
          "All scheduled delivery batches for fast receiving.",
          "汇总同一天的所有计划到货批次，便于快速登记收货。"
        )}
        actions={
          <button className="btn btn-secondary text-sm" onClick={() => void load()} type="button">
            <RefreshCw className="h-4 w-4" />
            {ui("تحديث")}
          </button>
        }
      />
      <ErrorMessage message={error} />

      <div className="card grid gap-3 p-4 md:grid-cols-[220px_1fr]">
        <label className="label">
          {ui("تاريخ التسليم")}
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <div className="text-sm text-[var(--muted)]">
          {ui("اختر تاريخًا لعرض الدفعات المجدولة.")}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--muted)]">{ui("جاري التحميل...")}</p>
      ) : grouped.length ? (
        <div className="space-y-3">
          {grouped.map((row) => {
            const item = row.purchase_order_items;
            const po = item?.purchase_orders;
            return (
              <div className="card flex flex-wrap items-center justify-between gap-3 p-4" key={row.id}>
                <div className="min-w-0">
                  <div className="font-bold">
                    {item?.products?.sku} — {item?.products?.name_ar}
                  </div>
                  <div className="mt-1 text-sm text-[var(--muted)]">
                    {ui("الكمية:")} {row.planned_cartons ?? "-"} {ui("كرتونة")} — {row.planned_quantity} {ui("قطعة")}
                  </div>
                  <div className="mt-1 text-xs text-[var(--muted)]">
                    {ui("أمر:")}{" "}
                    {po?.id ? (
                      <Link className="underline" href={`/supplier/purchase-orders/${po.id}`}>
                        {po.po_number}
                      </Link>
                    ) : (
                      "-"
                    )}{" "}
                    {po?.status ? <PurchaseOrderStatusPill status={po.status} /> : null}
                  </div>
                  {isAdmin ? (
                    <div className="mt-1 text-xs text-[var(--muted)]">
                      {ui("المورد:")} {po?.suppliers?.name_ar ?? "-"} — {ui("الشركة:")} {po?.companies?.name_ar ?? "-"}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="btn btn-secondary text-xs">
                    {row.planned_date ? formatDisplayDate(row.planned_date) : ui("اليوم")}
                  </span>
                  <button
                    className="btn btn-primary text-sm"
                    disabled={receivingId === row.id}
                    onClick={() => void receive(row)}
                    type="button"
                  >
                    <PackageCheck className="h-4 w-4" />
                    {receivingId === row.id ? ui("جاري التسجيل...") : ui("تم الاستلام")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card p-6 text-center text-sm text-[var(--muted)]">{ui("لا توجد دفعات مجدولة في هذا التاريخ.")}</div>
      )}
    </div>
  );
}

