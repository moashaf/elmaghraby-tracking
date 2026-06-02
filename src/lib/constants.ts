export const APP_CREDIT_NAME = "Mohamed Ashraf";

export const SHIPMENT_STATUSES = ["in_sea", "customs", "closed"] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  in_sea: "في البحر",
  customs: "في الجمارك",
  closed: "مغلقة",
};

export const SHIPMENT_STATUS_LABELS_EN: Record<ShipmentStatus, string> = {
  in_sea: "At sea",
  customs: "Customs",
  closed: "Closed",
};

export const SHIPMENT_TYPES = ["FCL", "LCL"] as const;

export function getNextStatusAction(
  status: ShipmentStatus
): "to_customs" | "to_close" | "edit_costs" | null {
  if (status === "in_sea") return "to_customs";
  if (status === "customs") return "to_close";
  if (status === "closed") return "edit_costs";
  return null;
}

export const NEXT_ACTION_LABELS: Record<
  NonNullable<ReturnType<typeof getNextStatusAction>>,
  string
> = {
  to_customs: "التالي: الجمارك",
  to_close: "التالي: المصاريف والإغلاق",
  edit_costs: "تعديل المصاريف",
};
