export type ReportSlug =
  | "summary"
  | "in-sea"
  | "customs"
  | "delayed"
  | "arriving-30"
  | "closed"
  | "incoming-products"
  | "costs"
  | "ready-to-close"
  | "containers"
  | "container-files"
  | "new-products"
  | "duplicate-products"
  | "date-range-products"
  | "product-history"
  | "suppliers"
  | "companies";

export const REPORTS: Array<{ slug: ReportSlug; title: string; description: string }> = [
  { slug: "summary", title: "ملخص الشحنات", description: "كل الشحنات مع الشركة والمورد والحالة." },
  { slug: "in-sea", title: "الشحنات في البحر", description: "الشحنات الحالية قبل الجمارك." },
  { slug: "customs", title: "الشحنات في الجمارك", description: "شحنات جاهزة للمراجعة أو الإغلاق." },
  { slug: "delayed", title: "الشحنات المتأخرة", description: "محسوبة من ETA بدون حالة إضافية." },
  { slug: "arriving-30", title: "وصول خلال 30 يوم", description: "شحنات متوقعة الوصول قريبا." },
  { slug: "closed", title: "الشحنات المغلقة", description: "كل الشحنات التي تم إغلاقها." },
  { slug: "incoming-products", title: "منتجات واردة", description: "منتجات الشحنات المفتوحة والمغلقة." },
  { slug: "costs", title: "تقرير المصاريف", description: "تكاليف الشحنات وإجمالي الإغلاق." },
  { slug: "ready-to-close", title: "جاهزة للإغلاق", description: "الشحنات الموجودة في الجمارك." },
  { slug: "containers", title: "الحاويات", description: "كل الحاويات وأوزانها وكرتينها." },
  { slug: "container-files", title: "ملفات الحاويات", description: "ملفات Excel/CSV المرفوعة للحاويات." },
  { slug: "new-products", title: "منتجات جديدة", description: "منتجات واردة معلمة كجديدة." },
  { slug: "duplicate-products", title: "منتجات مكررة", description: "منتجات موجودة في أكثر من شحنة مفتوحة." },
  { slug: "date-range-products", title: "منتجات بفترة", description: "منتجات الشحنات داخل فترة محددة." },
  { slug: "product-history", title: "تاريخ منتج", description: "تاريخ استيراد المنتجات من الشحنات." },
  { slug: "suppliers", title: "الموردين", description: "ملخص الموردين وعدد الشحنات." },
  { slug: "companies", title: "شركات الاستيراد", description: "ملخص الشركات وعدد الشحنات." },
];

export function getReport(slug: string) {
  return REPORTS.find((report) => report.slug === slug);
}
