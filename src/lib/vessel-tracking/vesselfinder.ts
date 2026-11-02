import { parseAnnouncedEtaToIsoDate } from "@/lib/vessel-tracking/announced-eta";

export type VesselFinderPortCall = {
  port: string;
  kind: "ATA" | "ATD" | "ETA";
  dateIso: string;
};

export type VesselFinderLocation = {
  area: string;
  destination?: string;
  etaIso?: string | null;
  locationText: string;
  portCalls?: VesselFinderPortCall[];
};

function decodeHtml(text: string) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

const AIS_AGO = String.raw`[\d.]+\s+(?:hours?|hrs?|mins?|minutes?|days?)\s+ago`;

export function parseVesselFinderPortCalls(html: string, now = new Date()): VesselFinderPortCall[] {
  const calls: VesselFinderPortCall[] = [];
  const re =
    /<a class="_npNa" href="\/ports\/[^"]+">([^<]+)<\/a>[\s\S]{0,280}?(?:<span class="_mcol12ext">)?(ATA|ATD|ETA):\s*([^<]+)/gi;
  for (const match of html.matchAll(re)) {
    const port = decodeHtml(match[1].trim());
    const kind = match[2].toUpperCase() as VesselFinderPortCall["kind"];
    const dateIso = parseAnnouncedEtaToIsoDate(
      decodeHtml(match[3]),
      now,
      kind === "ETA" ? "eta" : "actual"
    );
    if (port && dateIso) calls.push({ port, kind, dateIso });
  }
  return calls;
}

export function parseVesselFinderLocationHtml(html: string, now = new Date()): VesselFinderLocation | null {
  const areaMatch =
    html.match(new RegExp(String.raw`located in(?: the)?\s+([A-Z][A-Za-z0-9 .\-/]{2,80}?)\s+reported\s+${AIS_AGO}`, "i")) ??
    html.match(new RegExp(String.raw`at\s+([A-Z][A-Za-z0-9 .\-/]{2,80}?)\s+reported\s+${AIS_AGO}\s+by\s+AIS`, "i")) ??
    html.match(new RegExp(String.raw`([A-Z][A-Za-z0-9 .\-/]{2,80})\s+reported\s+${AIS_AGO}\s+by\s+AIS`, "i"));

  const destMatch =
    html.match(/en route to(?: the port of)?\s+<strong>([^<]+)<\/strong>/i) ??
    html.match(/en route to(?: the port of)?\s+([^,<]{3,80}?)(?:,\s*sailing|\s+sailing)/i) ??
    html.match(/<div class="vilabel">Destination<\/div>\s*<a[^>]*>([^<]+)<\/a>/i);
  const destination = destMatch ? decodeHtml(destMatch[1].trim()) : undefined;

  const etaMatch =
    html.match(/expected to arrive there on\s*<strong>([^<]+)<\/strong>/i) ??
    html.match(/expected to arrive there on\s+([^.<]{3,40}?)(?:\.|<)/i) ??
    html.match(/<span class="_mcol12ext">ETA:\s*([^<]+)<\/span>/i);
  const etaIso = etaMatch ? parseAnnouncedEtaToIsoDate(decodeHtml(etaMatch[1]), now) : null;

  const area = areaMatch?.[1] ? decodeHtml(areaMatch[1].trim()) : "";
  const portCalls = parseVesselFinderPortCalls(html, now);
  if (!area && !destination && !etaIso && !portCalls.length) return null;

  return {
    area,
    destination,
    etaIso,
    locationText: area || destination || "",
    portCalls,
  };
}

export async function fetchVesselLocationByImo(imo: string): Promise<VesselFinderLocation | null> {
  const trimmed = imo.trim();
  if (!trimmed) return null;

  const url = `https://www.vesselfinder.com/vessels/details/${encodeURIComponent(trimmed)}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) return null;

  const html = await response.text();
  return parseVesselFinderLocationHtml(html);
}
