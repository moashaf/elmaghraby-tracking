import type { AppLanguage } from "@/lib/i18n";
import type { ShipmentStatus } from "@/lib/constants";
import type { UserRole } from "@/lib/permissions";

const STATUS: Record<ShipmentStatus, { ar: string; en: string; zh: string }> = {
  in_sea: { ar: "في البحر", en: "At sea", zh: "在途" },
  customs: { ar: "في الجمارك", en: "In customs", zh: "清关中" },
  closed: { ar: "مغلقة", en: "Closed", zh: "已结案" },
};

const NEXT_ACTION: Record<
  "to_customs" | "to_close" | "edit_costs",
  { ar: string; en: string; zh: string }
> = {
  to_customs: { ar: "التالي: الجمارك", en: "Next: Customs", zh: "下一步：清关" },
  to_close: { ar: "التالي: المصاريف والإغلاق", en: "Next: Costs & close", zh: "下一步：费用与结案" },
  edit_costs: { ar: "تعديل المصاريف", en: "Edit costs", zh: "编辑费用" },
};

const ROLES: Record<UserRole, { ar: string; en: string; zh: string }> = {
  admin: { ar: "مدير النظام", en: "System admin", zh: "系统管理员" },
  manager: { ar: "مشرف", en: "Manager", zh: "主管" },
  viewer: { ar: "مشاهدة فقط", en: "View only", zh: "仅查看" },
};

function pick<T extends { ar: string; en: string; zh: string }>(entry: T, lang: AppLanguage): string {
  if (lang === "ar") return entry.ar;
  if (lang === "zh") return entry.zh;
  return entry.en;
}

export function getStatusLabel(status: ShipmentStatus, lang: AppLanguage): string {
  return pick(STATUS[status], lang);
}

export function getNextActionLabel(
  action: "to_customs" | "to_close" | "edit_costs",
  lang: AppLanguage
): string {
  return pick(NEXT_ACTION[action], lang);
}

export function getRoleLabel(role: UserRole, lang: AppLanguage): string {
  return pick(ROLES[role], lang);
}

export { STATUS, NEXT_ACTION, ROLES };
