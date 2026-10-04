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

export function parseVesselFinderPortCalls(html: string, now = new Date()): VesselFinderPortCall[] {
  const calls: VesselFinderPortCall[] = [];
  const re =
    /<a class="_npNa" href="\/ports\/[^"]+">([^<]+)<\/a>\s*<div class="_value">(ATA|ATD|ETA):\s*([^<]+)/gi;
  for (const match of html.matchAll(re)) {
    const port = decodeHtml(match[1].trim());
    const kind = match[2].toUpperCase() as VesselFinderPortCall["kind"];
    const dateIso = parseAnnouncedEtaToIsoDate(decodeHtml(match[3]), now);
    if (port && dateIso) calls.push({ port, kind, dateIso });
  }
  return calls;
}

export function parseVesselFinderLocationHtml(html: string, now = new Date()): VesselFinderLocation | null {
  const areaMatch =
    html.match(
      /located in(?: the)?\s+([A-Z][A-Za-z0-9 .\-/]{2,80}?)\s+reported\s+[\d.]+\s+(?:hours?|hrs?|mins?|minutes?)\s+ago/i
    ) ??
    html.match(
      /at\s+([A-Z][A-Za-z0-9 .\-/]{2,80}?)\s+reported\s+[\d.]+\s+(?:hours?|hrs?|mins?|minutes?)\s+ago\s+by\s+AIS/
    ) ??
    html.match(
      /([A-Z][A-Za-z0-9 .\-/]{2,80})\s+reported\s+[\d.]+\s+(?:hours?|hrs?|mins?|minutes?)\s+ago\s+by\s+AIS/
    );

  const destMatch =
    html.match(/en route to(?: the port of)?\s+<strong>([^<]+)<\/strong>/i) ??
    html.match(/<div class="vilabel">Destination<\/div>\s*<a[^>]*>([^<]+)<\/a>/i);
  const destination = destMatch ? decodeHtml(destMatch[1].trim()) : undefined;

  const etaMatch = html.match(/expected to arrive there on\s*<strong>([^<]+)<\/strong>/i);
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
      "User-Agent": "Mozilla/5.0 (compatible; ElmaghrabyTracing/1.0)",
      Accept: "text/html",
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) return null;

  const html = await response.text();
  return parseVesselFinderLocationHtml(html);
}
