export type AppLanguage = "ar" | "en" | "zh";

export const APP_LANGUAGES: AppLanguage[] = ["ar", "en", "zh"];

export const DEFAULT_LANGUAGE: AppLanguage = "ar";

export function languageToDir(lang: AppLanguage): "rtl" | "ltr" {
  return lang === "ar" ? "rtl" : "ltr";
}

export function languageToLocale(lang: AppLanguage): string {
  if (lang === "ar") return "ar-EG";
  if (lang === "zh") return "zh-CN";
  return "en-GB";
}

type DictionaryEntry = { ar: string; en: string; zh: string };
type Dictionary = Record<string, DictionaryEntry>;

export const DICT: Dictionary = {
  "app.name": { ar: "Elmaghraby Tracing", en: "Elmaghraby Tracing", zh: "Elmaghraby Tracing" },
  "app.tagline": { ar: "تتبع الشحنات والاستيراد", en: "Shipments & Import Tracking", zh: "货运与进口跟踪" },
  "app.rtlBadge": { ar: "نظام عربي RTL", en: "English UI (LTR)", zh: "中文界面" },
  "auth.signOut": { ar: "خروج", en: "Sign out", zh: "退出" },
  "role.viewer": { ar: "مشاهدة فقط", en: "View only", zh: "仅查看" },

  "nav.dashboard": { ar: "لوحة التحكم", en: "Dashboard", zh: "控制台" },
  "nav.shipments": { ar: "الشحنات", en: "Shipments", zh: "货运" },
  "nav.newShipment": { ar: "شحنة جديدة", en: "New shipment", zh: "新建货运" },
  "nav.categories": { ar: "الفئات", en: "Categories", zh: "类别" },
  "nav.products": { ar: "المنتجات", en: "Products", zh: "产品" },
  "nav.productsSearch": { ar: "بحث المنتجات", en: "Product search", zh: "产品搜索" },
  "nav.suppliers": { ar: "الموردين", en: "Suppliers", zh: "供应商" },
  "nav.companies": { ar: "الشركات", en: "Companies", zh: "公司" },
  "nav.routes": { ar: "مسارات الشحن", en: "Shipping routes", zh: "航运路线" },
  "nav.reports": { ar: "التقارير", en: "Reports", zh: "报告" },
  "nav.purchaseOrders": { ar: "أوامر الشراء", en: "Purchase orders", zh: "采购订单" },
  "nav.newPurchaseOrder": { ar: "أمر شراء جديد", en: "New PO", zh: "新建采购单" },
  "nav.supplierPortal": { ar: "بوابة المورد", en: "Supplier portal", zh: "供应商门户" },
  "nav.awaitingReceipt": { ar: "أصناف تحت الاستلام", en: "Awaiting receipt", zh: "待收货" },
  "nav.users": { ar: "المستخدمون", en: "Users", zh: "用户" },
  "nav.settings": { ar: "الإعدادات", en: "Settings", zh: "设置" },

  "dashboard.title": { ar: "لوحة التحكم", en: "Dashboard", zh: "控制台" },
  "dashboard.subtitle": {
    ar: "نظرة تشغيلية على الشحنات والحاويات والمنتجات الواردة.",
    en: "Operational overview of shipments, containers, and incoming products.",
    zh: "货运、集装箱和在途产品的运营概览。",
  },
  "dashboard.importantAlerts": { ar: "تنبيهات مهمة", en: "Important alerts", zh: "重要提醒" },
  "dashboard.recentShipments": { ar: "آخر الشحنات", en: "Latest shipments", zh: "最新货运" },
  "dashboard.quickActions": { ar: "إجراءات سريعة", en: "Quick actions", zh: "快捷操作" },
  "dashboard.viewAll": { ar: "عرض الكل", en: "View all", zh: "查看全部" },
  "dashboard.empty": { ar: "لا توجد بيانات لعرضها.", en: "No data to show.", zh: "暂无数据。" },

  "shipment.number": { ar: "رقم الفاتورة", en: "Invoice no.", zh: "发票号" },
  "shipment.company": { ar: "الشركة", en: "Company", zh: "公司" },
  "shipment.supplier": { ar: "المورد", en: "Supplier", zh: "供应商" },
  "shipment.status": { ar: "الحالة", en: "Status", zh: "状态" },
  "shipment.eta": { ar: "ETA", en: "ETA", zh: "ETA" },
  "actions.view": { ar: "عرض", en: "View", zh: "查看" },
  "actions.open": { ar: "فتح", en: "Open", zh: "打开" },
  "actions.newShipment": { ar: "شحنة جديدة", en: "New shipment", zh: "新建货运" },

  "status.in_sea": { ar: "في البحر", en: "At sea", zh: "在途" },
  "status.customs": { ar: "في الجمارك", en: "In customs", zh: "清关中" },
  "status.closed": { ar: "مغلقة", en: "Closed", zh: "已结案" },

  "alerts.overdue": { ar: "الشحنات المتأخرة", en: "Overdue shipments", zh: "延误货运" },
  "alerts.eta7": { ar: "ETA خلال 7 أيام", en: "ETA within 7 days", zh: "7 天内到达" },
  "alerts.incomingContainers": { ar: "حاويات واردة", en: "Incoming containers", zh: "在途集装箱" },
  "alerts.newProducts": { ar: "منتجات جديدة", en: "New products", zh: "新产品" },
  "alerts.disassembledProducts": { ar: "منتجات مفككة", en: "Disassembled products", zh: "拆散件产品" },

  "lang.ar": { ar: "عربي", en: "Arabic", zh: "阿拉伯语" },
  "lang.en": { ar: "English", en: "English", zh: "英语" },
  "lang.zh": { ar: "中文", en: "Chinese", zh: "中文" },
};

