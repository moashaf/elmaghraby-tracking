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

const PAIRS: Array<{ code: FxQuote["code"]; nameAr: string; yahoo: string }> = [
  { code: "USD", nameAr: "الدولار", yahoo: "USDEGP=X" },
  { code: "CNY", nameAr: "الريمنبي", yahoo: "CNYEGP=X" },
  { code: "EUR", nameAr: "اليورو", yahoo: "EUREGP=X" },
];

async function fetchJson(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "Mozilla/5.0 ElmaghrabyTracing" },
  });
  if (!response.ok) throw new Error(`${response.status}`);
  return response.json() as Promise<Record<string, unknown>>;
}

function roundRate(value: number) {
  return Math.round(value * 10000) / 10000;
}

function quoteNumber(row: Record<string, unknown> | undefined, key: string) {
  const value = Number(row?.[key]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function toQuote(code: FxQuote["code"], nameAr: string, rate: number, previousClose: number | null): FxQuote {
  const change = previousClose ? roundRate(rate - previousClose) : 0;
  const changePercent = previousClose ? roundRate((change / previousClose) * 100) : 0;
  return { code, nameAr, rate: roundRate(rate), change, changePercent, previousClose };
}

async function yahooQuotes(symbols: string[]) {
  const body = await fetchJson(
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols.join(","))}`
  );
  const results = ((body.quoteResponse as { result?: Array<Record<string, unknown>> } | undefined)?.result ?? []) as Array<
    Record<string, unknown>
  >;
  return new Map(results.map((row) => [String(row.symbol), row]));
}

async function fromYahoo(): Promise<FxBoard> {
  const direct = await yahooQuotes(PAIRS.map((pair) => pair.yahoo));
  const quotes: FxQuote[] = [];
  for (const pair of PAIRS) {
    const row = direct.get(pair.yahoo);
    const rate = quoteNumber(row, "regularMarketPrice");
    if (rate) {
      quotes.push(
        toQuote(pair.code, pair.nameAr, rate, quoteNumber(row, "regularMarketPreviousClose"))
      );
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

  return {
    quotes: [
      toQuote("USD", "الدولار", usd, usdPrev),
      toQuote("CNY", "الريمنبي", usd / usdCny, usdPrev && usdCnyPrev ? usdPrev / usdCnyPrev : null),
      toQuote("EUR", "اليورو", usd * eurUsd, usdPrev && eurUsdPrev ? usdPrev * eurUsdPrev : null),
    ],
    asOf: new Date().toISOString(),
    source: "yahoo-cross",
  };
}

async function fromOpenRates(): Promise<FxBoard> {
  const body = await fetchJson("https://open.er-api.com/v6/latest/USD");
  const rates = body.rates as Record<string, number> | undefined;
  const egp = Number(rates?.EGP);
  const eur = Number(rates?.EUR);
  const cny = Number(rates?.CNY);
  if (!egp || !eur || !cny) throw new Error("open.er-api missing rates");

  const quotes: FxQuote[] = [
    { code: "USD", nameAr: "الدولار", rate: roundRate(egp), change: 0, changePercent: 0, previousClose: null },
    { code: "CNY", nameAr: "الريمنبي", rate: roundRate(egp / cny), change: 0, changePercent: 0, previousClose: null },
    { code: "EUR", nameAr: "اليورو", rate: roundRate(egp / eur), change: 0, changePercent: 0, previousClose: null },
  ];

  return {
    quotes,
    asOf: typeof body.time_last_update_utc === "string" ? body.time_last_update_utc : new Date().toISOString(),
    source: "open.er-api.com",
  };
}

export async function fetchFxBoard(): Promise<FxBoard> {
  try {
    return await fromYahoo();
  } catch {
    return fromOpenRates();
  }
}
