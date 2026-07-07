export type PortCoordinate = {
  lat: number;
  lon: number;
  /** Distance in km considered "arrived at port". */
  radiusKm: number;
};

/** Known arrival ports — extend as needed. */
const PORT_COORDINATES: Record<string, PortCoordinate> = {
  "السخنة، مصر": { lat: 29.589, lon: 32.354, radiusKm: 35 },
  "العين السخنة، مصر": { lat: 29.589, lon: 32.354, radiusKm: 35 },
  "الإسكندرية، مصر": { lat: 31.198, lon: 29.887, radiusKm: 35 },
  "بورسعيد، مصر": { lat: 31.265, lon: 32.306, radiusKm: 35 },
  "دمياط، مصر": { lat: 31.417, lon: 31.814, radiusKm: 35 },
  "الإسماعيلية، مصر": { lat: 30.604, lon: 32.272, radiusKm: 35 },
  "السويس، مصر": { lat: 29.966, lon: 32.55, radiusKm: 35 },
  "مرسين، تركيا": { lat: 36.8, lon: 34.633, radiusKm: 35 },
  "جدة، السعودية": { lat: 21.485, lon: 39.192, radiusKm: 35 },
  "الدمام، السعودية": { lat: 26.436, lon: 50.103, radiusKm: 35 },
  "دبي، الإمارات": { lat: 25.269, lon: 55.309, radiusKm: 35 },
  "جبل علي، الإمارات": { lat: 24.985, lon: 55.062, radiusKm: 35 },
};

function normalizePortName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export function resolvePortCoordinates(arrivalPort: string): PortCoordinate | null {
  const normalized = normalizePortName(arrivalPort);
  if (!normalized) return null;

  const exact = PORT_COORDINATES[normalized];
  if (exact) return exact;

  const cityPart = normalized.split("،")[0]?.trim() ?? normalized;
  for (const [key, coord] of Object.entries(PORT_COORDINATES)) {
    const keyCity = key.split("،")[0]?.trim() ?? key;
    if (keyCity === cityPart || key.includes(cityPart) || cityPart.includes(keyCity)) {
      return coord;
    }
  }

  return null;
}
