"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/context/language-context";
import type { FxBoard, FxQuote } from "@/lib/fx-board";

const POLL_MS = 4000;

const FX_SYMBOL: Record<FxQuote["code"], string> = {
  USD: "$",
  CNY: "¥",
  EUR: "€",
};

function formatFxRate(value: number) {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function QuoteCard({ quote }: { quote: FxQuote }) {
  return (
    <div className="card px-3 py-2">
      <div className="flex items-center gap-1 text-xs font-bold text-[var(--navy)] dark:text-[var(--foreground)]">
        <span>{quote.nameAr}</span>
        <span className="text-[11px] font-semibold text-[var(--muted)]" dir="ltr">
          {FX_SYMBOL[quote.code]}
        </span>
        <span className="text-[11px] font-semibold text-[var(--muted)]">{quote.code}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span
          dir="ltr"
          className="text-lg font-extrabold tracking-tight tabular-nums text-[var(--navy)] dark:text-[var(--foreground)]"
        >
          {formatFxRate(quote.rate)}
        </span>
        <span className="text-xs font-bold text-[var(--muted)]">ج.م</span>
      </div>
    </div>
  );
}

export function FxTicker() {
  const { ui } = useLanguage();
  const [board, setBoard] = useState<FxBoard | null>(null);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/fx/board", { cache: "no-store" });
        const body = (await response.json()) as FxBoard & { error?: string };
        if (!response.ok) throw new Error(body.error || "fx");
        if (cancelled) return;
        setBoard(body);
        setUpdatedAt(new Date());
        setError("");
      } catch {
        if (!cancelled) setError(ui("تعذر تحديث أسعار العملات الآن."));
      }
    }

    void load();
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [ui]);

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-sm font-bold">{ui("أسعار العملات مقابل الجنيه")}</h2>
        <div className="text-xs text-[var(--muted)]">
          {updatedAt
            ? `${ui("آخر تحديث")}: ${updatedAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
            : ui("جاري التحميل...")}
        </div>
      </div>
      {error ? <p className="text-xs text-amber-700">{error}</p> : null}
      <div className="grid gap-2 sm:grid-cols-3">
        {(board?.quotes ?? [
          { code: "USD", nameAr: "الدولار", rate: 0, change: 0, changePercent: 0, previousClose: null },
          { code: "CNY", nameAr: "الريمنبي", rate: 0, change: 0, changePercent: 0, previousClose: null },
          { code: "EUR", nameAr: "اليورو", rate: 0, change: 0, changePercent: 0, previousClose: null },
        ]).map((quote) => (
          <QuoteCard key={quote.code} quote={quote} />
        ))}
      </div>
    </section>
  );
}
