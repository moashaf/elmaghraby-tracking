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

    if (!hit.imo) {
      return { hit, locationText: null, trackingStatus: "pending" };
    }

    const location = await fetchVesselLocationByImo(hit.imo);
    if (!location?.locationText) {
      return { hit, locationText: null, trackingStatus: "pending" };
    }

    return {
      hit,
      locationText: location.locationText,
      trackingStatus: "ok",
    };
  } catch {
    return { hit: null, locationText: null, trackingStatus: "error" };
  }
}
