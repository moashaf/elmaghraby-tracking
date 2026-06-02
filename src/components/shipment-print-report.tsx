"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Download, Printer } from "lucide-react";
import { ErrorMessage } from "@/components/ui";
import { SHIPMENT_STATUS_LABELS } from "@/lib/constants";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Shipment, ShipmentContainer, ShipmentCost, ShipmentDocument, ShipmentProduct } from "@/lib/types";

const bucket = "container-files";

export function ShipmentPrintReport({ shipmentId }: { shipmentId: string }) {
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [containers, setContainers] = useState<ShipmentContainer[]>([]);
  const [products, setProducts] = useState<ShipmentProduct[]>([]);
  const [cost, setCost] = useState<ShipmentCost | null>(null);
  const [documents, setDocuments] = useState<ShipmentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured()) {
        setLoading(false);
        setError("اضبط ملف .env.local أولا بقيم Supabase.");
        return;
      }

      setLoading(true);
      setError("");
      const supabase = createClient();
      const [shipmentResult, containersResult, productsResult, costResult, documentsResult] = await Promise.all([
        supabase.from("shipments").select("*,companies(name_ar),suppliers(name_ar)").eq("id", shipmentId).single(),
        supabase.from("shipment_containers").select("*").eq("shipment_id", shipmentId).order("created_at"),
        supabase.from("shipment_products").select("*,products(sku,name_ar,unit)").eq("shipment_id", shipmentId).order("created_at"),
        supabase.from("shipment_costs").select("*").eq("shipment_id", shipmentId).maybeSingle(),
        supabase.from("shipment_documents").select("*").eq("shipment_id", shipmentId).order("uploaded_at", { ascending: false }),
      ]);
      setLoading(false);

      if (shipmentResult.error) {
        setError(shipmentResult.error.message);
        return;
      }

      setShipment(shipmentResult.data as Shipment);
      setContainers((containersResult.data ?? []) as ShipmentContainer[]);
      setProducts((productsResult.data ?? []) as ShipmentProduct[]);
      setCost((costResult.data as ShipmentCost | null) ?? null);
      setDocuments((documentsResult.data ?? []) as ShipmentDocument[]);
    }

    void load();
  }, [shipmentId]);

  async function download(path: string) {
    const result = await createClient().storage.from(bucket).createSignedUrl(path, 120);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    window.open(result.data.signedUrl, "_blank", "noopener,noreferrer");
  }

  if (loading) {
    return <div className="card p-5 text-sm text-[var(--muted)]">جاري تحميل التقرير...</div>;
  }

  if (!shipment) {
    return <ErrorMessage message={error || "الشحنة غير موجودة."} />;
  }

  const invDoc = documents.find((doc) => doc.doc_type.toUpperCase() === "INV");

  return (
    <div className="report-print-root space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap gap-2">
          <Link className="btn btn-secondary" href="/shipments">
            <ArrowRight className="h-4 w-4" />
            رجوع للشحنات
          </Link>
          <Link className="btn btn-secondary" href={`/shipments/${shipmentId}`}>
            تفاصيل الشحنة
          </Link>
        </div>
        <button className="btn" onClick={() => window.print()} type="button">
          <Printer className="h-4 w-4" />
          طباعة / PDF
        </button>
      </div>

      <ErrorMessage message={error} />

      <header className="report-print-title card space-y-2 p-5 text-center">
        <div className="text-sm text-[var(--muted)]">Elmaghraby Tracing</div>
        <h1 className="text-2xl font-bold">تقرير الشحنة {shipment.shipment_number}</h1>
        <p className="text-sm text-[var(--muted)]">
          {shipment.companies?.name_ar ?? "-"} — {shipment.suppliers?.name_ar ?? "-"}
        </p>
      </header>

      <section className="card p-5">
        <h2 className="mb-3 font-bold">البيانات الأساسية</h2>
        <div className="grid gap-3 text-sm md:grid-cols-3">
          <Field label="ACID" value={shipment.acid} />
          <Field label="الحالة" value={SHIPMENT_STATUS_LABELS[shipment.status]} />
          <Field label="نوع البضاعة" value={shipment.shipment_type ?? "-"} />
          <Field label="ميناء الشحن" value={shipment.shipping_port} />
          <Field label="ميناء الوصول" value={shipment.arrival_port} />
          <Field label="تاريخ الشحن" value={shipment.shipped_at} />
          <Field label="ETA" value={shipment.eta} />
          <Field label="الوزن الكلي (كجم)" value={shipment.total_weight_kg?.toString() ?? "-"} />
          <Field label="إجمالي الكراتين" value={shipment.total_cartons?.toString() ?? "-"} />
          {shipment.closed_at ? <Field label="تاريخ الإغلاق" value={shipment.closed_at.slice(0, 10)} /> : null}
        </div>
        {shipment.notes ? <p className="mt-3 text-sm text-[var(--muted)]">ملاحظات: {shipment.notes}</p> : null}
      </section>

      {invDoc ? (
        <section className="card p-5 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold">ملف INV</h2>
              <p className="text-sm text-[var(--muted)]">{invDoc.file_name}</p>
            </div>
            <button className="btn btn-secondary" onClick={() => download(invDoc.storage_path)} type="button">
              <Download className="h-4 w-4" />
              تحميل INV
            </button>
          </div>
        </section>
      ) : null}

      <section className="card overflow-auto p-0">
        <h2 className="border-b border-[var(--border)] p-4 font-bold">الحاويات ({containers.length})</h2>
        <table className="min-w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="p-3 text-right">#</th>
              <th className="p-3 text-right">رقم الحاوية</th>
              <th className="p-3 text-right">الوزن</th>
              <th className="p-3 text-right">الكرتين</th>
              <th className="p-3 text-right">ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            {containers.length ? containers.map((row, index) => (
              <tr className="border-t border-[var(--border)]" key={row.id}>
                <td className="p-3">{index + 1}</td>
                <td className="p-3 font-semibold">{row.container_number}</td>
                <td className="p-3">{row.weight_kg ?? "-"}</td>
                <td className="p-3">{row.cartons_count ?? "-"}</td>
                <td className="p-3">{row.notes ?? "-"}</td>
              </tr>
            )) : (
              <tr><td className="p-4 text-[var(--muted)]" colSpan={5}>لا توجد حاويات.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="card overflow-auto p-0 print:hidden">
        <h2 className="border-b border-[var(--border)] p-4 font-bold">المنتجات ({products.length})</h2>
        <table className="min-w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="p-3 text-right">SKU</th>
              <th className="p-3 text-right">المنتج</th>
              <th className="p-3 text-right">الكمية</th>
              <th className="p-3 text-right">الكرتين</th>
              <th className="p-3 text-right">جديد</th>
            </tr>
          </thead>
          <tbody>
            {products.length ? products.map((row) => (
              <tr className="border-t border-[var(--border)]" key={row.id}>
                <td className="p-3 font-semibold">{row.products?.sku ?? "-"}</td>
                <td className="p-3">{row.products?.name_ar ?? "-"}</td>
                <td className="p-3">{row.quantity}</td>
                <td className="p-3">{row.cartons_count ?? "-"}</td>
                <td className="p-3">{row.is_new_incoming_product ? "نعم" : "لا"}</td>
              </tr>
            )) : (
              <tr><td className="p-4 text-[var(--muted)]" colSpan={5}>لا توجد منتجات.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      {cost ? (
        <section className="card p-5">
          <h2 className="mb-3 font-bold">مصاريف الإغلاق</h2>
          <div className="grid gap-3 text-sm md:grid-cols-3">
            <Field label="جمارك" value={Number(cost.customs_cost).toLocaleString("ar-EG")} />
            <Field label="شحن" value={Number(cost.shipping_cost).toLocaleString("ar-EG")} />
            <Field label="تخليص" value={Number(cost.clearance_cost).toLocaleString("ar-EG")} />
            <Field label="نقل داخلي" value={Number(cost.local_transport_cost).toLocaleString("ar-EG")} />
            <Field label="مصروفات أخرى" value={Number(cost.other_expenses).toLocaleString("ar-EG")} />
            <Field label="الإجمالي" value={Number(cost.total_cost).toLocaleString("ar-EG")} />
          </div>
          {cost.closing_notes ? <p className="mt-3 text-sm text-[var(--muted)]">{cost.closing_notes}</p> : null}
        </section>
      ) : null}

      <footer className="text-center text-xs text-[var(--muted)] print:mt-8">
        تاريخ الطباعة: {new Date().toLocaleDateString("ar-EG")}
      </footer>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--border)] p-3 print-avoid">
      <div className="text-xs text-[var(--muted)]">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}
