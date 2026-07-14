"use client";

import Link from "next/link";
import { FileSpreadsheet, Printer } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { useLanguage } from "@/context/language-context";
import { getLocalizedReports } from "@/lib/i18n";
import type { ReportSlug } from "@/lib/report-definitions";

const REPORT_GROUPS: Array<{
  key: string;
  title: { ar: string; en: string; zh: string };
  slugs: ReportSlug[];
}> = [
  {
    key: "ops",
    title: { ar: "تشغيل", en: "Operations", zh: "运营" },
    slugs: [
      "summary",
      "in-sea",
      "customs",
      "delayed",
      "arriving-10",
      "ready-to-close",
      "closed",
      "containers",
      "container-files",
      "customs-releases",
      "shipment-invoices",
      "suppliers",
      "companies",
    ],
  },
  {
    key: "finance",
    title: { ar: "مالية ومصروفات", en: "Finance & costs", zh: "财务与费用" },
    slugs: ["costs"],
  },
  {
    key: "inventory",
    title: { ar: "مخزون ومنتجات", en: "Inventory & products", zh: "库存与产品" },
    slugs: [
      "incoming-products",
      "china-warehouse",
      "china-arrivals",
      "new-products",
      "disassembled-products",
      "duplicate-products",
      "date-range-products",
      "product-history",
      "all-products",
    ],
  },
];

export default function ReportsPage() {
  const { tr, lang } = useLanguage();
  const reports = getLocalizedReports(lang);
  const bySlug = new Map(reports.map((report) => [report.slug, report]));

  const groups = REPORT_GROUPS.map((group) => ({
    ...group,
    title: tr(group.title.ar, group.title.en, group.title.zh),
    items: group.slugs.map((slug) => bySlug.get(slug)).filter(Boolean),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={tr("التقارير", "Reports", "报告")}
        description={tr(
          "تقارير تشغيلية قابلة للتصدير Excel والطباعة.",
          "Operational reports with Excel export and printing.",
          "可导出 Excel 并支持打印的运营报表。"
        )}
      />
      {groups.map((group) => (
        <section className="space-y-3" key={group.key}>
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)]">{group.title}</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {group.items.map((report) =>
              report ? (
                <Link
                  className="card group p-5 transition hover:-translate-y-0.5 hover:border-[var(--primary)]"
                  href={`/reports/${report.slug}`}
                  key={report.slug}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-bold text-[var(--navy)] dark:text-[var(--foreground)]">{report.title}</h3>
                    <FileSpreadsheet className="h-5 w-5 shrink-0 text-[var(--primary)]" />
                  </div>
                  <p className="mt-2 text-sm text-[var(--muted)]">{report.description}</p>
                  <div className="mt-4 flex gap-3 text-xs font-semibold text-[var(--primary)]">
                    <span className="inline-flex items-center gap-1">
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      Excel
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Printer className="h-3.5 w-3.5" />
                      {tr("طباعة", "Print", "打印")}
                    </span>
                  </div>
                </Link>
              ) : null
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
