"use client";

import Link from "next/link";
import { FileSpreadsheet } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { useLanguage } from "@/context/language-context";
import { getLocalizedReports } from "@/lib/i18n";

export default function ReportsPage() {
  const { tr, lang } = useLanguage();
  const reports = getLocalizedReports(lang);

  return (
    <div className="space-y-5">
      <PageHeader
        title={tr("التقارير", "Reports", "报告")}
        description={tr(
          "تقارير تشغيلية قابلة للتصدير Excel والطباعة.",
          "Operational reports with Excel export and printing.",
          "可导出 Excel 并支持打印的运营报表。"
        )}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reports.map((report) => (
          <Link className="card group p-5 transition hover:-translate-y-0.5 hover:border-[#0f766e]" href={`/reports/${report.slug}`} key={report.slug}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-bold">{report.title}</h2>
              <FileSpreadsheet className="h-5 w-5 text-[#0f766e]" />
            </div>
            <p className="mt-2 text-sm text-[var(--muted)]">{report.description}</p>
            <span className="mt-4 inline-block text-sm font-semibold text-[#0f766e]">
              {tr("فتح التقرير", "Open report", "打开报告")}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
