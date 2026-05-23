"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Anchor, Boxes, CheckCircle2, Package, Plus, ShipWheel } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { SHIPMENT_STATUS_LABELS } from "@/lib/constants";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Shipment } from "@/lib/types";

type ContainerRow = {
  id: string;
  shipment_id: string;
};

type IncomingProductRow = {
  is_new_incoming_product: boolean;
  shipments: Pick<Shipment, "status"> | null;
};

export default function DashboardPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [containers, setContainers] = useState<ContainerRow[]>([]);
  const [incomingProducts, setIncomingProducts] = useState<IncomingProductRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured()) {
        setLoading(false);
        return;
      }

      const supabase = createClient();
      await supabase.rpc("auto_move_shipments_to_customs");
      const [shipmentsResult, containersResult, productsResult] = await Promise.all([
        supabase
          .from("shipments")
          .select("*,companies(name_ar),suppliers(name_ar)")
          .order("created_at", { ascending: false }),
        supabase.from("shipment_containers").select("id,shipment_id"),
        supabase
          .from("shipment_products")
          .select("is_new_incoming_product,shipments(status)")
          .eq("is_new_incoming_product", true),
      ]);

      setShipments((shipmentsResult.data as Shipment[] | null) ?? []);
      setContainers((containersResult.data as ContainerRow[] | null) ?? []);
      setIncomingProducts((productsResult.data as IncomingProductRow[] | null) ?? []);
      setLoading(false);
    }

    load();
  }, []);

  const { stats, recentShipments, overdueShipments } = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const openShipmentIds = new Set(shipments.filter((shipment) => shipment.status !== "closed").map((shipment) => shipment.id));
    const containerCountByShipment = containers.reduce((acc, container) => {
      acc.set(container.shipment_id, (acc.get(container.shipment_id) ?? 0) + 1);
      return acc;
    }, new Map<string, number>());

    const countContainers = (shipmentIds: string[]) =>
      shipmentIds.reduce((total, shipmentId) => total + (containerCountByShipment.get(shipmentId) ?? 0), 0);

    const inSea = shipments.filter((shipment) => shipment.status === "in_sea");
    const customs = shipments.filter((shipment) => shipment.status === "customs");
    const closed = shipments.filter((shipment) => shipment.status === "closed");
    const overdue = shipments.filter((shipment) => shipment.status !== "closed" && shipment.eta < today);
    const openContainerCount = containers.filter((container) => openShipmentIds.has(container.shipment_id)).length;
    const newIncomingProducts = incomingProducts.filter((row) => row.shipments?.status !== "closed").length;

    return {
      recentShipments: shipments.slice(0, 8),
      overdueShipments: overdue.slice(0, 5),
      stats: [
        {
          label: "في البحر",
          value: inSea.length,
          helper: `الحاويات: ${countContainers(inSea.map((shipment) => shipment.id))}`,
          href: "/shipments?status=in_sea",
          icon: ShipWheel,
        },
        {
          label: "وصلت / جمارك",
          value: customs.length,
          helper: `الحاويات: ${countContainers(customs.map((shipment) => shipment.id))}`,
          href: "/shipments?status=customs",
          icon: Boxes,
        },
        {
          label: "متأخرة",
          value: overdue.length,
          helper: `الحاويات: ${countContainers(overdue.map((shipment) => shipment.id))}`,
          href: "/shipments",
          icon: AlertTriangle,
        },
        {
          label: "مقفلة",
          value: closed.length,
          helper: `الحاويات: ${countContainers(closed.map((shipment) => shipment.id))}`,
          href: "/shipments?status=closed",
          icon: CheckCircle2,
        },
        {
          label: "حاويات واردة",
          value: openContainerCount,
          helper: "في الشحنات المفتوحة",
          href: "/shipments",
          icon: Anchor,
        },
        {
          label: "منتجات جديدة واردة",
          value: newIncomingProducts,
          helper: "معلمة كمنتج وارد جديد",
          href: "/reports/new-products",
          icon: Package,
        },
      ],
    };
  }, [containers, incomingProducts, shipments]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="لوحة التحكم"
        description="نظرة تشغيلية على الشحنات والحاويات والمنتجات الواردة."
        actions={
          <Link className="btn" href="/shipments/new">
            <Plus className="h-4 w-4" />
            شحنة جديدة
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
        {stats.map((item) => {
          const Icon = item.icon;
          return (
          <Link className="card p-5 transition hover:-translate-y-0.5 hover:border-[#0f766e]" href={item.href} key={item.label}>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--muted)]">{item.label}</span>
              <Icon className="h-5 w-5 text-[#0f766e]" />
            </div>
            <div className="mt-5 text-4xl font-bold">{item.value}</div>
            <p className="mt-1 text-sm text-[var(--muted)]">{item.helper}</p>
          </Link>
          );
        })}
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border)] p-4">
            <h2 className="font-bold">الشحنات</h2>
            <Link className="text-sm font-semibold text-[#0f766e]" href="/shipments">
              عرض الكل
            </Link>
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <tbody>
                {loading ? (
                  <tr>
                    <td className="p-4 text-[var(--muted)]" colSpan={4}>جاري التحميل...</td>
                  </tr>
                ) : recentShipments.length ? (
                  recentShipments.map((shipment) => (
                    <tr className="row-hover border-t border-[var(--border)]" key={shipment.id}>
                      <td className="p-3 font-semibold">
                        <Link href={`/shipments/${shipment.id}`}>{shipment.shipment_number}</Link>
                      </td>
                      <td className="p-3">{shipment.companies?.name_ar ?? "-"}</td>
                      <td className="p-3">{shipment.eta}</td>
                      <td className="p-3">
                        <span className={`status-badge status-${shipment.status}`}>{SHIPMENT_STATUS_LABELS[shipment.status]}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="p-4 text-[var(--muted)]" colSpan={4}>لا توجد شحنات بعد.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-[var(--border)] p-4">
            <h2 className="font-bold">متأخرة</h2>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {overdueShipments.length ? overdueShipments.map((shipment) => (
              <Link className="flex items-center justify-between gap-3 p-4 text-sm hover:bg-slate-50" href={`/shipments/${shipment.id}`} key={shipment.id}>
                <span className="font-semibold">{shipment.shipment_number}</span>
                <span className="text-red-700">{shipment.eta}</span>
              </Link>
            )) : (
              <div className="p-4 text-sm text-[var(--muted)]">لا توجد شحنات متأخرة.</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
