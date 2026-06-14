export type ReportSlug =
  | "summary"
  | "in-sea"
  | "customs"
  | "delayed"
  | "arriving-10"
  | "closed"
  | "incoming-products"
  | "costs"
  | "ready-to-close"
  | "containers"
  | "container-files"
  | "new-products"
  | "disassembled-products"
  | "duplicate-products"
  | "date-range-products"
  | "product-history"
  | "suppliers"
  | "companies"
  | "all-products";

export type ReportDateFilter = "none" | "eta" | "closed";

export const REPORTS: Array<{
  slug: ReportSlug;
  title: string;
  description: string;
  dateFilter: ReportDateFilter;
  dateHint?: string;
}> = [
  { slug: "summary", title: "ملخص الشحنات", description: "جميع الشحنات مرتبة برقم الفاتورة (ملف INV).", dateFilter: "eta", dateHint: "فلترة حسب تاريخ الوصول المتوقع (ETA)" },
  { slug: "in-sea", title: "الشحنات في البحر", description: "الشحنات الحالية قبل الجمارك.", dateFilter: "eta", dateHint: "فلترة حسب ETA" },
  { slug: "customs", title: "الشحنات في الجمارك", description: "شحنات جاهزة للمراجعة أو الإغلاق.", dateFilter: "eta", dateHint: "فلترة حسب ETA" },
  { slug: "delayed", title: "الشحنات المتأخرة", description: "شحنات تجاوزت ETA ولم تُغلق بعد.", dateFilter: "none" },
  { slug: "arriving-10", title: "وصول خلال 10 أيام", description: "شحنات متوقعة الوصول خلال 10 أيام.", dateFilter: "none" },
  { slug: "closed", title: "الشحنات المغلقة", description: "كل الشحنات التي تم إغلاقها.", dateFilter: "closed", dateHint: "فلترة حسب تاريخ الإغلاق" },
  { slug: "incoming-products", title: "منتجات واردة", description: "منتجات الشحنات المفتوحة والمغلقة.", dateFilter: "eta", dateHint: "فلترة حسب ETA للشحنة" },
  { slug: "costs", title: "تقرير المصاريف", description: "تكاليف الشحنات وإجمالي الإغلاق.", dateFilter: "closed", dateHint: "فلترة حسب تاريخ الإغلاق" },
  { slug: "ready-to-close", title: "جاهزة للإغلاق", description: "الشحنات الموجودة في الجمارك.", dateFilter: "none" },
  { slug: "containers", title: "الحاويات", description: "كل الحاويات وأوزانها وكرتينها.", dateFilter: "eta", dateHint: "فلترة حسب ETA للشحنة" },
  { slug: "container-files", title: "ملفات الحاويات", description: "كل ملفات Excel/CSV المرفوعة مع إمكانية التحميل.", dateFilter: "none" },
  { slug: "new-products", title: "منتجات جديدة", description: "منتجات واردة معلمة كجديدة.", dateFilter: "eta", dateHint: "فلترة حسب ETA للشحنة" },
  {
    slug: "disassembled-products",
    title: "منتجات مفككة",
    description: "منتجات واردة معلمة كمفككة.",
    dateFilter: "eta",
    dateHint: "فلترة حسب ETA للشحنة",
  },
  { slug: "duplicate-products", title: "منتجات مكررة", description: "منتجات موجودة في أكثر من شحنة مفتوحة.", dateFilter: "none" },
  { slug: "date-range-products", title: "منتجات بفترة", description: "منتجات الشحنات داخل فترة ETA محددة.", dateFilter: "eta", dateHint: "فلترة حسب ETA للشحنة" },
  { slug: "product-history", title: "تاريخ منتج", description: "تاريخ استيراد المنتجات من الشحنات.", dateFilter: "eta", dateHint: "فلترة حسب ETA للشحنة" },
  { slug: "suppliers", title: "الموردين", description: "ملخص الموردين وعدد الشحنات.", dateFilter: "none" },
  { slug: "companies", title: "شركات الاستيراد", description: "ملخص الشركات وعدد الشحنات.", dateFilter: "none" },
  {
    slug: "all-products",
    title: "الأصناف",
    description: "كل المنتجات على النظام: الاسم، الكود (SKU)، والباركود — مع تصدير Excel.",
    dateFilter: "none",
  },
];

export function getReport(slug: string) {
  return REPORTS.find((report) => report.slug === slug);
}
