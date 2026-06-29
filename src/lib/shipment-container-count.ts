import type { ShipmentStatus } from "@/lib/constants";

export type ShipmentStatusSummary = Record<
  ShipmentStatus,
  {
    shipments: number;
    containers: number;
  }
>;

export function readEmbeddedContainerCount(value: unknown): number {
  if (Array.isArray(value)) {
    const first = value[0];
    if (first && typeof first === "object" && "count" in first) {
      return Number((first as { count: number }).count) || 0;
    }
    return value.length;
  }

  if (value && typeof value === "object" && "count" in value) {
    return Number((value as { count: number }).count) || 0;
  }

  return 0;
}

export function buildContainerCountMap<T extends { shipment_id: string }>(rows: T[]) {
  return rows.reduce((map, row) => {
    map.set(row.shipment_id, (map.get(row.shipment_id) ?? 0) + 1);
    return map;
  }, new Map<string, number>());
}

export function sumReportColumn(rows: Array<Record<string, string | number | null | undefined>>, key: string) {
  return rows.reduce((sum, row) => {
    const value = row[key];
    const parsed = Number(value);
    return sum + (Number.isFinite(parsed) ? parsed : 0);
  }, 0);
}

export function computeShipmentStatusSummary(
  rows: Array<{ status: ShipmentStatus; containers_count: number }>
): ShipmentStatusSummary {
  const summary: ShipmentStatusSummary = {
    in_sea: { shipments: 0, containers: 0 },
    customs: { shipments: 0, containers: 0 },
    closed: { shipments: 0, containers: 0 },
  };

  for (const row of rows) {
    summary[row.status].shipments += 1;
    summary[row.status].containers += row.containers_count;
  }

  return summary;
}

export const SHIPMENT_STATUS_SORT_ORDER: ShipmentStatus[] = ["in_sea", "customs", "closed"];

/** Statuses shown in the open-shipment summary (excludes closed). */
export const OPEN_SHIPMENT_STATUS_SORT_ORDER: ShipmentStatus[] = ["in_sea", "customs"];
