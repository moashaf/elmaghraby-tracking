"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, PackageCheck, Plus, Trash2 } from "lucide-react";
import { ErrorMessage } from "@/components/ui";
import { useLanguage } from "@/context/language-context";
import { getPoItemStatusLabel, isItemLocked } from "@/lib/purchase-order-status";
import { displayUnitPerCarton } from "@/lib/shipment-product-quantity";
import { formatDisplayDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type {
  PoItemStatus,
  PurchaseOrder,
  PurchaseOrderDeliveryBatch,
  PurchaseOrderItem,
  PurchaseOrderReceipt,
} from "@/lib/types";

type BatchDraft = {
  planned_cartons: string;
  planned_date: string;
};

type ItemDraft = {
  accepted_cartons: string;
  accepted_quantity: string;
  batches: BatchDraft[];
};

const today = () => new Date().toISOString().slice(0, 10);

function unitPerCarton(item: PurchaseOrderItem) {
  return displayUnitPerCarton(item.order_cartons, item.order_quantity);
}

function piecesFromCartons(cartons: number, item: PurchaseOrderItem) {
  const unit = Number(unitPerCarton(item));
  if (!unit || unit <= 0) return cartons > 0 ? item.order_quantity : 0;
  return cartons * unit;
}

function cartonsFromPieces(pieces: number, item: PurchaseOrderItem) {
  const unit = Number(unitPerCarton(item));
  if (!unit || unit <= 0) return 0;
  return pieces / unit;
}

type Props = {
  po: PurchaseOrder;
  items: PurchaseOrderItem[];
  batches: PurchaseOrderDeliveryBatch[];
  receipts: PurchaseOrderReceipt[];
  onSaved: () => void;
};

export function SupplierPoWorkspace({ po, items, batches, receipts, onSaved }: Props) {
  const { ui, lang } = useLanguage();
  const [drafts, setDrafts] = useState<Record<string, ItemDraft>>({});
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const batchesByItem = useMemo(() => {
    const map = new Map<string, PurchaseOrderDeliveryBatch[]>();
    for (const batch of batches) {
      const list = map.get(batch.purchase_order_item_id) ?? [];
      list.push(batch);
      map.set(batch.purchase_order_item_id, list);
    }
    return map;
  }, [batches]);

  const receiptsByItem = useMemo(() => {
    const map = new Map<string, PurchaseOrderReceipt[]>();
    for (const receipt of receipts) {
      const list = map.get(receipt.purchase_order_item_id) ?? [];
      list.push(receipt);
      map.set(receipt.purchase_order_item_id, list);
    }
    return map;
  }, [receipts]);

  function getDraft(item: PurchaseOrderItem): ItemDraft {
    if (drafts[item.id]) return drafts[item.id];
    const defaultCartons = String(item.order_cartons ?? "");
    const defaultQty = String(item.order_quantity);
    return {
      accepted_cartons: defaultCartons,
      accepted_quantity: defaultQty,
      batches: [{ planned_cartons: defaultCartons, planned_date: today() }],
    };
  }

  function setDraft(itemId: string, draft: ItemDraft) {
    setDrafts((current) => ({ ...current, [itemId]: draft }));
  }

  function updateDraft(item: PurchaseOrderItem, patch: Partial<ItemDraft>) {
    setDraft(item.id, { ...getDraft(item), ...patch });
  }

  function updateBatch(item: PurchaseOrderItem, index: number, patch: Partial<BatchDraft>) {
    const draft = getDraft(item);
    const next = draft.batches.map((row, i) => (i === index ? { ...row, ...patch } : row));
    setDraft(item.id, { ...draft, batches: next });
  }

  async function confirmItem(item: PurchaseOrderItem) {
    setError("");
    const draft = getDraft(item);
    const acceptedCartons = Number(draft.accepted_cartons);
    const acceptedQty = Number(draft.accepted_quantity);

    if (!Number.isFinite(acceptedCartons) || acceptedCartons <= 0 || !Number.isFinite(acceptedQty) || acceptedQty <= 0) {
      setError(ui("أدخل كمية مقبولة صحيحة."));
      return;
    }

    const batchRows = draft.batches
      .map((row) => ({
        planned_cartons: Number(row.planned_cartons),
        planned_date: row.planned_date || today(),
      }))
      .filter((row) => row.planned_cartons > 0);

    if (!batchRows.length) {
      setError(ui("أضف دفعة تسليم واحدة على الأقل."));
      return;
    }

    const batchCartonsTotal = batchRows.reduce((sum, row) => sum + row.planned_cartons, 0);
    if (Math.abs(batchCartonsTotal - acceptedCartons) > 0.001) {
      setError(ui("مجموع دفعات التسليم يجب أن يساوي الكمية المقبولة بالكراتين."));
      return;
    }

    setSavingId(item.id);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const unit = Number(unitPerCarton(item)) || acceptedQty / acceptedCartons;

    const updateResult = await supabase
      .from("purchase_order_items")
      .update({
        accepted_quantity: acceptedQty,
        accepted_cartons: Math.round(acceptedCartons),
        confirmed_at: new Date().toISOString(),
        item_status: "awaiting_receipt",
      })
      .eq("id", item.id)
      .eq("item_status", "draft");

    if (updateResult.error) {
      setSavingId(null);
      setError(updateResult.error.message);
      return;
    }

    const insertBatches = await supabase.from("purchase_order_delivery_batches").insert(
      batchRows.map((row) => ({
        purchase_order_item_id: item.id,
        planned_cartons: Math.round(row.planned_cartons),
        planned_quantity: row.planned_cartons * unit,
        planned_date: row.planned_date,
        status: "scheduled",
      }))
    );

    if (insertBatches.error) {
      setSavingId(null);
      setError(insertBatches.error.message);
      return;
    }

    await supabase.from("purchase_order_timeline_events").insert({
      purchase_order_id: po.id,
      event_type: "item_confirmed",
      title_ar: "تأكيد صنف",
      description_ar: `${item.products?.sku ?? ""} — ${acceptedCartons} كرتونة`,
      created_by: user?.id ?? null,
    });

    setSavingId(null);
    onSaved();
  }

  async function saveEdits(item: PurchaseOrderItem) {
    setError("");
    const draft = getDraft(item);
    const acceptedCartons = Number(draft.accepted_cartons);
    const acceptedQty = Number(draft.accepted_quantity);

    if (
      !Number.isFinite(acceptedCartons) ||
      acceptedCartons <= 0 ||
      !Number.isFinite(acceptedQty) ||
      acceptedQty <= 0
    ) {
      setError(ui("أدخل كمية مقبولة صحيحة."));
      return;
    }

    const itemReceipts = receiptsByItem.get(item.id) ?? [];
    const receivedCartons = itemReceipts.reduce((sum, row) => sum + Number(row.received_cartons ?? 0), 0);
    if (acceptedCartons < receivedCartons) {
      setError(ui("لا يمكن أن تكون الكمية المقبولة أقل من الكمية المستلمة بالفعل."));
      return;
    }

    const scheduledBatches = draft.batches
      .map((row) => ({
        planned_cartons: Number(row.planned_cartons),
        planned_date: row.planned_date || today(),
      }))
      .filter((row) => row.planned_cartons > 0);

    if (!scheduledBatches.length) {
      setError(ui("أضف دفعة تسليم واحدة على الأقل."));
      return;
    }

    const scheduledTotal = scheduledBatches.reduce((sum, row) => sum + row.planned_cartons, 0);
    if (Math.abs(receivedCartons + scheduledTotal - acceptedCartons) > 0.001) {
      setError(ui("مجموع الدفعات (المستلم + المتبقي) يجب أن يساوي الكمية المقبولة بالكراتين."));
      return;
    }

    setSavingId(item.id);
    const supabase = createClient();
    const unit = Number(unitPerCarton(item)) || acceptedQty / acceptedCartons;

    const updateResult = await supabase
      .from("purchase_order_items")
      .update({
        accepted_quantity: acceptedQty,
        accepted_cartons: Math.round(acceptedCartons),
      })
      .eq("id", item.id);

    if (updateResult.error) {
      setSavingId(null);
      setError(updateResult.error.message);
      return;
    }

    // Replace only remaining scheduled batches; keep received batches intact.
    const deleteResult = await supabase
      .from("purchase_order_delivery_batches")
      .delete()
      .eq("purchase_order_item_id", item.id)
      .eq("status", "scheduled");

    if (deleteResult.error) {
      setSavingId(null);
      setError(deleteResult.error.message);
      return;
    }

    const insertResult = await supabase.from("purchase_order_delivery_batches").insert(
      scheduledBatches.map((row) => ({
        purchase_order_item_id: item.id,
        planned_cartons: Math.round(row.planned_cartons),
        planned_quantity: row.planned_cartons * unit,
        planned_date: row.planned_date,
        status: "scheduled",
      }))
    );

    setSavingId(null);
    if (insertResult.error) {
      setError(insertResult.error.message);
      return;
    }

    setEditingItemId(null);
    onSaved();
  }

  async function receiveBatch(item: PurchaseOrderItem, batch: PurchaseOrderDeliveryBatch) {
    setError("");
    setReceivingId(batch.id);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const receiptDate = batch.planned_date || today();
    const result = await supabase.from("purchase_order_receipts").insert({
      purchase_order_id: po.id,
      purchase_order_item_id: item.id,
      delivery_batch_id: batch.id,
      received_date: receiptDate,
      received_quantity: batch.planned_quantity,
      received_cartons: batch.planned_cartons,
      received_by: user?.id ?? null,
    });

    if (result.error) {
      setReceivingId(null);
      setError(result.error.message);
      return;
    }

    await supabase.from("purchase_order_timeline_events").insert({
      purchase_order_id: po.id,
      event_type: "batch_received",
      title_ar: "استلام دفعة",
      description_ar: `${item.products?.sku ?? ""} — ${batch.planned_cartons ?? ""} كرتونة`,
      created_by: user?.id ?? null,
    });

    setReceivingId(null);
    onSaved();
  }

  return (
    <div className="space-y-4">
      <ErrorMessage message={error} />

      {items.map((item) => {
        const locked = isItemLocked(item.item_status);
        const canEditNow = item.item_status === "awaiting_receipt";
        const isEditing = editingItemId === item.id;
        const draft = getDraft(item);
        const itemBatches = batchesByItem.get(item.id) ?? [];
        const itemReceipts = receiptsByItem.get(item.id) ?? [];
        const receivedCartons = itemReceipts.reduce((sum, row) => sum + Number(row.received_cartons ?? 0), 0);
        const targetCartons = Number(item.accepted_cartons ?? item.order_cartons ?? 0);
        const unitLabel = unitPerCarton(item);

        return (
          <div className="card space-y-4 p-4" key={item.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-bold">
                  {item.products?.sku} — {item.products?.name_ar}
                </div>
                <div className="mt-1 text-sm text-[var(--muted)]">
                  {ui("الوحدة/كرتونة:")} {unitLabel} | {ui("مفكك:")} {item.is_disassembled ? ui("نعم") : ui("لا")} |{" "}
                  {ui("منتج جديد:")} {item.is_new_incoming_product ? ui("نعم") : ui("لا")}
                </div>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {getPoItemStatusLabel(item.item_status as PoItemStatus, lang) ?? item.item_status}
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="label">
                {ui("الكمية المطلوبة (كرتون)")}
                <input className="input bg-slate-50" readOnly value={item.order_cartons ?? ""} />
              </label>
              <label className="label">
                {ui("إجمالي القطع المطلوبة")}
                <input className="input bg-slate-50" readOnly value={item.order_quantity} />
              </label>

              {!locked ? (
                <>
                  <label className="label">
                    {ui("الكمية المقبولة (كرتون)")}
                    <input
                      className="input"
                      min={0}
                      type="number"
                      value={draft.accepted_cartons}
                      onChange={(event) => {
                        const cartons = event.target.value;
                        const pieces = piecesFromCartons(Number(cartons), item);
                        updateDraft(item, {
                          accepted_cartons: cartons,
                          accepted_quantity: pieces > 0 ? String(pieces) : "",
                          batches: draft.batches.length === 1 ? [{ ...draft.batches[0], planned_cartons: cartons }] : draft.batches,
                        });
                      }}
                    />
                  </label>
                  <label className="label">
                    {ui("الكمية المقبولة (قطع)")}
                    <input
                      className="input"
                      min={0}
                      type="number"
                      value={draft.accepted_quantity}
                      onChange={(event) => {
                        const qty = event.target.value;
                        const cartons = cartonsFromPieces(Number(qty), item);
                        updateDraft(item, {
                          accepted_quantity: qty,
                          accepted_cartons: cartons > 0 ? String(Math.round(cartons * 1000) / 1000) : "",
                        });
                      }}
                    />
                  </label>
                </>
              ) : (
                <>
                  <label className="label">
                    {ui("الكمية المقبولة (كرتون)")}
                    <input className="input bg-slate-50" readOnly value={item.accepted_cartons ?? item.order_cartons ?? ""} />
                  </label>
                  <label className="label">
                    {ui("المستلم / المتبقي (كرتون)")}
                    <input
                      className="input bg-slate-50"
                      readOnly
                      value={`${receivedCartons} / ${Math.max(targetCartons - receivedCartons, 0)}`}
                    />
                  </label>
                </>
              )}
            </div>

            {!locked ? (
              <div className="space-y-3 rounded-lg border border-[var(--border)] p-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">{ui("دفعات التسليم المتوقعة")}</h4>
                  <button
                    className="btn btn-secondary text-sm"
                    onClick={() =>
                      updateDraft(item, {
                        batches: [...draft.batches, { planned_cartons: "", planned_date: today() }],
                      })
                    }
                    type="button"
                  >
                    <Plus className="h-4 w-4" />
                    {ui("دفعة")}
                  </button>
                </div>
                {draft.batches.map((batch, index) => (
                  <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]" key={index}>
                    <input
                      className="input"
                      min={0}
                      placeholder={ui("كرتون الدفعة")}
                      type="number"
                      value={batch.planned_cartons}
                      onChange={(event) => updateBatch(item, index, { planned_cartons: event.target.value })}
                    />
                    <input
                      className="input"
                      type="date"
                      value={batch.planned_date}
                      onChange={(event) => updateBatch(item, index, { planned_date: event.target.value })}
                    />
                    <button
                      className="btn btn-secondary px-2"
                      disabled={draft.batches.length === 1}
                      onClick={() =>
                        updateDraft(item, { batches: draft.batches.filter((_, rowIndex) => rowIndex !== index) })
                      }
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  className="btn btn-primary text-sm"
                  disabled={savingId === item.id}
                  onClick={() => void confirmItem(item)}
                  type="button"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {savingId === item.id ? ui("جاري التأكيد...") : ui("تأكيد الصنف")}
                </button>
              </div>
            ) : null}

            {canEditNow ? (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
                <div className="text-sm text-[var(--muted)]">
                  {ui("يمكنك تعديل الدفعات والكمية المقبولة قبل/بعد الاستلام الجزئي (مع حفظ القيود).")}
                </div>
                {!isEditing ? (
                  <button className="btn btn-secondary text-sm" onClick={() => setEditingItemId(item.id)} type="button">
                    {ui("تعديل")}
                  </button>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button className="btn btn-secondary text-sm" onClick={() => setEditingItemId(null)} type="button">
                      {ui("إلغاء")}
                    </button>
                    <button
                      className="btn btn-primary text-sm"
                      disabled={savingId === item.id}
                      onClick={() => void saveEdits(item)}
                      type="button"
                    >
                      {savingId === item.id ? ui("جاري الحفظ...") : ui("حفظ التعديل")}
                    </button>
                  </div>
                )}
              </div>
            ) : null}

            {locked && item.item_status === "awaiting_receipt" ? (
              <div className="space-y-2">
                <h4 className="font-semibold">{ui("دفعات بانتظار الاستلام")}</h4>
                {isEditing ? (
                  <div className="space-y-3 rounded-lg border border-[var(--border)] p-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="label">
                        {ui("الكمية المقبولة (كرتون)")}
                        <input
                          className="input"
                          min={0}
                          type="number"
                          value={draft.accepted_cartons}
                          onChange={(event) => {
                            const cartons = event.target.value;
                            const pieces = piecesFromCartons(Number(cartons), item);
                            updateDraft(item, {
                              accepted_cartons: cartons,
                              accepted_quantity: pieces > 0 ? String(pieces) : "",
                            });
                          }}
                        />
                      </label>
                      <label className="label">
                        {ui("الكمية المقبولة (قطع)")}
                        <input
                          className="input"
                          min={0}
                          type="number"
                          value={draft.accepted_quantity}
                          onChange={(event) => {
                            const qty = event.target.value;
                            const cartons = cartonsFromPieces(Number(qty), item);
                            updateDraft(item, {
                              accepted_quantity: qty,
                              accepted_cartons: cartons > 0 ? String(Math.round(cartons * 1000) / 1000) : "",
                            });
                          }}
                        />
                      </label>
                    </div>
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">{ui("الدفعات المتبقية")}</h4>
                      <button
                        className="btn btn-secondary text-sm"
                        onClick={() =>
                          updateDraft(item, {
                            batches: [...draft.batches, { planned_cartons: "", planned_date: today() }],
                          })
                        }
                        type="button"
                      >
                        <Plus className="h-4 w-4" />
                        {ui("دفعة")}
                      </button>
                    </div>
                    {draft.batches.map((batch, index) => (
                      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]" key={index}>
                        <input
                          className="input"
                          min={0}
                          placeholder={ui("كرتون الدفعة")}
                          type="number"
                          value={batch.planned_cartons}
                          onChange={(event) => updateBatch(item, index, { planned_cartons: event.target.value })}
                        />
                        <input
                          className="input"
                          type="date"
                          value={batch.planned_date}
                          onChange={(event) => updateBatch(item, index, { planned_date: event.target.value })}
                        />
                        <button
                          className="btn btn-secondary px-2"
                          disabled={draft.batches.length === 1}
                          onClick={() =>
                            updateDraft(item, { batches: draft.batches.filter((_, rowIndex) => rowIndex !== index) })
                          }
                          type="button"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <div className="text-xs text-[var(--muted)]">
                      {ui("ملاحظة: مجموع (المستلم + الدفعات المتبقية) لازم يساوي الكمية المقبولة.")}
                    </div>
                  </div>
                ) : (
                  <>
                    {itemBatches
                      .filter((batch) => batch.status === "scheduled")
                      .map((batch) => (
                        <div
                          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--border)] p-3"
                          key={batch.id}
                        >
                          <div className="text-sm">
                            <div className="font-medium">
                              {batch.planned_cartons ?? "-"} {ui("كرتونة")} — {batch.planned_quantity} {ui("قطعة")}
                            </div>
                            <div className="text-[var(--muted)]">
                              {ui("تاريخ متوقع:")}{" "}
                              {batch.planned_date ? formatDisplayDate(batch.planned_date) : ui("اليوم")}
                            </div>
                          </div>
                          <button
                            className="btn btn-primary text-sm"
                            disabled={receivingId === batch.id}
                            onClick={() => void receiveBatch(item, batch)}
                            type="button"
                          >
                            <PackageCheck className="h-4 w-4" />
                            {receivingId === batch.id ? ui("جاري التسجيل...") : ui("تم الاستلام")}
                          </button>
                        </div>
                      ))}
                  </>
                )}
                {!itemBatches.some((batch) => batch.status === "scheduled") ? (
                  <p className="text-sm text-[var(--muted)]">{ui("لا توجد دفعات معلقة.")}</p>
                ) : null}
              </div>
            ) : null}

            {item.item_status === "received" ? (
              <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                {ui("تم الاستلام بالكامل — في مخزن الصين")}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
