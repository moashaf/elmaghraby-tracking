import { haversineKm } from "@/lib/vessel-tracking/nearest-country";
import { resolvePortCoordinates } from "@/lib/vessel-tracking/port-coordinates";

export function isVesselAtArrivalPort(lat: number, lon: number, arrivalPort: string) {
  const port = resolvePortCoordinates(arrivalPort);
  if (!port) return false;

  const distanceKm = haversineKm(lat, lon, port.lat, port.lon);
  return distanceKm <= port.radiusKm;
}
