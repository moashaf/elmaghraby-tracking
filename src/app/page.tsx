"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Anchor,
  Boxes,
  CheckCircle2,
  Package,
  Plus,
  Layers3,
  ShipWheel,
  TrendingUp,
} from "lucide-react";
import { ErrorMessage, PageHeader } from "@/components/ui";
import { useLanguage } from "@/context/language-context";
import { SHIPMENT_STATUS_LABELS, SHIPMENT_STATUS_LABELS_EN } from "@/lib/constants";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { getSupabaseErrorMessage } from "@/lib/supabase/errors";
import type { Shipment } from "@/lib/types";

type ContainerRow = {
  id: string;
  shipment_id: string;
};

type FlaggedProductRow = {
  shipments: Pick<Shipment, "status"> | Array<Pick<Shipment, "status">> | null;
};

function relatedShipmentStatus(row: FlaggedProductRow) {
  const shipment = Array.isArray(row.shipments) ? row.shipments[0] : row.shipments;
  return shipment?.status;
}

function formatDate(iso: string | null | undefined, lang: "ar" | "en") {
  if (!iso) return "-";
  if (lang === "ar") return iso;
  // ISO date "YYYY-MM-DD" -> "DD/MM/YYYY" for readability
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function StatusLabel({ status, lang }: { status: Shipment["status"]; lang: "ar" | "en" }) {
  const label = lang === "ar" ? SHIPMENT_STATUS_LABELS[status] : SHIPMENT_STATUS_LABELS_EN[status];
  return <span className={`status-badge status-${status}`}>{label}</span>;
}

function VisualBars({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: number; color: string }>;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-[var(--muted)]" />
          <h3 className="font-bold">{title}</h3>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">{item.label}</span>
              <span className="text-[var(--muted)]">{item.value}</span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-2 rounded-full"
                style={{
                  width: `${Math.round((item.value / max) * 100)}%`,
                  background: item.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [containers, setContainers] = useState<ContainerRow[]>([]);
  const [incomingProducts, setIncomingProducts] = useState<FlaggedProductRow[]>([]);
  const [disassembledProducts, setDisassembledProducts] = useState<FlaggedProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { t, lang } = useLanguage();

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured()) {
        setLoading(false);
        return;
      }

      try {
        const supabase = createClient();
        await supabase.rpc("auto_move_shipments_to_customs");
        const [shipmentsResult, containersResult, newProductsResult, disassembledResult] = await Promise.all([
          supabase
            .from("shipments")
            .select("*,companies(name_ar),suppliers(name_ar)")
            .order("created_at", { ascending: false }),
          supabase.from("shipment_containers").select("id,shipment_id"),
          supabase
            .from("shipment_products")
            .select("shipments(status)")
            .eq("is_new_incoming_product", true),
          supabase
            .from("shipment_products")
            .select("shipments(status)")
            .eq("is_disassembled", true),
        ]);

        const firstError =
          shipmentsResult.error || containersResult.error || newProductsResult.error || disassembledResult.error;
        if (firstError) {
          setError(getSupabaseErrorMessage(firstError));
          return;
        }

        setShipments((shipmentsResult.data as Shipment[] | null) ?? []);
        setContainers((containersResult.data as ContainerRow[] | null) ?? []);
        setIncomingProducts((newProductsResult.data as unknown as FlaggedProductRow[] | null) ?? []);
        setDisassembledProducts((disassembledResult.data as unknown as FlaggedProductRow[] | null) ?? []);
      } catch (loadError) {
        setError(getSupabaseErrorMessage(loadError));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const { stats, recentShipments, overdueShipments, etaSoonShipments, chartData } = useMemo(() => {
    const baseDate = new Date();
    const today = baseDate.toISOString().slice(0, 10);
    const in7DaysDate = new Date(baseDate);
    in7DaysDate.setDate(in7DaysDate.getDate() + 7);
    const in7Days = in7DaysDate.toISOString().slice(0, 10);
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
    const etaSoon = shipments.filter(
      (shipment) => shipment.status !== "closed" && shipment.eta >= today && shipment.eta <= in7Days
    );
    const openContainerCount = containers.filter((container) => openShipmentIds.has(container.shipment_id)).length;
    const newIncomingProducts = incomingProducts.filter((row) => relatedShipmentStatus(row) !== "closed").length;
    const disassembledCount = disassembledProducts.filter((row) => relatedShipmentStatus(row) !== "closed").length;

    return {
      recentShipments: shipments.slice(0, 8),
      overdueShipments: overdue.slice(0, 5),
      etaSoonShipments: etaSoon.slice(0, 5),
      stats: [
        {
          label: "status.in_sea",
          value: inSea.length,
          helper: `الحاويات: ${countContainers(inSea.map((shipment) => shipment.id))}`,
          href: "/shipments?status=in_sea",
          icon: ShipWheel,
          tone: "bg-blue-50 text-blue-700 border-blue-200",
        },
        {
          label: "status.customs",
          value: customs.length,
          helper: `الحاويات: ${countContainers(customs.map((shipment) => shipment.id))}`,
          href: "/shipments?status=customs",
          icon: Boxes,
          tone: "bg-orange-50 text-orange-700 border-orange-200",
        },
        {
          label: "alerts.overdue",
          value: overdue.length,
          helper: `الحاويات: ${countContainers(overdue.map((shipment) => shipment.id))}`,
          href: "/shipments",
          icon: AlertTriangle,
          tone: "bg-red-50 text-red-700 border-red-200",
        },
        {
          label: "status.closed",
          value: closed.length,
          helper: `الحاويات: ${countContainers(closed.map((shipment) => shipment.id))}`,
          href: "/shipments?status=closed",
          icon: CheckCircle2,
          tone: "bg-slate-50 text-slate-700 border-slate-200",
        },
        {
          label: "alerts.incomingContainers",
          value: openContainerCount,
          helper: "في الشحنات المفتوحة",
          href: "/shipments",
          icon: Anchor,
          tone: "bg-emerald-50 text-emerald-700 border-emerald-200",
        },
        {
          label: "alerts.newProducts",
          value: newIncomingProducts,
          helper: "معلمة كمنتج وارد جديد",
          href: "/reports/new-products",
          icon: Package,
          tone: "bg-teal-50 text-teal-800 border-teal-200",
        },
        {
          label: "alerts.disassembledProducts",
          value: disassembledCount,
          helper: "معلمة كمنتج مفكك",
          href: "/reports/disassembled-products",
          icon: Layers3,
          tone: "bg-violet-50 text-violet-800 border-violet-200",
        },
      ],
      chartData: {
        shipmentsByStatus: [
          { label: lang === "ar" ? SHIPMENT_STATUS_LABELS.in_sea : SHIPMENT_STATUS_LABELS_EN.in_sea, value: inSea.length, color: "#2563eb" },
          { label: lang === "ar" ? SHIPMENT_STATUS_LABELS.customs : SHIPMENT_STATUS_LABELS_EN.customs, value: customs.length, color: "#ea580c" },
          { label: lang === "ar" ? SHIPMENT_STATUS_LABELS.closed : SHIPMENT_STATUS_LABELS_EN.closed, value: closed.length, color: "#64748b" },
        ],
        incoming: [
          { label: t("alerts.incomingContainers"), value: openContainerCount, color: "#059669" },
          { label: t("alerts.newProducts"), value: newIncomingProducts, color: "#0f766e" },
          { label: t("alerts.disassembledProducts"), value: disassembledCount, color: "#7c3aed" },
        ],
      },
    };
  }, [containers, disassembledProducts, incomingProducts, shipments, lang, t]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("dashboard.title")}
        description={t("dashboard.subtitle")}
        actions={
          <Link className="btn" href="/shipments/new">
            <Plus className="h-4 w-4" />
            {t("actions.newShipment")}
          </Link>
        }
      />

      <ErrorMessage message={error} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              className="card group p-5 transition hover:-translate-y-0.5 hover:border-[#0f766e]"
              href={item.href}
              key={item.label}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold ${item.tone}`}>
                    {t(item.label)}
                  </div>
                  <div className="mt-3 text-4xl font-bold tracking-tight">{item.value}</div>
                  <p className="mt-1 text-sm text-[var(--muted)]">{item.helper}</p>
                </div>
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-50 text-[#0f766e] ring-1 ring-slate-200 transition group-hover:bg-emerald-50 dark:bg-slate-800 dark:ring-slate-700">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <section className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-4">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <h2 className="font-bold">{t("dashboard.recentShipments")}</h2>
              <Link className="text-sm font-semibold text-[#0f766e]" href="/shipments">
                {t("dashboard.viewAll")}
              </Link>
            </div>
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="table-head">
                  <tr>
                    <th className="p-3 text-right">{t("shipment.number")}</th>
                    <th className="p-3 text-right">{t("shipment.company")}</th>
                    <th className="p-3 text-right">{t("shipment.supplier")}</th>
                    <th className="p-3 text-right">{t("shipment.status")}</th>
                    <th className="p-3 text-right">{t("shipment.eta")}</th>
                    <th className="p-3 text-right">{""}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="p-4 text-[var(--muted)]" colSpan={6}>
                        {lang === "ar" ? "جاري التحميل..." : "Loading..."}
                      </td>
                    </tr>
                  ) : recentShipments.length ? (
                    recentShipments.map((shipment) => (
                      <tr className="row-hover border-t border-[var(--border)]" key={shipment.id}>
                        <td className="p-3 font-semibold">
                          <Link href={`/shipments/${shipment.id}`}>{shipment.shipment_number}</Link>
                        </td>
                        <td className="p-3">{shipment.companies?.name_ar ?? "-"}</td>
                        <td className="p-3">{shipment.suppliers?.name_ar ?? "-"}</td>
                        <td className="p-3">
                          <StatusLabel status={shipment.status} lang={lang} />
                        </td>
                        <td className="p-3">{formatDate(shipment.eta, lang)}</td>
                        <td className="p-3">
                          <Link className="btn btn-secondary text-xs" href={`/shipments/${shipment.id}`}>
                            {t("actions.view")}
                          </Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="p-4 text-[var(--muted)]" colSpan={6}>
                        {lang === "ar" ? "لا توجد شحنات بعد." : "No shipments yet."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <VisualBars
              title={lang === "ar" ? "الشحنات حسب الحالة" : "Shipments by status"}
              items={chartData.shipmentsByStatus}
            />
            <VisualBars
              title={lang === "ar" ? "المنتجات / الحاويات" : "Products / Containers"}
              items={chartData.incoming}
            />
          </div>
        </div>

        <div className="lg:col-span-4 space-y-4">
          <div className="card overflow-hidden">
            <div className="border-b border-[var(--border)] px-4 py-3">
              <h2 className="font-bold">{t("dashboard.importantAlerts")}</h2>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-bold">{t("alerts.overdue")}</span>
                  <Link className="text-xs font-semibold text-[#0f766e]" href="/shipments">
                    {t("actions.open")}
                  </Link>
                </div>
                <div className="divide-y divide-[var(--border)] rounded-md border border-[var(--border)] bg-white/60">
                  {overdueShipments.length ? (
                    overdueShipments.map((shipment) => (
                      <Link
                        className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-slate-50"
                        href={`/shipments/${shipment.id}`}
                        key={shipment.id}
                      >
                        <span className="font-semibold">{shipment.shipment_number}</span>
                        <span className="text-red-700">{formatDate(shipment.eta, lang)}</span>
                      </Link>
                    ))
                  ) : (
                    <div className="px-3 py-3 text-sm text-[var(--muted)]">
                      {lang === "ar" ? "لا توجد شحنات متأخرة." : "No overdue shipments."}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-bold">{t("alerts.eta7")}</span>
                  <Link className="text-xs font-semibold text-[#0f766e]" href="/shipments">
                    {t("actions.open")}
                  </Link>
                </div>
                <div className="divide-y divide-[var(--border)] rounded-md border border-[var(--border)] bg-white/60">
                  {etaSoonShipments.length ? (
                    etaSoonShipments.map((shipment) => (
                      <Link
                        className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-slate-50"
                        href={`/shipments/${shipment.id}`}
                        key={shipment.id}
                      >
                        <span className="font-semibold">{shipment.shipment_number}</span>
                        <span className="text-[#0f766e]">{formatDate(shipment.eta, lang)}</span>
                      </Link>
                    ))
                  ) : (
                    <div className="px-3 py-3 text-sm text-[var(--muted)]">
                      {lang === "ar" ? "لا توجد شحنات ETA قريبة." : "No upcoming ETA shipments."}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-[var(--border)] bg-white/60 p-3">
                  <div className="text-xs font-semibold text-[var(--muted)]">{t("alerts.incomingContainers")}</div>
                  <div className="mt-2 text-2xl font-bold">{stats.find((s) => s.label === "alerts.incomingContainers")?.value ?? 0}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">{lang === "ar" ? "ضمن الشحنات المفتوحة" : "Across open shipments"}</div>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-white/60 p-3">
                  <div className="text-xs font-semibold text-[var(--muted)]">{t("alerts.newProducts")}</div>
                  <div className="mt-2 text-2xl font-bold">{stats.find((s) => s.label === "alerts.newProducts")?.value ?? 0}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">{lang === "ar" ? "منتجات واردة جديدة" : "Flagged as new incoming"}</div>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-white/60 p-3">
                  <div className="text-xs font-semibold text-[var(--muted)]">{t("alerts.disassembledProducts")}</div>
                  <div className="mt-2 text-2xl font-bold">
                    {stats.find((s) => s.label === "alerts.disassembledProducts")?.value ?? 0}
                  </div>
                  <div className="mt-1 text-xs text-[var(--muted)]">{lang === "ar" ? "منتجات مفككة" : "Flagged as disassembled"}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">{t("dashboard.quickActions")}</h2>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Link className="btn btn-secondary justify-start" href="/shipments/new">
                <Plus className="h-4 w-4" />
                {t("nav.newShipment")}
              </Link>
              <Link className="btn btn-secondary justify-start" href="/products">
                <Package className="h-4 w-4" />
                {t("nav.products")}
              </Link>
              <Link className="btn btn-secondary justify-start" href="/suppliers">
                <Boxes className="h-4 w-4" />
                {t("nav.suppliers")}
              </Link>
              <Link className="btn btn-secondary justify-start" href="/reports">
                <AlertTriangle className="h-4 w-4" />
                {t("nav.reports")}
              </Link>
              <Link className="btn btn-secondary justify-start" href="/shipping-routes">
                <ShipWheel className="h-4 w-4" />
                {t("nav.routes")}
              </Link>
              <Link className="btn btn-secondary justify-start" href="/shipments">
                <Anchor className="h-4 w-4" />
                {t("nav.shipments")}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
