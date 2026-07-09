"use client";

import { useMemo, useState } from "react";
import { Plus, Save } from "lucide-react";
import { ErrorMessage } from "@/components/ui";
import { useLanguage } from "@/context/language-context";
import { canReceivePo } from "@/lib/purchase-order-status";
import { createClient } from "@/lib/supabase/client";
import type { PoStatus, PurchaseOrderItem, PurchaseOrderReceipt } from "@/lib/types";

type Props = {
  purchaseOrderId: string;
  status: PoStatus;
  items: PurchaseOrderItem[];
  receipts: PurchaseOrderReceipt[];
  canWrite: boolean;
  onSaved: () => void;
};

type ReceiptDraft = {
  purchase_order_item_id: string;
  received_date: string;
  received_quantity: string;
  received_cartons: string;
  notes: string;
};

const today = new Date().toISOString().slice(0, 10);

export function PurchaseOrderReceipts({
  purchaseOrderId,
  status,
  items,
  receipts,
  canWrite,
  onSaved,
}: Props) {
  const { ui } = useLanguage();
  const [draft, setDraft] = useState<ReceiptDraft>({
    purchase_order_item_id: items[0]?.id ?? "",
    received_date: today,
    received_quantity: "",
    received_cartons: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const receivedByItem = useMemo(() => {
    const map = new Map<string, number>();
    for (const receipt of receipts) {
      map.set(
        receipt.purchase_order_item_id,
        (map.get(receipt.purchase_order_item_id) ?? 0) + Number(receipt.received_quantity)
      );
    }
    return map;
  }, [receipts]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite || !canReceivePo(status)) return;
    setError("");

    const qty = Number(draft.received_quantity);
    if (!draft.purchase_order_item_id || qty <= 0) {
      setError(ui("اختر البند وأدخل كمية صحيحة."));
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const result = await supabase.from("purchase_order_receipts").insert({
      purchase_order_id: purchaseOrderId,
      purchase_order_item_id: draft.purchase_order_item_id,
      received_date: draft.received_date,
      received_quantity: qty,
      received_cartons: draft.received_cartons ? Number(draft.received_cartons) : null,
      notes: draft.notes.trim() || null,
      received_by: user?.id ?? null,
    });

    if (!result.error) {
      await supabase.from("purchase_order_timeline_events").insert({
        purchase_order_id: purchaseOrderId,
        event_type: "receipt",
        title_ar: "استلام في المستودع",
        description_ar: `تم تسجيل استلام ${qty}`,
        created_by: user?.id ?? null,
      });
    }

    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }

    setDraft({
      purchase_order_item_id: items[0]?.id ?? "",
      received_date: today,
      received_quantity: "",
      received_cartons: "",
      notes: "",
    });
    onSaved();
  }

  return (
    <div className="space-y-4">
      <ErrorMessage message={error} />

      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-right">
            <tr>
              <th className="p-3">{ui("المنتج")}</th>
              <th className="p-3">{ui("المطلوب")}</th>
              <th className="p-3">{ui("المستلم")}</th>
              <th className="p-3">{ui("المتبقي")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const received = receivedByItem.get(item.id) ?? 0;
              const remaining = Number(item.order_quantity) - received;
              return (
                <tr className="border-t border-[var(--border)]" key={item.id}>
                  <td className="p-3">
                    {item.products?.sku} — {item.products?.name_ar}
                  </td>
                  <td className="p-3">{item.order_quantity}</td>
                  <td className="p-3">{received}</td>
                  <td className={`p-3 ${remaining < 0 ? "text-orange-700" : ""}`}>{remaining}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {receipts.length ? (
        <div className="space-y-2">
          <h4 className="font-semibold">{ui("سجل الاستلام")}</h4>
          {receipts.map((receipt) => (
            <div className="rounded-md border border-[var(--border)] p-3 text-sm" key={receipt.id}>
              <div className="font-medium">
                {receipt.purchase_order_items?.products?.sku} — {receipt.purchase_order_items?.products?.name_ar}
              </div>
              <div className="text-[var(--muted)]">
                {receipt.received_date}: {receipt.received_quantity}
                {receipt.received_cartons ? ` (${receipt.received_cartons} ${ui("كرتونة")})` : ""}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {canWrite && canReceivePo(status) ? (
        <form className="card grid gap-3 p-4 md:grid-cols-2" onSubmit={submit}>
          <label className="label md:col-span-2">
            {ui("بند أمر الشراء")}
            <select
              className="input"
              value={draft.purchase_order_item_id}
              onChange={(event) => setDraft((current) => ({ ...current, purchase_order_item_id: event.target.value }))}
            >
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.products?.sku} — {item.products?.name_ar}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            {ui("تاريخ الاستلام")}
            <input
              className="input"
              type="date"
              value={draft.received_date}
              onChange={(event) => setDraft((current) => ({ ...current, received_date: event.target.value }))}
            />
          </label>
          <label className="label">
            {ui("الكمية المستلمة")}
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={draft.received_quantity}
              onChange={(event) => setDraft((current) => ({ ...current, received_quantity: event.target.value }))}
            />
          </label>
          <label className="label">
            {ui("الكراتين")}
            <input
              className="input"
              type="number"
              min="0"
              value={draft.received_cartons}
              onChange={(event) => setDraft((current) => ({ ...current, received_cartons: event.target.value }))}
            />
          </label>
          <label className="label">
            {ui("ملاحظات")}
            <input
              className="input"
              value={draft.notes}
              onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
            />
          </label>
          <div className="md:col-span-2">
            <button className="btn btn-primary" disabled={saving} type="submit">
              <Plus className="h-4 w-4" />
              {saving ? ui("جاري الحفظ...") : ui("تسجيل استلام")}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
