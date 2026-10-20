import type { SupabaseClient } from "@supabase/supabase-js";
import { cargoEtaAfterVoyageWindow, daysBetweenIsoDates, etaRolledIntoNextVoyage, todayIsoDate } from "@/lib/eta";
import { resolveArrivalEtaFromVoyage, voyageShowsArrivalAtPort } from "@/lib/vessel-tracking/announced-eta";
import { isVesselAtArrivalPort } from "@/lib/vessel-tracking/arrival-detection";
import { trackVesselByName } from "@/lib/vessel-tracking/track";

export type VesselSyncShipment = {
  id: string;
  vessel_name: string | null;
  arrival_port?: string | null;
  shipped_at?: string | null;
  eta?: string | null;
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

function applyRolledEtaArrival(
  shipment: VesselSyncShipment,
  updatePayload: Record<string, unknown>,
  etaIso: string | null,
  cargoArrived: boolean
) {
  const today = todayIsoDate();
  const shippedAt = (shipment.shipped_at ?? "").trim();
  let nextEta = etaIso;
  let arrived = cargoArrived;

  if (nextEta) {
    nextEta = cargoEtaAfterVoyageWindow(nextEta, shippedAt, today) || nextEta;
  }

  if (!arrived && etaRolledIntoNextVoyage(shipment.eta, shippedAt, today)) {
    nextEta = cargoEtaAfterVoyageWindow(shipment.eta, shippedAt, today);
    arrived = true;
  }

  if (nextEta) {
    updatePayload.eta = nextEta;
    const duration = shippedAt ? daysBetweenIsoDates(shippedAt, nextEta) : null;
    if (duration != null) updatePayload.shipping_duration_days = Math.max(0, duration);
  }

  return arrived;
}

export async function syncShipmentVesselTracking(
  supabase: SupabaseClient,
  shipment: VesselSyncShipment
): Promise<VesselSyncOutcome> {
  const vesselName = (shipment.vessel_name ?? "").trim();
  if (!vesselName) return "skipped";
  if (shipment.status !== "in_sea") return "skipped";

  const trackedAt = new Date().toISOString();

  const moveFromRolledEta = async () => {
    if (!etaRolledIntoNextVoyage(shipment.eta, shipment.shipped_at)) return false;
    const etaIso = cargoEtaAfterVoyageWindow(shipment.eta, shipment.shipped_at);
    const shippedAt = (shipment.shipped_at ?? "").trim();
    const duration = shippedAt && etaIso ? daysBetweenIsoDates(shippedAt, etaIso) : null;
    await supabase
      .from("shipments")
      .update({
        eta: etaIso,
        ...(duration != null ? { shipping_duration_days: Math.max(0, duration) } : {}),
        status: "customs",
        previous_status: "in_sea",
        auto_moved_to_customs_at: trackedAt,
        vessel_location_text: `في الجمارك — ${(shipment.arrival_port ?? "").trim() || "الميناء"}`,
        updated_at: trackedAt,
      })
      .eq("id", shipment.id);
    return true;
  };

  try {
    const result = await trackVesselByName(vesselName);

    if (result.trackingStatus === "not_found") {
      if (await moveFromRolledEta()) return "moved_to_customs";
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
      if (await moveFromRolledEta()) return "moved_to_customs";
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
    const portArrival = voyageShowsArrivalAtPort({
      arrivalPort: shipment.arrival_port,
      portCalls: result.portCalls,
    });
    const cargoArrived = atPort || portArrival.arrived;

    const updatePayload: Record<string, unknown> = {
      vessel_imo: result.hit.imo ?? null,
      vessel_mmsi: result.hit.mmsi ?? null,
      weiyun_ship_id: result.hit.weiyunShipID ?? null,
      vessel_location_text: result.locationText,
      vessel_tracking_status: result.trackingStatus,
      vessel_tracked_at: trackedAt,
      updated_at: trackedAt,
    };

    const etaIso = portArrival.arrived
      ? portArrival.arrivalDateIso
      : resolveArrivalEtaFromVoyage({
          arrivalPort: shipment.arrival_port,
          destination: result.destination,
          currentEtaIso: result.etaIso,
          portCalls: result.portCalls,
        });

    const arrived = applyRolledEtaArrival(shipment, updatePayload, etaIso, cargoArrived);

    if (shipment.status === "in_sea" && arrived) {
      updatePayload.status = "customs";
      updatePayload.previous_status = "in_sea";
      updatePayload.auto_moved_to_customs_at = trackedAt;
      updatePayload.vessel_location_text = `في الجمارك — ${(shipment.arrival_port ?? "").trim() || "الميناء"}`;
    }

    await supabase.from("shipments").update(updatePayload).eq("id", shipment.id);

    if (shipment.status === "in_sea" && arrived) return "moved_to_customs";
    return "updated";
  } catch {
    if (await moveFromRolledEta()) return "moved_to_customs";
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
