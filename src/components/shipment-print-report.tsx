"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Download, FileSpreadsheet, Printer } from "lucide-react";
import { downloadExcelWithOptionalImages } from "@/lib/excel-export";
import { ErrorMessage } from "@/components/ui";
import { SHIPMENT_STATUS_LABELS } from "@/lib/constants";
import { formatUsd } from "@/lib/format";
import { displayUnitPerCarton } from "@/lib/shipment-product-quantity";
import { displayInvoiceNumber } from "@/lib/shipment-invoice-number";
import { signedProductImageUrls } from "@/lib/product-images";
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
  const [withImages, setWithImages] = useState(false);
  const [imageUrls, setImageUrls] = useState<Map<string, string>>(new Map());

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
        supabase
          .from("shipment_products")
          .select("*,products(sku,name_ar,unit,image_url)")
          .eq("shipment_id", shipmentId)
          .order("created_at"),
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

  useEffect(() => {
    if (!withImages) {
      setImageUrls(new Map());
      return;
    }
    const paths = products
      .map((row) => row.products?.image_url)
      .filter((path): path is string => Boolean(path));
    void signedProductImageUrls(paths).then(setImageUrls);
  }, [withImages, products]);

  async function download(path: string) {
    const result = await createClient().storage.from(bucket).createSignedUrl(path, 120);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    window.open(result.data.signedUrl, "_blank", "noopener,noreferrer");
  }

  function exportProductsExcel() {
    if (!shipment) return;
    void (async () => {
      const exportRows = products.map((row) => ({
        ACID: shipment.acid,
        SKU: row.products?.sku ?? "-",
        المنتج: row.products?.name_ar ?? "-",
        الكرتين: row.cartons_count,
        الوحدة: displayUnitPerCarton(row.cartons_count, row.quantity),
        "إجمالي القطع": row.quantity,
        مفكك: row.is_disassembled ? "نعم" : "لا",
        جديد: row.is_new_incoming_product ? "نعم" : "لا",
      }));
      const imageUrlList = withImages
        ? products.map((row) => {
            const path = row.products?.image_url;
            return path ? imageUrls.get(path) : null;
          })
        : undefined;

      await downloadExcelWithOptionalImages({
        filename: `shipment-${shipment.acid}-products.xlsx`,
        sheetName: "Products",
        rows: exportRows,
        imageUrls: imageUrlList,
      });
    })();
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
      <div className="report-print-title hidden">
        تقرير الشحنة {invDoc ? displayInvoiceNumber(invDoc.file_name) : shipment.shipment_number} — ACID: {shipment.acid}
      </div>
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
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm">
            <input checked={withImages} onChange={(event) => setWithImages(event.target.checked)} type="checkbox" />
            بالصور
          </label>
          <button className="btn btn-secondary" onClick={exportProductsExcel} type="button">
            <FileSpreadsheet className="h-4 w-4" />
            Excel المنتجات
          </button>
          <button className="btn" onClick={() => window.print()} type="button">
            <Printer className="h-4 w-4" />
            طباعة / PDF
          </button>
        </div>
      </div>

      <div className="print:hidden">
        <ErrorMessage message={error} />
      </div>

      <header className="report-print-section card space-y-2 p-5 text-center">
        <div className="text-sm font-semibold text-[var(--muted)]">Elmaghraby Tracing</div>
        <h1 className="text-2xl font-bold">تقرير الشحنة {shipment.shipment_number}</h1>
        <p className="text-sm font-semibold text-[var(--muted)]">
          {shipment.companies?.name_ar ?? "-"} — ACID: {shipment.acid}
        </p>
      </header>

      <section className="report-print-section card p-5">
        <h2 className="mb-3 text-base font-bold">البيانات الأساسية</h2>
        <div className="grid gap-3 text-sm md:grid-cols-3">
          <Field label="رقم الشحنة" value={invDoc ? displayInvoiceNumber(invDoc.file_name) : "-"} />
          <Field label="ACID" value={shipment.acid} />
          <Field label="الحالة" value={SHIPMENT_STATUS_LABELS[shipment.status]} />
          <Field label="نوع البضاعة" value={shipment.shipment_type ?? "-"} />
          <Field label="ميناء الشحن" value={shipment.shipping_port} />
          <Field label="ميناء الوصول" value={shipment.arrival_port} />
          <Field label="تاريخ الشحن" value={shipment.shipped_at} />
          <Field label="ETA" value={shipment.eta} />
          <Field label="الوزن الكلي (كجم)" value={shipment.total_weight_kg?.toString() ?? "-"} />
          <Field label="إجمالي الكراتين" value={shipment.total_cartons?.toString() ?? "-"} />
          <Field label="قيمة الشحنة (USD)" value={formatUsd(shipment.value_usd)} />
          {shipment.closed_at ? <Field label="تاريخ الإغلاق" value={shipment.closed_at.slice(0, 10)} /> : null}
        </div>
        {shipment.notes ? <p className="mt-3 text-sm text-[var(--muted)]">ملاحظات: {shipment.notes}</p> : null}
      </section>

      {invDoc ? (
        <section className="report-print-section card p-5 print-avoid">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold">ملف INV</h2>
              <p className="text-sm text-[var(--muted)]">{invDoc.file_name}</p>
            </div>
            <button className="btn btn-secondary print:hidden" onClick={() => download(invDoc.storage_path)} type="button">
              <Download className="h-4 w-4" />
              تحميل INV
            </button>
          </div>
        </section>
      ) : (
        <section className="card p-4 text-sm text-[var(--muted)] print:hidden">لا يوجد ملف INV مرفوع لهذه الشحنة.</section>
      )}

      <section className="report-print-section card overflow-auto p-0 report-print-table-wrap print-avoid">
        <h2 className="border-b border-[var(--border)] p-4 text-base font-bold">الحاويات ({containers.length})</h2>
        <table className="report-print-table min-w-full text-sm">
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
            {containers.length ? (
              containers.map((row, index) => (
                <tr className="border-t border-[var(--border)]" key={row.id}>
                  <td className="p-3">{index + 1}</td>
                  <td className="p-3 font-semibold">{row.container_number}</td>
                  <td className="p-3">{row.weight_kg ?? "-"}</td>
                  <td className="p-3">{row.cartons_count ?? "-"}</td>
                  <td className="p-3">{row.notes ?? "-"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="p-4 text-[var(--muted)]" colSpan={5}>
                  لا توجد حاويات.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="card overflow-auto p-0 report-print-table-wrap">
        <h2 className="border-b border-[var(--border)] p-4 text-base font-bold">المنتجات ({products.length})</h2>
        <table className="report-print-table min-w-full text-sm">
          <thead className="table-head">
            <tr>
              {withImages ? <th className="p-3 text-right">صورة</th> : null}
              <th className="p-3 text-right">SKU</th>
              <th className="p-3 text-right">المنتج</th>
              <th className="p-3 text-right">الكرتين</th>
              <th className="p-3 text-right">الوحدة</th>
              <th className="p-3 text-right">إجمالي القطع</th>
              <th className="p-3 text-right">مفكك</th>
              <th className="p-3 text-right">جديد</th>
            </tr>
          </thead>
          <tbody>
            {products.length ? (
              products.map((row) => (
                <tr className="border-t border-[var(--border)]" key={row.id}>
                  {withImages ? (
                    <td className="p-2">
                      {row.products?.image_url && imageUrls.get(row.products.image_url) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt=""
                          className="h-10 w-10 rounded object-cover"
                          src={imageUrls.get(row.products.image_url)}
                        />
                      ) : (
                        "-"
                      )}
                    </td>
                  ) : null}
                  <td className="p-3 font-semibold">{row.products?.sku ?? "-"}</td>
                  <td className="p-3">{row.products?.name_ar ?? "-"}</td>
                  <td className="p-3">{row.cartons_count ?? "-"}</td>
                  <td className="p-3">{displayUnitPerCarton(row.cartons_count, row.quantity)}</td>
                  <td className="p-3">{row.quantity}</td>
                  <td className="p-3">{row.is_disassembled ? "نعم" : "لا"}</td>
                  <td className="p-3">{row.is_new_incoming_product ? "نعم" : "لا"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="p-4 text-[var(--muted)]" colSpan={withImages ? 8 : 7}>
                  لا توجد منتجات.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {cost ? (
        <section className="report-print-section card p-5 print-avoid">
          <h2 className="mb-3 text-base font-bold">مصاريف الإغلاق</h2>
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
    <div className="rounded-md border border-[var(--border)] p-3">
      <div className="text-xs font-semibold text-[var(--muted)]">{label}</div>
      <div className="mt-1 font-bold">{value}</div>
    </div>
  );
}