export function t(key: string, lang: AppLanguage): string {
  const entry = DICT[key];
  if (!entry) return key;
  return entry[lang] ?? entry.ar;
}

export { INLINE_TRANSLATIONS } from "@/lib/i18n/inline-translations";
export { translateColumn, COLUMN_TRANSLATIONS } from "@/lib/i18n/columns";
export { getStatusLabel, getNextActionLabel, getRoleLabel } from "@/lib/i18n/labels";
export { getLocalizedReport, getLocalizedReports, findLocalizedReport } from "@/lib/i18n/reports-meta";

import { INLINE_TRANSLATIONS } from "@/lib/i18n/inline-translations";
import { translateColumn } from "@/lib/i18n/columns";
import type { ShipmentStatus } from "@/lib/constants";
import { getStatusLabel } from "@/lib/i18n/labels";
import type { ReportRow } from "@/lib/reports/shipment-helpers";

export function resolveInline(
  arText: string,
  lang: AppLanguage,
  overrides?: { en?: string; zh?: string }
): string {
  if (lang === "ar") return arText;
  const entry = INLINE_TRANSLATIONS[arText];
  const en = overrides?.en ?? entry?.en ?? arText;
  const zh = overrides?.zh ?? entry?.zh ?? en;
  return lang === "zh" ? zh : en;
}

export function localizeQuantityCell(text: string, lang: AppLanguage): string {
  if (lang === "ar") return text;
  return text
    .replace(/(\d+)\s*كرتونة\s*\((\d+)\s*قطعة\)/g, (_, c, p) =>
      lang === "zh" ? `${c} 箱（${p} 件）` : `${c} carton(s) (${p} pcs)`
    )
    .replace(/(\d+)\s*قطعة/g, (_, p) => (lang === "zh" ? `${p} 件` : `${p} pcs`))
    .replace(/ — مفكك/g, lang === "zh" ? " — 拆散件" : " — disassembled")
    .replace(/ — كامل/g, lang === "zh" ? " — 完整件" : " — complete");
}

export function localizeReportCell(
  columnKey: string,
  value: unknown,
  lang: AppLanguage,
  row?: ReportRow
): string {
  if (value == null || value === "") return "-";
  const str = String(value);
  if (columnKey === "الحالة" && row?._status) {
    return getStatusLabel(row._status as ShipmentStatus, lang);
  }
  if (str === "نعم" || str === "لا" || str === "نشط" || str === "متوقف") {
    return resolveInline(str, lang);
  }
  if (str.includes("كرتونة") || str.includes("قطعة") || str.includes("مفكك") || str.includes("كامل")) {
    return localizeQuantityCell(str, lang);
  }
  return str;
}

export function localizeReportHeaders(keys: string[], lang: AppLanguage): string[] {
  return keys.map((key) => translateColumn(key, lang));
}

export function isAppLanguage(value: string | null | undefined): value is AppLanguage {
  return value === "ar" || value === "en" || value === "zh";
}
