import type { SupabaseClient } from "@supabase/supabase-js";
import { trackVesselByName } from "@/lib/vessel-tracking/track";

export async function syncShipmentVesselTracking(
  supabase: SupabaseClient,
  shipment: { id: string; vessel_name: string | null }
): Promise<"updated" | "not_found" | "failed" | "skipped"> {
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

    await supabase
      .from("shipments")
      .update({
        vessel_imo: result.hit.imo ?? null,
        vessel_mmsi: result.hit.mmsi ?? null,
        weiyun_ship_id: result.hit.weiyunShipID ?? null,
        vessel_location_text: result.locationText,
        vessel_tracking_status: result.trackingStatus,
        vessel_tracked_at: trackedAt,
      })
      .eq("id", shipment.id);

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
