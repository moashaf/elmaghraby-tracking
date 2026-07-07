export type VesselFinderLocation = {
  area: string;
  destination?: string;
  locationText: string;
};

function decodeHtml(text: string) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function parseVesselFinderLocationHtml(html: string): VesselFinderLocation | null {
  const areaMatch =
    html.match(/at\s+([A-Z][A-Za-z0-9 .\-/]{2,80}?)\s+reported\s+[\d.]+\s+hours?\s+ago\s+by\s+AIS/i) ??
    html.match(/([A-Z][A-Za-z0-9 .\-/]{2,80}?)\s+reported\s+[\d.]+\s+hours?\s+ago\s+by\s+AIS/i);

  if (!areaMatch?.[1]) return null;

  const area = decodeHtml(areaMatch[1].trim());
  const destMatch = html.match(/en route to\s+<strong>([^<]+)<\/strong>/i);
  const destination = destMatch ? decodeHtml(destMatch[1].trim()) : undefined;

  return { area, destination, locationText: area };
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
