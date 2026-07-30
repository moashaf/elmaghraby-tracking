import type { Shipment } from "@/lib/types";

type VesselLinkFields = {
  id?: string;
  vessel_name?: string | null;
  vessel_imo?: string | null;
  vessel_mmsi?: string | null;
  vessel_location_text?: string | null;
};

/** Prefer VesselFinder (IMO) then MyShipTracking (MMSI). */
export function vesselExternalTrackingUrl(shipment: VesselLinkFields): string | null {
  const imo = shipment.vessel_imo?.trim();
  if (imo) {
    return `https://www.vesselfinder.com/vessels/details/${encodeURIComponent(imo)}`;
  }

  const mmsi = shipment.vessel_mmsi?.trim();
  if (mmsi) {
    return `https://www.myshiptracking.com/vessels/${encodeURIComponent(mmsi)}`;
  }

  const name = shipment.vessel_name?.trim();
  if (name) {
    return `https://www.vesselfinder.com/?name=${encodeURIComponent(name)}`;
  }

  return null;
}

export function vesselLocationHref(shipment: VesselLinkFields): string | null {
  const external = vesselExternalTrackingUrl(shipment);
  if (external) return external;

  if (shipment.id) return `/shipments/${shipment.id}`;
  return null;
}

export function canLinkVesselLocation(shipment: VesselLinkFields): boolean {
  return Boolean(
    shipment.vessel_imo?.trim() ||
      shipment.vessel_mmsi?.trim() ||
      shipment.vessel_name?.trim()
  );
}

export type { VesselLinkFields };
export type ShipmentVesselFields = Pick<
  Shipment,
  "id" | "vessel_name" | "vessel_imo" | "vessel_mmsi" | "vessel_location_text"
>;
