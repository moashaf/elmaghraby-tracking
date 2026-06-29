import type { AppLanguage } from "@/lib/i18n";

type Col = { en: string; zh: string };

/** Report / Excel column headers keyed by Arabic source label. */
export const COLUMN_TRANSLATIONS: Record<string, Col> = {
  م: { en: "#", zh: "序号" },
  "رقم الفاتورة": { en: "Invoice no.", zh: "发票号" },
  ACID: { en: "ACID", zh: "ACID" },
  الشركة: { en: "Company", zh: "公司" },
  المورد: { en: "Supplier", zh: "供应商" },
  "عدد الكراتين": { en: "Cartons", zh: "箱数" },
  "عدد الحاويات": { en: "Containers", zh: "集装箱数" },
  "قيمة الفاتورة ($)": { en: "Shipment value (USD)", zh: "货运价值（美元）" },
  "القيمة ($)": { en: "Value (USD)", zh: "价值（美元）" },
  "تاريخ الشحن": { en: "Ship date", zh: "装运日期" },
  "تاريخ الوصول المتوقع": { en: "ETA", zh: "预计到达" },
  "تاريخ الإغلاق": { en: "Closing date", zh: "结案日期" },
  الحالة: { en: "Status", zh: "状态" },
  "نوع البضاعة": { en: "Cargo type", zh: "货物类型" },
  الكود: { en: "Code", zh: "代码" },
  "اسم الصنف": { en: "Product name", zh: "产品名称" },
  الباركود: { en: "Barcode", zh: "条形码" },
  التصنيف: { en: "Category", zh: "类别" },
  SKU: { en: "SKU", zh: "SKU" },
  المنتج: { en: "Product", zh: "产品" },
  "إجمالي الكمية": { en: "Total quantity", zh: "总数量" },
  "مرات الاستيراد": { en: "Import count", zh: "进口次数" },
  "آخر وصول": { en: "Last arrival", zh: "最近到达" },
  "إجمالي الكرتين": { en: "Total cartons", zh: "总箱数" },
  "إجمالي القطع": { en: "Total pieces", zh: "总件数" },
  "رقم الحاوية": { en: "Container no.", zh: "集装箱号" },
  الوزن: { en: "Weight", zh: "重量" },
  الكرتين: { en: "Cartons", zh: "箱数" },
  الحاوية: { en: "Container", zh: "集装箱" },
  الملف: { en: "File", zh: "文件" },
  "حجم الملف (بايت)": { en: "File size (bytes)", zh: "文件大小（字节）" },
  "تاريخ الرفع": { en: "Upload date", zh: "上传日期" },
  جمارك: { en: "Customs", zh: "关税" },
  شحن: { en: "Shipping", zh: "运费" },
  تخليص: { en: "Clearance", zh: "清关费" },
  "نقل داخلي": { en: "Local transport", zh: "国内运输" },
  أخرى: { en: "Other", zh: "其他" },
  الإجمالي: { en: "Total", zh: "合计" },
  ملاحظات: { en: "Notes", zh: "备注" },
  الكمية: { en: "Quantity", zh: "数量" },
  "منتج جديد": { en: "New product", zh: "新产品" },
  مفكك: { en: "Disassembled", zh: "拆散件" },
  "عدد الشحنات": { en: "Shipments", zh: "货运数量" },
  "ملخص حسب الحالة": { en: "Summary by status", zh: "按状态汇总" },
  التاريخ: { en: "Date", zh: "日期" },
  "اسم الملف": { en: "File name", zh: "文件名" },
  الرابط: { en: "Link", zh: "链接" },
};

export function translateColumn(key: string, lang: AppLanguage): string {
  if (lang === "ar") return key;
  const entry = COLUMN_TRANSLATIONS[key];
  if (!entry) return key;
  return lang === "zh" ? entry.zh : entry.en;
}
