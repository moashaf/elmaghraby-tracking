import { fetchMyShipTrackingPosition } from "@/lib/vessel-tracking/myshiptracking";
import { formatVesselLocationText, nearestCountry } from "@/lib/vessel-tracking/nearest-country";
import { fetchVesselLocationByImo } from "@/lib/vessel-tracking/vesselfinder";
import { weiyunResolveShip, type WeiyunShipHit } from "@/lib/vessel-tracking/weiyun";

export type VesselTrackResult = {
  hit: WeiyunShipHit | null;
  locationText: string | null;
  trackingStatus: "ok" | "not_found" | "pending" | "error";
};

export async function trackVesselByName(shipName: string): Promise<VesselTrackResult> {
  const trimmed = shipName.trim();
  if (!trimmed) {
    return { hit: null, locationText: null, trackingStatus: "not_found" };
  }

  try {
    const hit = await weiyunResolveShip(trimmed);
    if (!hit) {
      return { hit: null, locationText: null, trackingStatus: "not_found" };
    }

    const [vfLocation, mstPosition] = await Promise.all([
      hit.imo ? fetchVesselLocationByImo(hit.imo) : Promise.resolve(null),
      hit.mmsi ? fetchMyShipTrackingPosition(hit.mmsi) : Promise.resolve(null),
    ]);

    const seaArea = mstPosition?.area || vfLocation?.area || null;
    const nearest = mstPosition ? nearestCountry(mstPosition.lat, mstPosition.lon, seaArea) : null;

    const locationText = formatVesselLocationText({
      seaArea,
      nearestCountryAr: nearest?.nameAr ?? null,
    });

    if (!locationText) {
      return { hit, locationText: null, trackingStatus: "pending" };
    }

    return {
      hit,
      locationText,
      trackingStatus: "ok",
    };
  } catch {
    return { hit: null, locationText: null, trackingStatus: "error" };
  }
}
