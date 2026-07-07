import type { SupabaseClient } from "@supabase/supabase-js";
import { isVesselAtArrivalPort } from "@/lib/vessel-tracking/arrival-detection";
import { trackVesselByName } from "@/lib/vessel-tracking/track";

export type VesselSyncShipment = {
  id: string;
  vessel_name: string | null;
  arrival_port?: string | null;
  status?: string | null;
};

export type VesselSyncOutcome =
  | "updated"
  | "not_found"
  | "failed"
  | "skipped"
  | "moved_to_customs"
  | "reverted_to_in_sea";

function canCheckPortPosition(
  lat: number | null,
  lon: number | null,
  arrivalPort: string | null | undefined
) {
  return lat != null && lon != null && (arrivalPort ?? "").trim() !== "";
}

export async function syncShipmentVesselTracking(
  supabase: SupabaseClient,
  shipment: VesselSyncShipment
): Promise<VesselSyncOutcome> {
  const vesselName = (shipment.vessel_name ?? "").trim();
  if (!vesselName) return "skipped";

  try {
    const result = await trackVesselByName(vesselName);
    const trackedAt = new Date().toISOString();

    if (result.trackingStatus === "not_found") {
      await supabase
        .from("shipments")
        .update({
          vessel_tracking_status: "not_found",
          vessel_tracked_at: trackedAt,
        })
        .eq("id", shipment.id);
      return "not_found";
    }

    if (result.trackingStatus === "error" || !result.hit) {
      await supabase
        .from("shipments")
        .update({
          vessel_tracking_status: "error",
          vessel_tracked_at: trackedAt,
        })
        .eq("id", shipment.id);
      return "failed";
    }

    const hasPosition = canCheckPortPosition(result.lat, result.lon, shipment.arrival_port);
    const atPort =
      hasPosition && isVesselAtArrivalPort(result.lat!, result.lon!, shipment.arrival_port!);

    const updatePayload: Record<string, unknown> = {
      vessel_imo: result.hit.imo ?? null,
      vessel_mmsi: result.hit.mmsi ?? null,
      weiyun_ship_id: result.hit.weiyunShipID ?? null,
      vessel_location_text: result.locationText,
      vessel_tracking_status: result.trackingStatus,
      vessel_tracked_at: trackedAt,
      updated_at: trackedAt,
    };

    if (shipment.status === "in_sea" && atPort) {
      updatePayload.status = "customs";
      updatePayload.previous_status = "in_sea";
      updatePayload.auto_moved_to_customs_at = trackedAt;
    } else if (shipment.status === "customs" && hasPosition && !atPort) {
      updatePayload.status = "in_sea";
      updatePayload.previous_status = null;
      updatePayload.auto_moved_to_customs_at = null;
    }

    await supabase.from("shipments").update(updatePayload).eq("id", shipment.id);

    if (shipment.status === "in_sea" && atPort) return "moved_to_customs";
    if (shipment.status === "customs" && hasPosition && !atPort) return "reverted_to_in_sea";
    return "updated";
  } catch {
    await supabase
      .from("shipments")
      .update({
        vessel_tracking_status: "error",
        vessel_tracked_at: new Date().toISOString(),
      })
      .eq("id", shipment.id);
    return "failed";
  }
}
