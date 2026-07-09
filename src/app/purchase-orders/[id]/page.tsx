"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, Trash2, UserCog, XCircle } from "lucide-react";
import { PurchaseOrderStatusPill } from "@/components/purchase-order-status-pill";
import { SupplierPoWorkspace } from "@/components/supplier-po-workspace";
import { ErrorMessage, PageHeader } from "@/components/ui";
import { useLanguage } from "@/context/language-context";
import { useProfile } from "@/context/profile-context";
import { canActAsSupplier } from "@/lib/permissions";
import { canStaffEditPo, getPoItemStatusLabel } from "@/lib/purchase-order-status";
import { formatDisplayDate } from "@/lib/format";
import { displayUnitPerCarton } from "@/lib/shipment-product-quantity";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useSupabaseRealtimeReload } from "@/lib/supabase/use-realtime-reload";
import type {
  PoItemStatus,
  PoTimelineEvent,
  PurchaseOrder,
  PurchaseOrderDeliveryBatch,
  PurchaseOrderItem,
  PurchaseOrderReceipt,
} from "@/lib/types";

type Tab = "items" | "supplier" | "summary" | "timeline";

export default function PurchaseOrderDetailsPage() {
  const params = useParams<{ id: string }>();
  const { ui, lang } = useLanguage();
  const { canWrite, isAdmin, role } = useProfile();
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [items, setItems] = useState<PurchaseOrderItem[]>([]);
  const [batches, setBatches] = useState<PurchaseOrderDeliveryBatch[]>([]);
  const [receipts, setReceipts] = useState<PurchaseOrderReceipt[]>([]);
  const [timeline, setTimeline] = useState<PoTimelineEvent[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("items");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const tabs = useMemo<Array<{ id: Tab; label: string }>>(() => {
    const base: Array<{ id: Tab; label: string }> = [
      { id: "items", label: ui("البنود") },
      { id: "summary", label: ui("ملخص") },
      { id: "timeline", label: ui("السجل") },
    ];
    if (canActAsSupplier(role)) {
      base.splice(1, 0, { id: "supplier", label: ui("تشغيل كمورد") });
    }
    return base;
  }, [ui, role]);

  async function load(options?: { silent?: boolean }) {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      setError(ui("اضبط ملف .env.local أولا بقيم Supabase."));
      return;
    }

    if (!options?.silent) {
      setLoading(true);
      setError("");
    }

    const supabase = createClient();
    const [poResult, itemsResult, receiptsResult, timelineResult] = await Promise.all([
      supabase.from("purchase_orders").select("*,suppliers(name_ar),companies(name_ar)").eq("id", params.id).single(),
      supabase
        .from("purchase_order_items")
        .select("*,products(sku,name_ar,unit)")
        .eq("purchase_order_id", params.id)
        .order("created_at"),
      supabase
        .from("purchase_order_receipts")
        .select("*,purchase_order_items(product_id,products(sku,name_ar))")
        .eq("purchase_order_id", params.id)
        .order("received_date", { ascending: false }),
      supabase
        .from("purchase_order_timeline_events")
        .select("id,purchase_order_id,event_type,title_ar,description_ar,created_at")
        .eq("purchase_order_id", params.id)
        .order("created_at", { ascending: false }),
    ]);

    if (!options?.silent) setLoading(false);

    if (poResult.error) {
      setError(poResult.error.message);
      return;
    }

    const itemRows = (itemsResult.data ?? []) as PurchaseOrderItem[];
    const itemIds = itemRows.map((row) => row.id);
    let batchRows: PurchaseOrderDeliveryBatch[] = [];
    if (itemIds.length) {
      const batchesResult = await supabase
        .from("purchase_order_delivery_batches")
        .select("*")
        .in("purchase_order_item_id", itemIds)
        .order("planned_date");
      batchRows = (batchesResult.data ?? []) as PurchaseOrderDeliveryBatch[];
    }

    setPo(poResult.data as PurchaseOrder);
    setItems(itemRows);
    setBatches(batchRows);
    setReceipts((receiptsResult.data ?? []) as PurchaseOrderReceipt[]);
    setTimeline((timelineResult.data ?? []) as PoTimelineEvent[]);
  }

  const reloadSilently = useCallback(() => load({ silent: true }), [params.id, ui]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  useSupabaseRealtimeReload(reloadSilently, [
    { table: "purchase_orders", filter: `id=eq.${params.id}` },
    { table: "purchase_order_items", filter: `purchase_order_id=eq.${params.id}` },
    { table: "purchase_order_receipts", filter: `purchase_order_id=eq.${params.id}` },
    { table: "purchase_order_timeline_events", filter: `purchase_order_id=eq.${params.id}` },
  ]);

  async function deletePo() {
    if (!po || !isAdmin || !window.confirm(ui(`حذف أمر الشراء ${po.po_number} نهائيا؟`))) return;
    setSaving(true);
    const result = await createClient().from("purchase_orders").delete().eq("id", po.id);
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    window.location.href = "/purchase-orders";
  }

  async function cancelPo() {
    if (!po || !canWrite || !window.confirm(ui("إلغاء أمر الشراء؟"))) return;
    setSaving(true);
    const result = await createClient().from("purchase_orders").update({ status: "cancelled" }).eq("id", po.id);
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    await load();
  }

  const batchesByItem = useMemo(() => {
    const map = new Map<string, PurchaseOrderDeliveryBatch[]>();
    for (const batch of batches) map.set(batch.purchase_order_item_id, [...(map.get(batch.purchase_order_item_id) ?? []), batch]);
    return map;
  }, [batches]);

  const receiptsByItem = useMemo(() => {
    const map = new Map<string, PurchaseOrderReceipt[]>();
    for (const receipt of receipts) map.set(receipt.purchase_order_item_id, [...(map.get(receipt.purchase_order_item_id) ?? []), receipt]);
    return map;
  }, [receipts]);

  if (loading) return <p className="text-sm text-[var(--muted)]">{ui("جاري التحميل...")}</p>;
  if (!po) return <ErrorMessage message={error || ui("أمر الشراء غير موجود.")} />;

  return (
    <div className="space-y-5">
      <PageHeader
        title={po.po_number}
        description={`${po.suppliers?.name_ar ?? ""} — ${po.companies?.name_ar ?? ""}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <PurchaseOrderStatusPill status={po.status} />
            <Link className="btn btn-secondary text-sm" href="/purchase-orders">
              <ArrowRight className="h-4 w-4" />
              {ui("رجوع")}
            </Link>
            {canActAsSupplier(role) ? (
              <Link className="btn btn-secondary text-sm" href={`/supplier/purchase-orders/${po.id}`}>
                <UserCog className="h-4 w-4" />
                {ui("فتح كمورد")}
              </Link>
            ) : null}
            {canWrite && canStaffEditPo(po.status) ? (
              <button className="btn btn-secondary text-sm" disabled={saving} onClick={() => void cancelPo()} type="button">
                <XCircle className="h-4 w-4" />
                {ui("إلغاء")}
              </button>
            ) : null}
            {isAdmin ? (
              <button className="btn btn-secondary text-sm text-red-700" disabled={saving} onClick={() => void deletePo()} type="button">
                <Trash2 className="h-4 w-4" />
                {ui("حذف")}
              </button>
            ) : null}
          </div>
        }
      />
      <ErrorMessage message={error} />

      <div className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-2">
        {tabs.map((tab) => (
          <button
            className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
              activeTab === tab.id ? "bg-[#0f766e] text-white" : "bg-slate-100 text-slate-700"
            }`}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "summary" ? (
        <div className="card grid gap-4 p-5 md:grid-cols-2">
          <div>
            <div className="text-xs text-[var(--muted)]">{ui("تاريخ الطلب")}</div>
            <div className="font-semibold">{formatDisplayDate(po.order_date)}</div>
          </div>
          <div className="md:col-span-2">
            <div className="text-xs text-[var(--muted)]">{ui("ملاحظات")}</div>
            <div>{po.notes || "-"}</div>
          </div>
        </div>
      ) : null}

      {activeTab === "items" ? (
        <div className="space-y-4">
          {items.map((item) => {
            const itemBatches = batchesByItem.get(item.id) ?? [];
            const itemReceipts = receiptsByItem.get(item.id) ?? [];
            const receivedCartons = itemReceipts.reduce((sum, row) => sum + Number(row.received_cartons ?? 0), 0);
            return (
              <div className="card space-y-3 p-4" key={item.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-bold">
                      {item.products?.sku} — {item.products?.name_ar}
                    </div>
                    <div className="mt-1 text-sm text-[var(--muted)]">
                      {ui("وحدة/كرتونة:")} {displayUnitPerCarton(item.order_cartons, item.order_quantity)}
                    </div>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {getPoItemStatusLabel(item.item_status as PoItemStatus, lang) ?? item.item_status}
                  </span>
                </div>
                <div className="grid gap-3 text-sm md:grid-cols-4">
                  <div>
                    <div className="text-[var(--muted)]">{ui("مطلوب")}</div>
                    <div className="font-semibold">
                      {item.order_cartons ?? "-"} {ui("كرتونة")} / {item.order_quantity} {ui("قطعة")}
                    </div>
                  </div>
                  <div>
                    <div className="text-[var(--muted)]">{ui("مقبول")}</div>
                    <div className="font-semibold">
                      {item.accepted_cartons ?? "-"} {ui("كرتونة")} / {item.accepted_quantity ?? "-"} {ui("قطعة")}
                    </div>
                  </div>
                  <div>
                    <div className="text-[var(--muted)]">{ui("مستلم")}</div>
                    <div className="font-semibold">{receivedCartons} {ui("كرتونة")}</div>
                  </div>
                  <div>
                    <div className="text-[var(--muted)]">{ui("مفكك / جديد")}</div>
                    <div className="font-semibold">
                      {item.is_disassembled ? ui("مفكك") : "-"} / {item.is_new_incoming_product ? ui("جديد") : "-"}
                    </div>
                  </div>
                </div>
                {itemBatches.length ? (
                  <div className="space-y-2 border-t border-[var(--border)] pt-3">
                    <div className="text-sm font-semibold">{ui("دفعات التسليم")}</div>
                    {itemBatches.map((batch) => (
                      <div className="text-sm text-[var(--muted)]" key={batch.id}>
                        {batch.planned_cartons ?? "-"} {ui("كرتونة")} —{" "}
                        {batch.planned_date ? formatDisplayDate(batch.planned_date) : ui("بدون تاريخ")} — {batch.status}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {activeTab === "supplier" && po ? (
        <SupplierPoWorkspace batches={batches} items={items} onSaved={() => void load()} po={po} receipts={receipts} />
      ) : null}

      {activeTab === "timeline" ? (
        <div className="space-y-3">
          {timeline.length ? (
            timeline.map((event) => (
              <div className="card p-4" key={event.id}>
                <div className="font-semibold">{event.title_ar}</div>
                {event.description_ar ? <p className="mt-1 text-sm text-[var(--muted)]">{event.description_ar}</p> : null}
                <div className="mt-2 text-xs text-[var(--muted)]">{formatDisplayDate(event.created_at.slice(0, 10))}</div>
              </div>
            ))
          ) : (
            <p className="text-sm text-[var(--muted)]">{ui("لا يوجد سجل بعد.")}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
