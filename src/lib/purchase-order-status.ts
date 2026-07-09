export const PO_STATUSES = [
  "draft",
  "confirmed",
  "partially_received",
  "received",
  "over_received",
  "cancelled",
] as const;

export type PoStatus = (typeof PO_STATUSES)[number];

const PO_STATUS_I18N: Record<PoStatus, { ar: string; en: string; zh: string }> = {
  draft: { ar: "مسودة", en: "Draft", zh: "草稿" },
  confirmed: { ar: "مؤكد", en: "Confirmed", zh: "已确认" },
  partially_received: { ar: "استلام جزئي", en: "Partially received", zh: "部分收货" },
  received: { ar: "مستلم بالكامل", en: "Fully received", zh: "已全部收货" },
  over_received: { ar: "استلام زائد", en: "Over received", zh: "超额收货" },
  cancelled: { ar: "ملغي", en: "Cancelled", zh: "已取消" },
};

export function getPoStatusLabel(status: PoStatus, lang: import("@/lib/i18n").AppLanguage): string {
  const entry = PO_STATUS_I18N[status];
  if (lang === "zh") return entry.zh;
  if (lang === "en") return entry.en;
  return entry.ar;
}

export function canStaffEditPo(status: PoStatus): boolean {
  return status === "draft" || status === "confirmed";
}

export function canSupplierConfirmPo(status: PoStatus): boolean {
  return status === "draft";
}

export function canReceivePo(status: PoStatus): boolean {
  return status === "confirmed" || status === "partially_received" || status === "over_received";
}

export type PoItemStatus = "draft" | "awaiting_receipt" | "received" | "cancelled";

const PO_ITEM_STATUS_I18N: Record<PoItemStatus, { ar: string; en: string; zh: string }> = {
  draft: { ar: "بانتظار التأكيد", en: "Pending confirmation", zh: "待确认" },
  awaiting_receipt: { ar: "بانتظار الاستلام", en: "Awaiting receipt", zh: "待收货" },
  received: { ar: "تم الاستلام (مخزن الصين)", en: "Received (China warehouse)", zh: "已收货（中国仓）" },
  cancelled: { ar: "ملغي", en: "Cancelled", zh: "已取消" },
};

export function getPoItemStatusLabel(status: PoItemStatus, lang: import("@/lib/i18n").AppLanguage): string {
  const entry = PO_ITEM_STATUS_I18N[status];
  if (lang === "zh") return entry.zh;
  if (lang === "en") return entry.en;
  return entry.ar;
}

export function isItemLocked(status: PoItemStatus): boolean {
  return status !== "draft";
}
