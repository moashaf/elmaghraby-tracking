export type FxQuote = {
  code: "USD" | "CNY" | "EUR";
  nameAr: string;
  rate: number;
  change: number;
  changePercent: number;
  previousClose: number | null;
};

export type FxBoard = {
  quotes: FxQuote[];
  asOf: string | null;
  source: string;
};

const PAIRS: Array<{ code: FxQuote["code"]; nameAr: string; yahoo: string; base: "usd" | "cny" | "eur" }> = [
  { code: "USD", nameAr: "الدولار", yahoo: "USDEGP=X", base: "usd" },
  { code: "CNY", nameAr: "الريمنبي", yahoo: "CNYEGP=X", base: "cny" },
  { code: "EUR", nameAr: "اليورو", yahoo: "EUREGP=X", base: "eur" },
];

async function fetchJson(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "Mozilla/5.0 ElmaghrabyTracing" },
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new Error(`${response.status}`);
  return response.json() as Promise<unknown>;
}

function roundRate(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function positiveNumber(value: unknown) {
  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

function quoteNumber(row: Record<string, unknown> | undefined, key: string) {
  return positiveNumber(row?.[key]);
}

function toQuote(code: FxQuote["code"], nameAr: string, rate: number, previousClose: number | null): FxQuote {
  const change = previousClose ? roundRate(rate - previousClose) : 0;
  const changePercent = previousClose ? roundRate((change / previousClose) * 100) : 0;
  return { code, nameAr, rate: roundRate(rate), change, changePercent, previousClose };
}

function boardFromRates(
  usd: number,
  cny: number,
  eur: number,
  asOf: string | null,
  source: string,
  previous?: { usd: number | null; cny: number | null; eur: number | null }
): FxBoard {
  return {
    quotes: [
      toQuote("USD", "الدولار", usd, previous?.usd ?? null),
      toQuote("CNY", "الريمنبي", cny, previous?.cny ?? null),
      toQuote("EUR", "اليورو", eur, previous?.eur ?? null),
    ],
    asOf,
    source,
  };
}

function nestedEgp(body: unknown, base: "usd" | "cny" | "eur") {
  if (!body || typeof body !== "object") return null;
  const row = (body as Record<string, unknown>)[base];
  if (!row || typeof row !== "object") return null;
  return positiveNumber((row as Record<string, unknown>).egp);
}

async function fromCurrencyApi(): Promise<FxBoard> {
  const hosts = [
    "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies",
    "https://latest.currency-api.pages.dev/v1/currencies",
  ];
  let lastError: unknown;
  for (const host of hosts) {
    try {
      const [usdBody, cnyBody, eurBody] = await Promise.all([
        fetchJson(`${host}/usd.min.json`),
        fetchJson(`${host}/cny.min.json`),
        fetchJson(`${host}/eur.min.json`),
      ]);
      const usd = nestedEgp(usdBody, "usd");
      const cny = nestedEgp(cnyBody, "cny");
      const eur = nestedEgp(eurBody, "eur");
      if (!usd || !cny || !eur) throw new Error("currency-api missing EGP");
      const asOf =
        typeof usdBody === "object" && usdBody && "date" in usdBody && typeof usdBody.date === "string"
          ? usdBody.date
          : new Date().toISOString();
      return boardFromRates(usd, cny, eur, asOf, "currency-api");
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("currency-api failed");
}

async function fromCbe(): Promise<FxBoard> {
  const rows = (await fetchJson("https://api.frankfurter.dev/v2/providers/cbe/rates")) as Array<{
    date?: string;
    base?: string;
    quote?: string;
    rate?: number;
  }>;
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("cbe empty");
  const byQuote = new Map(rows.map((row) => [String(row.quote), Number(row.rate)]));
  const eurEgp = positiveNumber(rows.find((row) => row.quote === "EGP")?.rate);
  const eurUsd = positiveNumber(byQuote.get("USD"));
  const eurCny = positiveNumber(byQuote.get("CNY"));
  if (!eurEgp || !eurUsd || !eurCny) throw new Error("cbe missing pairs");
  return boardFromRates(eurEgp / eurUsd, eurEgp / eurCny, eurEgp, rows[0]?.date ?? null, "cbe");
}

async function yahooQuotes(symbols: string[]) {
  const body = (await fetchJson(
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols.join(","))}`
  )) as {
    quoteResponse?: { result?: Array<Record<string, unknown>> };
  };
  const results = body.quoteResponse?.result ?? [];
  return new Map(results.map((row) => [String(row.symbol), row]));
}

async function fromYahoo(): Promise<FxBoard> {
  const direct = await yahooQuotes(PAIRS.map((pair) => pair.yahoo));
  const quotes: FxQuote[] = [];
  for (const pair of PAIRS) {
    const row = direct.get(pair.yahoo);
    const rate = quoteNumber(row, "regularMarketPrice");
    if (rate) {
      quotes.push(toQuote(pair.code, pair.nameAr, rate, quoteNumber(row, "regularMarketPreviousClose")));
    }
  }
  if (quotes.length === 3) {
    return { quotes, asOf: new Date().toISOString(), source: "yahoo" };
  }

  const cross = await yahooQuotes(["USDEGP=X", "EURUSD=X", "USDCNY=X"]);
  const usd = quoteNumber(cross.get("USDEGP=X"), "regularMarketPrice");
  const usdPrev = quoteNumber(cross.get("USDEGP=X"), "regularMarketPreviousClose");
  const eurUsd = quoteNumber(cross.get("EURUSD=X"), "regularMarketPrice");
  const eurUsdPrev = quoteNumber(cross.get("EURUSD=X"), "regularMarketPreviousClose");
  const usdCny = quoteNumber(cross.get("USDCNY=X"), "regularMarketPrice");
  const usdCnyPrev = quoteNumber(cross.get("USDCNY=X"), "regularMarketPreviousClose");
  if (!usd || !eurUsd || !usdCny) throw new Error("yahoo missing cross rates");

  return boardFromRates(
    usd,
    usd / usdCny,
    usd * eurUsd,
    new Date().toISOString(),
    "yahoo-cross",
    {
      usd: usdPrev,
      cny: usdPrev && usdCnyPrev ? usdPrev / usdCnyPrev : null,
      eur: usdPrev && eurUsdPrev ? usdPrev * eurUsdPrev : null,
    }
  );
}

async function fromOpenRates(): Promise<FxBoard> {
  const body = (await fetchJson("https://open.er-api.com/v6/latest/USD")) as {
    rates?: Record<string, number>;
    time_last_update_utc?: string;
  };
  const egp = positiveNumber(body.rates?.EGP);
  const eur = positiveNumber(body.rates?.EUR);
  const cny = positiveNumber(body.rates?.CNY);
  if (!egp || !eur || !cny) throw new Error("open.er-api missing rates");
  return boardFromRates(egp, egp / cny, egp / eur, body.time_last_update_utc ?? new Date().toISOString(), "open.er-api.com");
}

export async function fetchFxBoard(): Promise<FxBoard> {
  const sources = [fromCurrencyApi, fromCbe, fromYahoo, fromOpenRates];
  let lastError: unknown;
  for (const source of sources) {
    try {
      return await source();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("تعذر جلب أسعار العملات.");
}
