"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Save } from "lucide-react";
import { ErrorMessage } from "@/components/ui";
import { useLanguage } from "@/context/language-context";
import { createClient } from "@/lib/supabase/client";
import type { PurchaseOrderReceipt, ShipmentAllocation, ShipmentProduct } from "@/lib/types";

type Props = {
  shipmentId: string;
  supplierId: string;
  products: ShipmentProduct[];
  allocations: ShipmentAllocation[];
  canWrite: boolean;
  onSaved: () => void;
};

type AllocationDraft = {
  purchase_order_receipt_id: string;
  shipment_product_id: string;
  allocated_quantity: string;
  allocated_cartons: string;
  notes: string;
};

export function ShipmentAllocationsPanel({
  shipmentId,
  supplierId,
  products,
  allocations,
  canWrite,
  onSaved,
}: Props) {
  const { ui } = useLanguage();
  const [receipts, setReceipts] = useState<PurchaseOrderReceipt[]>([]);
  const [loadingReceipts, setLoadingReceipts] = useState(true);
  const [draft, setDraft] = useState<AllocationDraft>({
    purchase_order_receipt_id: "",
    shipment_product_id: products[0]?.id ?? "",
    allocated_quantity: "",
    allocated_cartons: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const allocatedByReceipt = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of allocations) {
      map.set(row.purchase_order_receipt_id, (map.get(row.purchase_order_receipt_id) ?? 0) + Number(row.allocated_quantity));
    }
    return map;
  }, [allocations]);

  useEffect(() => {
    void (async () => {
      setLoadingReceipts(true);
      const supabase = createClient();
      const poResult = await supabase
        .from("purchase_orders")
        .select("id")
        .eq("supplier_id", supplierId)
        .in("status", ["confirmed", "partially_received", "received", "over_received"]);

      const poIds = (poResult.data ?? []).map((row) => row.id as string);
      if (!poIds.length) {
        setReceipts([]);
        setLoadingReceipts(false);
        return;
      }

      const receiptsResult = await supabase
        .from("purchase_order_receipts")
        .select("*,purchase_order_items(product_id,products(sku,name_ar))")
        .in("purchase_order_id", poIds)
        .order("received_date", { ascending: false });

      setReceipts((receiptsResult.data ?? []) as PurchaseOrderReceipt[]);
      setLoadingReceipts(false);
    })();
  }, [supplierId]);

  const availableReceipts = useMemo(
    () =>
      receipts.filter((receipt) => {
        const allocated = allocatedByReceipt.get(receipt.id) ?? 0;
        return allocated < Number(receipt.received_quantity);
      }),
    [receipts, allocatedByReceipt]
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;
    setError("");

    const qty = Number(draft.allocated_quantity);
    if (!draft.purchase_order_receipt_id || !draft.shipment_product_id || qty <= 0) {
      setError(ui("اختر الاستلام وسطر الشحنة وأدخل كمية صحيحة."));
      return;
    }

    const shipmentProduct = products.find((row) => row.id === draft.shipment_product_id);
    const receipt = receipts.find((row) => row.id === draft.purchase_order_receipt_id);
    const receiptProductId = receipt?.purchase_order_items?.product_id;
    if (!shipmentProduct || !receiptProductId || shipmentProduct.product_id !== receiptProductId) {
      setError(ui("المنتج في الاستلام يجب أن يطابق منتج سطر الشحنة."));
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const result = await supabase.from("shipment_allocations").insert({
      purchase_order_receipt_id: draft.purchase_order_receipt_id,
      shipment_id: shipmentId,
      shipment_product_id: draft.shipment_product_id,
      allocated_quantity: qty,
      allocated_cartons: draft.allocated_cartons ? Number(draft.allocated_cartons) : null,
      notes: draft.notes.trim() || null,
      created_by: user?.id ?? null,
    });

    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }

    setDraft({
      purchase_order_receipt_id: "",
      shipment_product_id: products[0]?.id ?? "",
      allocated_quantity: "",
      allocated_cartons: "",
      notes: "",
    });
    onSaved();
  }

  return (
    <div className="space-y-4">
      <ErrorMessage message={error} />

      {loadingReceipts ? <p className="text-sm text-[var(--muted)]">{ui("جاري التحميل...")}</p> : null}

      {allocations.length ? (
        <div className="space-y-2">
          <h4 className="font-semibold">{ui("التخصيصات الحالية")}</h4>
          {allocations.map((row) => (
            <div className="rounded-md border border-[var(--border)] p-3 text-sm" key={row.id}>
              <div className="font-medium">
                {row.purchase_order_receipts?.purchase_order_items?.products?.sku} —{" "}
                {row.purchase_order_receipts?.purchase_order_items?.products?.name_ar}
              </div>
              <div className="text-[var(--muted)]">
                {ui("الكمية")}: {row.allocated_quantity}
                {row.allocated_cartons ? ` | ${row.allocated_cartons} ${ui("كرتونة")}` : ""}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--muted)]">{ui("لا توجد تخصيصات بعد.")}</p>
      )}

      {canWrite ? (
        <form className="card grid gap-3 p-4 md:grid-cols-2" onSubmit={submit}>
          <label className="label md:col-span-2">
            {ui("استلام من المستودع")}
            <select
              className="input"
              value={draft.purchase_order_receipt_id}
              onChange={(event) => setDraft((current) => ({ ...current, purchase_order_receipt_id: event.target.value }))}
            >
              <option value="">{ui("اختر استلامًا")}</option>
              {availableReceipts.map((receipt) => {
                const allocated = allocatedByReceipt.get(receipt.id) ?? 0;
                const remaining = Number(receipt.received_quantity) - allocated;
                return (
                  <option key={receipt.id} value={receipt.id}>
                    {receipt.purchase_order_items?.products?.sku} — {remaining} {ui("متبقي")} ({receipt.received_date})
                  </option>
                );
              })}
            </select>
          </label>
          <label className="label md:col-span-2">
            {ui("سطر الشحنة")}
            <select
              className="input"
              value={draft.shipment_product_id}
              onChange={(event) => setDraft((current) => ({ ...current, shipment_product_id: event.target.value }))}
            >
              {products.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.products?.sku} — {row.products?.name_ar}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            {ui("الكمية المخصصة")}
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={draft.allocated_quantity}
              onChange={(event) => setDraft((current) => ({ ...current, allocated_quantity: event.target.value }))}
            />
          </label>
          <label className="label">
            {ui("الكراتين")}
            <input
              className="input"
              type="number"
              min="0"
              value={draft.allocated_cartons}
              onChange={(event) => setDraft((current) => ({ ...current, allocated_cartons: event.target.value }))}
            />
          </label>
          <div className="md:col-span-2">
            <button className="btn btn-primary" disabled={saving} type="submit">
              <Save className="h-4 w-4" />
              {saving ? ui("جاري الحفظ...") : ui("حفظ التخصيص")}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
