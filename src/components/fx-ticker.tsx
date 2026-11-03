"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { useLanguage } from "@/context/language-context";
import type { FxBoard, FxQuote } from "@/lib/fx-board";

const POLL_MS = 4000;
const SPARK_POINTS = 36;

const FX_SYMBOL: Record<FxQuote["code"], string> = {
  USD: "$",
  CNY: "¥",
  EUR: "€",
};

function formatFxRate(value: number) {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Sparkline({ points, up }: { points: number[]; up: boolean | null }) {
  if (points.length < 2) return <div className="h-8 w-full" />;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const d = points
    .map((value, index) => {
      const x = (index / (points.length - 1)) * 100;
      const y = 18 - ((value - min) / span) * 16;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
  const color = up == null ? "#78716c" : up ? "#059669" : "#dc2626";
  return (
    <svg className="h-8 w-full" viewBox="0 0 100 20" preserveAspectRatio="none">
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" />
    </svg>
  );
}

function QuoteCard({
  quote,
  history,
}: {
  quote: FxQuote;
  history: number[];
}) {
  const { ui } = useLanguage();
  const last = history[history.length - 1];
  const prev = history[history.length - 2];
  const tickChange = last != null && prev != null ? last - prev : quote.change;
  const up = tickChange === 0 ? (quote.change === 0 ? null : quote.change > 0) : tickChange > 0;
  const Icon = up == null ? Minus : up ? TrendingUp : TrendingDown;
  const tone =
    up == null
      ? "text-[var(--muted)]"
      : up
        ? "text-emerald-600"
        : "text-red-600";

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-[var(--muted)]">{quote.nameAr}</div>
          <div className="mt-1 text-sm font-bold text-[var(--navy)] dark:text-[var(--foreground)]">
            {quote.code} {FX_SYMBOL[quote.code]}
          </div>
        </div>
        <div className={`flex items-center gap-1 text-sm font-bold ${tone}`} dir="ltr">
          <Icon className="h-4 w-4" />
          {up == null ? "—" : `${quote.change > 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%`}
        </div>
      </div>
      <div
        dir="ltr"
        className="mt-3 text-3xl font-extrabold tracking-tight tabular-nums text-[var(--navy)] dark:text-[var(--foreground)]"
      >
        {FX_SYMBOL[quote.code]} {formatFxRate(quote.rate)}
      </div>
      <div className="mt-1 text-xs text-[var(--muted)]">{ui("جنيه")}</div>
      <div className="mt-3">
        <Sparkline points={history} up={up} />
      </div>
    </div>
  );
}

export function FxTicker() {
  const { ui } = useLanguage();
  const [board, setBoard] = useState<FxBoard | null>(null);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const historyRef = useRef<Record<string, number[]>>({ USD: [], CNY: [], EUR: [] });
  const [, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/fx/board", { cache: "no-store" });
        const body = (await response.json()) as FxBoard & { error?: string };
        if (!response.ok) throw new Error(body.error || "fx");
        if (cancelled) return;
        for (const quote of body.quotes) {
          const series = historyRef.current[quote.code] ?? [];
          const next = [...series, quote.rate].slice(-SPARK_POINTS);
          historyRef.current[quote.code] = next;
        }
        setBoard(body);
        setUpdatedAt(new Date());
        setError("");
        setTick((value) => value + 1);
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
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold">{ui("أسعار العملات مقابل الجنيه")}</h2>
          <p className="text-xs text-[var(--muted)]">{ui("تحديث مباشر كل 4 ثوانٍ مع مؤشر الصعود والنزول")}</p>
        </div>
        <div className="text-xs text-[var(--muted)]">
          {updatedAt
            ? `${ui("آخر تحديث")}: ${updatedAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
            : ui("جاري التحميل...")}
        </div>
      </div>
      {error ? <p className="text-xs text-amber-700">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        {(board?.quotes ?? [
          { code: "USD", nameAr: "الدولار", rate: 0, change: 0, changePercent: 0, previousClose: null },
          { code: "CNY", nameAr: "الريمنبي", rate: 0, change: 0, changePercent: 0, previousClose: null },
          { code: "EUR", nameAr: "اليورو", rate: 0, change: 0, changePercent: 0, previousClose: null },
        ]).map((quote) => (
          <QuoteCard key={quote.code} history={historyRef.current[quote.code] ?? []} quote={quote} />
        ))}
      </div>
    </section>
  );
}
