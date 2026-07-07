export type WeiyunShipHit = {
  name: string;
  showName?: string;
  imo?: string;
  mmsi?: string;
  weiyunShipID?: string;
};

type WeiyunAutoCompleteResponse = {
  success: boolean;
  message?: string;
  result?: {
    items?: WeiyunShipHit[];
  };
};

const BASE = "https://wywapi.weiyun001.com/api";

export async function weiyunAutoComplete(shipName: string): Promise<WeiyunShipHit[]> {
  const trimmed = shipName.trim();
  if (!trimmed) return [];

  const url = `${BASE}/getShipAutoComplete?content=${encodeURIComponent(trimmed)}`;
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json",
      Referer: "https://www.weiyun001.com/",
      Origin: "https://www.weiyun001.com",
    },
  });

  if (!r.ok) {
    throw new Error(`Weiyun autocomplete failed (${r.status})`);
  }

  const json = (await r.json()) as WeiyunAutoCompleteResponse;
  return json?.result?.items ?? [];
}

export async function weiyunResolveShip(shipName: string): Promise<WeiyunShipHit | null> {
  const hits = await weiyunAutoComplete(shipName);
  if (!hits.length) return null;

  const normalized = shipName.trim().toLowerCase();
  const exact = hits.find((h) => (h.name ?? "").trim().toLowerCase() === normalized);
  return exact ?? hits[0] ?? null;
}
