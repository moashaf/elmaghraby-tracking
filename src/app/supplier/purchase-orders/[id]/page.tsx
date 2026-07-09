"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { PurchaseOrderStatusPill } from "@/components/purchase-order-status-pill";
import { SupplierPoWorkspace } from "@/components/supplier-po-workspace";
import { ErrorMessage, PageHeader } from "@/components/ui";
import { useLanguage } from "@/context/language-context";
import { useProfile } from "@/context/profile-context";
import { formatDisplayDate } from "@/lib/format";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type {
  PurchaseOrder,
  PurchaseOrderDeliveryBatch,
  PurchaseOrderItem,
  PurchaseOrderReceipt,
} from "@/lib/types";

export default function SupplierPurchaseOrderDetailsPage() {
  const params = useParams<{ id: string }>();
  const { ui } = useLanguage();
  const { isAdmin } = useProfile();
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [items, setItems] = useState<PurchaseOrderItem[]>([]);
  const [batches, setBatches] = useState<PurchaseOrderDeliveryBatch[]>([]);
  const [receipts, setReceipts] = useState<PurchaseOrderReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      setError(ui("اضبط ملف .env.local أولا بقيم Supabase."));
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const [poResult, itemsResult, receiptsResult] = await Promise.all([
      supabase.from("purchase_orders").select("*,companies(name_ar)").eq("id", params.id).single(),
      supabase
        .from("purchase_order_items")
        .select("*,products(sku,name_ar,unit)")
        .eq("purchase_order_id", params.id)
        .order("created_at"),
      supabase
        .from("purchase_order_receipts")
        .select("*")
        .eq("purchase_order_id", params.id)
        .order("received_date", { ascending: false }),
    ]);

    if (poResult.error) {
      setLoading(false);
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
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  if (loading) return <p className="text-sm text-[var(--muted)]">{ui("جاري التحميل...")}</p>;
  if (!po) return <ErrorMessage message={error || ui("أمر الشراء غير موجود.")} />;

  return (
    <div className="space-y-5">
      <PageHeader
        title={po.po_number}
        description={po.companies?.name_ar ?? ""}
        actions={
          <div className="flex flex-wrap gap-2">
            <PurchaseOrderStatusPill status={po.status} />
            {isAdmin ? (
              <Link className="btn btn-secondary text-sm" href={`/purchase-orders/${po.id}`}>
                <ArrowRight className="h-4 w-4" />
                {ui("عرض كموظف")}
              </Link>
            ) : null}
            <Link className="btn btn-secondary text-sm" href="/supplier/purchase-orders">
              <ArrowRight className="h-4 w-4" />
              {ui("رجوع")}
            </Link>
          </div>
        }
      />
      <ErrorMessage message={error} />

      <div className="card grid gap-4 p-5 md:grid-cols-2">
        <div>
          <div className="text-xs text-[var(--muted)]">{ui("تاريخ الطلب")}</div>
          <div className="font-semibold">{formatDisplayDate(po.order_date)}</div>
        </div>
        {po.notes ? (
          <div className="md:col-span-2">
            <div className="text-xs text-[var(--muted)]">{ui("ملاحظات")}</div>
            <div>{po.notes}</div>
          </div>
        ) : null}
      </div>

      <SupplierPoWorkspace batches={batches} items={items} onSaved={() => void load()} po={po} receipts={receipts} />
    </div>
  );
}
