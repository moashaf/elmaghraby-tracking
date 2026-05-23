"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Printer, Search } from "lucide-react";
import { ErrorMessage, PageHeader } from "@/components/ui";
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

export default function ProductSmartSearchPage() {
  const [query, setQuery] = useState("");
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [lines, setLines] = useState<ShipmentLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const hasShipment = lines.length > 0;

  async function search(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setError("");
    setProduct(null);
    setLines([]);

    if (!query.trim()) return;

    if (!isSupabaseConfigured()) {
      setError("اضبط ملف .env.local أولا بقيم Supabase.");
      return;
    }

    setLoading(true);
    const term = query.trim();
    const productsResult = await createClient()
      .from("products")
      .select("id,sku,name_ar,category,unit,is_active")
      .or(`sku.ilike.%${term}%,name_ar.ilike.%${term}%`)
      .limit(1)
      .maybeSingle();

    if (productsResult.error) {
      setLoading(false);
      setError(productsResult.error.message);
      return;
    }

    if (!productsResult.data) {
      setLoading(false);
      setError("لم يُعثر على منتج بهذا البحث.");
      return;
    }

    const found = productsResult.data as ProductDetail;
    setProduct(found);

    const itemsResult = await createClient()
      .from("shipment_products")
      .select("quantity,shipments(id,shipment_number,eta,status,companies(name_ar),suppliers(name_ar))")
      .eq("product_id", found.id);

    if (itemsResult.error) {
      setLoading(false);
      setError(itemsResult.error.message);
      return;
    }

    const shipmentIds = ((itemsResult.data ?? []) as Array<Record<string, unknown>>)
      .map((item) => (item.shipments as { id?: string } | null)?.id)
      .filter(Boolean) as string[];

    let containerCounts = new Map<string, number>();
    if (shipmentIds.length) {
      const containersResult = await createClient().from("shipment_containers").select("shipment_id").in("shipment_id", shipmentIds);
      if (containersResult.error) {
        setLoading(false);
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
    setLoading(false);
  }

  const printTitle = useMemo(() => (product ? `تقرير منتج: ${product.sku} — ${product.name_ar}` : ""), [product]);

  return (
    <div className="report-print-root space-y-5">
      <div className="report-print-title hidden">{printTitle}</div>

      <PageHeader title="بحث المنتجات الذكي" description="ابحث عن أي منتج — داخل شحنة أو غير مرتبط بشحنة." />

      <ErrorMessage message={error} />

      <form className="card grid gap-3 p-4 md:grid-cols-[1fr_auto] print:hidden" onSubmit={search}>
        <input className="input" placeholder="ابحث بالاسم أو SKU" value={query} onChange={(event) => setQuery(event.target.value)} />
        <button className="btn" disabled={loading} type="submit">
          <Search className="h-4 w-4" />
          {loading ? "..." : "بحث"}
        </button>
      </form>

      {product ? (
        <section className="card space-y-4 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
            <h2 className="text-lg font-bold">تفاصيل المنتج</h2>
            <button className="btn btn-secondary text-sm" onClick={() => window.print()} type="button">
              <Printer className="h-4 w-4" />
              طباعة التقرير
            </button>
          </div>
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

          {!hasShipment ? (
            <p className="rounded-md border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">
              هذا المنتج غير مرتبط بأي شحنة حاليا.
            </p>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
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
          )}
        </section>
      ) : (
        <div className="card p-4 text-sm text-[var(--muted)] print:hidden">ابدأ بالبحث عن منتج.</div>
      )}
    </div>
  );
}
