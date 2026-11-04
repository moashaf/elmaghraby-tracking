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

type YahooChart = {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        regularMarketTime?: number;
      };
    }>;
    error?: { description?: string };
  };
};

async function yahooChart(symbol: string) {
  const hosts = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
  let lastError: unknown;
  for (const host of hosts) {
    try {
      const body = (await fetchJson(
        `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`
      )) as YahooChart;
      const meta = body.chart?.result?.[0]?.meta;
      const price = positiveNumber(meta?.regularMarketPrice);
      if (!price) throw new Error(body.chart?.error?.description || `yahoo ${symbol}`);
      return {
        price,
        previous: positiveNumber(meta?.chartPreviousClose ?? meta?.previousClose),
        asOf: meta?.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : new Date().toISOString(),
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`yahoo ${symbol}`);
}

async function fromYahooMarket(): Promise<FxBoard> {
  const [usd, eur, usdCny] = await Promise.all([yahooChart("USDEGP=X"), yahooChart("EUREGP=X"), yahooChart("USDCNY=X")]);
  const cny = usd.price / usdCny.price;
  const cnyPrev = usd.previous && usdCny.previous ? usd.previous / usdCny.previous : null;
  return boardFromRates(usd.price, cny, eur.price, usd.asOf, "yahoo", {
    usd: usd.previous,
    cny: cnyPrev,
    eur: eur.previous,
  });
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
  const sources = [fromYahooMarket, fromCurrencyApi, fromOpenRates];
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
