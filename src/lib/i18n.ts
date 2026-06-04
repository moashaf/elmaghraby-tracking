export type AppLanguage = "ar" | "en";

export const DEFAULT_LANGUAGE: AppLanguage = "ar";

export function languageToDir(lang: AppLanguage): "rtl" | "ltr" {
  return lang === "ar" ? "rtl" : "ltr";
}

type Dictionary = Record<string, { ar: string; en: string }>;

// Keep keys stable. Missing keys will fall back to Arabic (existing UI).
export const DICT: Dictionary = {
  "app.name": { ar: "Elmaghraby Tracing", en: "Elmaghraby Tracing" },
  "app.tagline": { ar: "تتبع الشحنات والاستيراد", en: "Shipments & Import Tracking" },
  "app.rtlBadge": { ar: "نظام عربي RTL", en: "English UI (LTR)" },
  "auth.signOut": { ar: "خروج", en: "Sign out" },
  "role.viewer": { ar: "مشاهدة فقط", en: "View only" },

  "nav.dashboard": { ar: "لوحة التحكم", en: "Dashboard" },
  "nav.shipments": { ar: "الشحنات", en: "Shipments" },
  "nav.newShipment": { ar: "شحنة جديدة", en: "New shipment" },
  "nav.categories": { ar: "الفئات", en: "Categories" },
  "nav.products": { ar: "المنتجات", en: "Products" },
  "nav.productsSearch": { ar: "بحث المنتجات", en: "Product search" },
  "nav.suppliers": { ar: "الموردين", en: "Suppliers" },
  "nav.companies": { ar: "الشركات", en: "Companies" },
  "nav.routes": { ar: "مسارات الشحن", en: "Shipping routes" },
  "nav.reports": { ar: "التقارير", en: "Reports" },
  "nav.users": { ar: "المستخدمون", en: "Users" },
  "nav.settings": { ar: "الإعدادات", en: "Settings" },

  "dashboard.title": { ar: "لوحة التحكم", en: "Dashboard" },
  "dashboard.subtitle": { ar: "نظرة تشغيلية على الشحنات والحاويات والمنتجات الواردة.", en: "Operational overview of shipments, containers, and incoming products." },
  "dashboard.importantAlerts": { ar: "تنبيهات مهمة", en: "Important alerts" },
  "dashboard.recentShipments": { ar: "آخر الشحنات", en: "Latest shipments" },
  "dashboard.quickActions": { ar: "إجراءات سريعة", en: "Quick actions" },
  "dashboard.viewAll": { ar: "عرض الكل", en: "View all" },
  "dashboard.empty": { ar: "لا توجد بيانات لعرضها.", en: "No data to show." },

  "shipment.number": { ar: "رقم الشحنة", en: "Shipment #" },
  "shipment.company": { ar: "الشركة", en: "Company" },
  "shipment.supplier": { ar: "المورد", en: "Supplier" },
  "shipment.status": { ar: "الحالة", en: "Status" },
  "shipment.eta": { ar: "ETA", en: "ETA" },
  "actions.view": { ar: "عرض", en: "View" },
  "actions.open": { ar: "فتح", en: "Open" },
  "actions.newShipment": { ar: "شحنة جديدة", en: "New shipment" },

  "status.in_sea": { ar: "في البحر", en: "At sea" },
  "status.customs": { ar: "في الجمارك", en: "Customs" },
  "status.closed": { ar: "مغلقة", en: "Closed" },

  "alerts.overdue": { ar: "الشحنات المتأخرة", en: "Overdue shipments" },
  "alerts.eta7": { ar: "ETA خلال 7 أيام", en: "ETA within 7 days" },
  "alerts.incomingContainers": { ar: "حاويات واردة", en: "Incoming containers" },
  "alerts.newProducts": { ar: "منتجات جديدة", en: "New products" },
  "alerts.disassembledProducts": { ar: "منتجات مفككة", en: "Disassembled products" },

  "lang.ar": { ar: "عربي", en: "Arabic" },
  "lang.en": { ar: "English", en: "English" },
  "lang.toggle": { ar: "English", en: "عربي" },
};

export function t(key: string, lang: AppLanguage): string {
  const entry = DICT[key];
  if (!entry) return key;
  return entry[lang] ?? entry.ar;
}

