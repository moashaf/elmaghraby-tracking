import { fetchMyShipTrackingPosition } from "@/lib/vessel-tracking/myshiptracking";
import { formatVesselLocationText, nearestCountry } from "@/lib/vessel-tracking/nearest-country";
import { fetchVesselLocationByImo, type VesselFinderPortCall } from "@/lib/vessel-tracking/vesselfinder";
import { weiyunResolveShip, type WeiyunShipHit } from "@/lib/vessel-tracking/weiyun";

export type VesselTrackResult = {
  hit: WeiyunShipHit | null;
  locationText: string | null;
  lat: number | null;
  lon: number | null;
  destination: string | null;
  etaIso: string | null;
  portCalls: VesselFinderPortCall[];
  trackingStatus: "ok" | "not_found" | "pending" | "error";
};

const emptyResult: VesselTrackResult = {
  hit: null,
  locationText: null,
  lat: null,
  lon: null,
  destination: null,
  etaIso: null,
  portCalls: [],
  trackingStatus: "not_found",
};

export async function trackVesselByName(shipName: string): Promise<VesselTrackResult> {
  const trimmed = shipName.trim();
  if (!trimmed) {
    return { ...emptyResult, trackingStatus: "not_found" };
  }

  try {
    const hit = await weiyunResolveShip(trimmed);
    if (!hit) {
      return { ...emptyResult, trackingStatus: "not_found" };
    }

    const [vfLocation, mstPosition] = await Promise.all([
      hit.imo ? fetchVesselLocationByImo(hit.imo) : Promise.resolve(null),
      hit.mmsi ? fetchMyShipTrackingPosition(hit.mmsi) : Promise.resolve(null),
    ]);

    const seaArea = mstPosition?.area || vfLocation?.area || null;
    const nearest = mstPosition ? nearestCountry(mstPosition.lat, mstPosition.lon, seaArea) : null;
    const destination = vfLocation?.destination?.trim() || null;
    const etaIso = vfLocation?.etaIso || mstPosition?.etaIso || null;
    const portCalls = vfLocation?.portCalls ?? [];

    const locationText = formatVesselLocationText({
      seaArea,
      nearestCountryAr: nearest?.nameAr ?? null,
    });

    const lat = mstPosition?.lat ?? null;
    const lon = mstPosition?.lon ?? null;

    if (!locationText) {
      return {
        hit,
        locationText: null,
        lat,
        lon,
        destination,
        etaIso,
        portCalls,
        trackingStatus: "pending",
      };
    }

    return {
      hit,
      locationText,
      lat,
      lon,
      destination,
      etaIso,
      portCalls,
      trackingStatus: "ok",
    };
  } catch {
    return { ...emptyResult, trackingStatus: "error" };
  }
}
