"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Printer, Search } from "lucide-react";
import { ErrorMessage, PageHeader } from "@/components/ui";
import { useLanguage } from "@/context/language-context";
import { SHIPMENT_STATUS_LABELS, type ShipmentStatus } from "@/lib/constants";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

type ProductDetail = {
  id: string;
  sku: string;
  name_ar: string;
  category: string | null;
  unit: string;
  is_active: boolean;
};

type ShipmentLine = {
  shipmentId: string;
  shipmentNumber: string;
  eta: string;
  status: ShipmentStatus;
  supplier: string;
  company: string;
  quantity: number;
  containers: number;
};

const MATCH_LIMIT = 80;

function escapeIlike(term: string) {
  return term.replace(/[%_\\]/g, "\\$&");
}

export default function ProductSmartSearchPage() {
  const { tr } = useLanguage();
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<ProductDetail[]>([]);
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [lines, setLines] = useState<ShipmentLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  const hasShipment = lines.length > 0;

  async function loadProductDetails(found: ProductDetail) {
    setProduct(found);
    setLines([]);
    setDetailLoading(true);
    setError("");

    const itemsResult = await createClient()
      .from("shipment_products")
      .select("quantity,shipments(id,shipment_number,eta,status,companies(name_ar),suppliers(name_ar))")
      .eq("product_id", found.id);

    if (itemsResult.error) {
      setDetailLoading(false);
      setError(itemsResult.error.message);
      return;
    }

    const shipmentIds = ((itemsResult.data ?? []) as Array<Record<string, unknown>>)
      .map((item) => (item.shipments as { id?: string } | null)?.id)
      .filter(Boolean) as string[];

    const containerCounts = new Map<string, number>();
    if (shipmentIds.length) {
      const containersResult = await createClient().from("shipment_containers").select("shipment_id").in("shipment_id", shipmentIds);
      if (containersResult.error) {
        setDetailLoading(false);
        setError(containersResult.error.message);
        return;
      }
      (containersResult.data ?? []).forEach((container) => {
        const shipmentId = String(container.shipment_id);
        containerCounts.set(shipmentId, (containerCounts.get(shipmentId) ?? 0) + 1);
      });
    }

    const mapped = ((itemsResult.data ?? []) as Array<Record<string, unknown>>).map((item) => {
      const shipment = item.shipments as {
        id: string;
        shipment_number: string;
        eta: string;
        status: ShipmentStatus;
        companies: { name_ar: string } | null;
        suppliers: { name_ar: string } | null;
      } | null;
      return {
        shipmentId: shipment?.id ?? "",
        shipmentNumber: shipment?.shipment_number ?? "-",
        eta: shipment?.eta ?? "-",
        status: shipment?.status ?? "in_sea",
        supplier: shipment?.suppliers?.name_ar ?? "-",
        company: shipment?.companies?.name_ar ?? "-",
        quantity: Number(item.quantity ?? 0),
        containers: shipment?.id ? containerCounts.get(shipment.id) ?? 0 : 0,
      };
    });

    setLines(mapped);
    setDetailLoading(false);
  }

  async function search(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setError("");
    setProduct(null);
    setLines([]);
    setMatches([]);

    if (!query.trim()) return;

    if (!isSupabaseConfigured()) {
      setError("اضبط ملف .env.local أولا بقيم Supabase.");
      return;
    }

    setLoading(true);
    const term = escapeIlike(query.trim());
    const filter = `sku.ilike.%${term}%,name_ar.ilike.%${term}%,category.ilike.%${term}%,barcode.ilike.%${term}%`;

    const productsResult = await createClient()
      .from("products")
      .select("id,sku,name_ar,category,unit,is_active")
      .or(filter)
      .order("name_ar")
      .limit(MATCH_LIMIT);

    setLoading(false);

    if (productsResult.error) {
      setError(productsResult.error.message);
      return;
    }

    const found = (productsResult.data ?? []) as ProductDetail[];
    if (!found.length) {
      setError("لم يُعثر على منتج بهذا البحث.");
      return;
    }

    setMatches(found);

    if (found.length === 1) {
      await loadProductDetails(found[0]);
    }
  }

  const printTitle = useMemo(() => (product ? `تقرير منتج: ${product.sku} — ${product.name_ar}` : ""), [product]);

  return (
    <div className="report-print-root space-y-5">
      <div className="report-print-title hidden">{printTitle}</div>

      <div className="print:hidden">
        <PageHeader
          title={tr("بحث المنتجات الذكي", "Smart product search")}
          description={tr("ابحث عن أي منتج — داخل شحنة أو غير مرتبط بشحنة.", "Search any product (in shipments or standalone).")}
        />
      </div>

      <div className="print:hidden">
        <ErrorMessage message={error} />
      </div>

      <form className="card grid gap-3 p-4 md:grid-cols-[1fr_auto] print:hidden" onSubmit={search}>
        <input className="input" placeholder="ابحث بالاسم أو SKU أو التصنيف أو الباركود" value={query} onChange={(event) => setQuery(event.target.value)} />
        <button className="btn" disabled={loading} type="submit">
          <Search className="h-4 w-4" />
          {loading ? "..." : "بحث"}
        </button>
      </form>

      {matches.length > 1 ? (
        <section className="card overflow-auto print:hidden">
          <div className="border-b border-[var(--border)] p-3 text-sm text-[var(--muted)]">
            وُجد {matches.length} منتج{matches.length >= MATCH_LIMIT ? ` (أول ${MATCH_LIMIT} نتيجة — حدّد البحث)` : ""} — اختر منتجا لعرض التفاصيل:
          </div>
          <table className="min-w-full text-sm">
            <thead className="table-head">
              <tr>
                <th className="p-3 text-right">SKU</th>
                <th className="p-3 text-right">الاسم</th>
                <th className="p-3 text-right">التصنيف</th>
                <th className="p-3 text-right">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((row) => (
                <tr
                  className={`border-t border-[var(--border)] ${product?.id === row.id ? "bg-emerald-50/60" : ""}`}
                  key={row.id}
                >
                  <td className="p-3 font-semibold">{row.sku}</td>
                  <td className="p-3">{row.name_ar}</td>
                  <td className="p-3">{row.category ?? "—"}</td>
                  <td className="p-3">
                    <button
                      className="btn btn-secondary px-2 py-1 text-xs"
                      disabled={detailLoading && product?.id === row.id}
                      onClick={() => void loadProductDetails(row)}
                      type="button"
                    >
                      {detailLoading && product?.id === row.id ? "..." : "عرض"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {product ? (
        <section className="report-print-section card space-y-4 p-4 print-avoid">
          <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
            <h2 className="text-lg font-bold">تفاصيل المنتج</h2>
            <button className="btn btn-secondary text-sm" onClick={() => window.print()} type="button">
              <Printer className="h-4 w-4" />
              طباعة التقرير
            </button>
          </div>
          {detailLoading ? <p className="text-sm text-[var(--muted)]">جاري تحميل بيانات الشحنات...</p> : null}
          <div className="grid gap-3 text-sm md:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="text-[var(--muted)]">SKU</div>
              <div className="font-bold">{product.sku}</div>
            </div>
            <div>
              <div className="text-[var(--muted)]">الاسم</div>
              <div className="font-bold">{product.name_ar}</div>
            </div>
            <div>
              <div className="text-[var(--muted)]">التصنيف</div>
              <div>{product.category ?? "—"}</div>
            </div>
            <div>
              <div className="text-[var(--muted)]">الوحدة / الحالة</div>
              <div>
                {product.unit} — {product.is_active ? "نشط" : "متوقف"}
              </div>
            </div>
          </div>

          {!detailLoading && !hasShipment ? (
            <p className="rounded-md border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">
              هذا المنتج غير مرتبط بأي شحنة حاليا.
            </p>
          ) : null}

          {!detailLoading && hasShipment ? (
            <div className="overflow-auto report-print-table-wrap">
              <table className="report-print-table min-w-full text-sm">
                <thead className="table-head">
                  <tr>
                    <th className="p-3 text-right">الشحنة</th>
                    <th className="p-3 text-right">ETA</th>
                    <th className="p-3 text-right">الحالة</th>
                    <th className="p-3 text-right">المورد</th>
                    <th className="p-3 text-right">الشركة</th>
                    <th className="p-3 text-right">الكمية</th>
                    <th className="p-3 text-right">الحاويات</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((row) => (
                    <tr className="border-t border-[var(--border)]" key={row.shipmentId}>
                      <td className="p-3">
                        <Link className="font-semibold text-[#0f766e] print:hidden" href={`/shipments/${row.shipmentId}`}>
                          {row.shipmentNumber}
                        </Link>
                        <span className="hidden print:inline">{row.shipmentNumber}</span>
                      </td>
                      <td className="p-3">{row.eta}</td>
                      <td className="p-3">
                        <span className={`status-badge status-${row.status}`}>{SHIPMENT_STATUS_LABELS[row.status]}</span>
                      </td>
                      <td className="p-3">{row.supplier}</td>
                      <td className="p-3">{row.company}</td>
                      <td className="p-3">{row.quantity}</td>
                      <td className="p-3">{row.containers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : !loading && !matches.length ? (
        <div className="card p-4 text-sm text-[var(--muted)] print:hidden">ابدأ بالبحث عن منتج.</div>
      ) : null}
    </div>
  );
}
