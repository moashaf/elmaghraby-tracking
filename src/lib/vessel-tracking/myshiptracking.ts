export type MyShipTrackingPosition = {
  lat: number;
  lon: number;
  area?: string;
};

export function parseMyShipTrackingHtml(html: string): MyShipTrackingPosition | null {
  const coordsMatch = html.match(/lat=(-?\d+(?:\.\d+)?)&lng=(-?\d+(?:\.\d+)?)/i);
  if (!coordsMatch) return null;

  const lat = Number(coordsMatch[1]);
  const lon = Number(coordsMatch[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const areaMatch = html.match(/<th>\s*Area\s*<\/th>\s*<td>([^<]+)<\/td>/i);
  const area = areaMatch?.[1]?.trim() || undefined;

  return { lat, lon, area };
}

export async function fetchMyShipTrackingPosition(mmsi: string): Promise<MyShipTrackingPosition | null> {
  const trimmed = mmsi.trim();
  if (!trimmed) return null;

  const response = await fetch(`https://www.myshiptracking.com/vessels/${encodeURIComponent(trimmed)}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; ElmaghrabyTracing/1.0)",
      Accept: "text/html",
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) return null;

  const html = await response.text();
  return parseMyShipTrackingHtml(html);
}
