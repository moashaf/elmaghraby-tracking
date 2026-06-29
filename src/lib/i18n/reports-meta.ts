import type { ReportDateFilter, ReportSlug } from "@/lib/report-definitions";
import type { AppLanguage } from "@/lib/i18n";

type ReportMeta = {
  title: { ar: string; en: string; zh: string };
  description: { ar: string; en: string; zh: string };
  dateHint?: { ar: string; en: string; zh: string };
  dateFilter: ReportDateFilter;
};

const REPORT_META: Record<ReportSlug, ReportMeta> = {
  summary: {
    title: { ar: "ملخص الشحنات", en: "Shipment summary", zh: "货运汇总" },
    description: {
      ar: "الشحنات المفتوحة مرتبة برقم الفاتورة (ملف INV) — بدون المغلقة.",
      en: "Open shipments sorted by invoice number (INV file), excluding closed.",
      zh: "按发票号排序的在途货运（不含已关闭）。",
    },
    dateFilter: "eta",
    dateHint: {
      ar: "فلترة حسب تاريخ الوصول المتوقع (ETA)",
      en: "Filter by expected arrival date (ETA)",
      zh: "按预计到达日期（ETA）筛选",
    },
  },
  "in-sea": {
    title: { ar: "الشحنات في البحر", en: "Shipments at sea", zh: "在途货运" },
    description: {
      ar: "الشحنات الحالية قبل الجمارك.",
      en: "Current shipments before customs.",
      zh: "清关前的在途货运。",
    },
    dateFilter: "eta",
    dateHint: { ar: "فلترة حسب ETA", en: "Filter by ETA", zh: "按 ETA 筛选" },
  },
  customs: {
    title: { ar: "الشحنات في الجمارك", en: "Shipments in customs", zh: "清关中货运" },
    description: {
      ar: "شحنات جاهزة للمراجعة أو الإغلاق.",
      en: "Shipments ready for review or closing.",
      zh: "待审核或结案的货运。",
    },
    dateFilter: "eta",
    dateHint: { ar: "فلترة حسب ETA", en: "Filter by ETA", zh: "按 ETA 筛选" },
  },
  delayed: {
    title: { ar: "الشحنات المتأخرة", en: "Delayed shipments", zh: "延误货运" },
    description: {
      ar: "شحنات تجاوزت ETA ولم تُغلق بعد.",
      en: "Shipments past ETA that are not closed yet.",
      zh: "已超过 ETA 且尚未结案的货运。",
    },
    dateFilter: "none",
  },
  "arriving-10": {
    title: { ar: "وصول خلال 10 أيام", en: "Arriving within 10 days", zh: "10 天内到达" },
    description: {
      ar: "شحنات متوقعة الوصول خلال 10 أيام.",
      en: "Shipments expected to arrive within 10 days.",
      zh: "预计 10 天内到达的货运。",
    },
    dateFilter: "none",
  },
  closed: {
    title: { ar: "الشحنات المغلقة", en: "Closed shipments", zh: "已结案货运" },
    description: {
      ar: "كل الشحنات التي تم إغلاقها.",
      en: "All closed shipments.",
      zh: "所有已结案的货运。",
    },
    dateFilter: "closed",
    dateHint: {
      ar: "فلترة حسب تاريخ الإغلاق",
      en: "Filter by closing date",
      zh: "按结案日期筛选",
    },
  },
  "incoming-products": {
    title: { ar: "منتجات واردة", en: "Incoming products", zh: "在途产品" },
    description: {
      ar: "منتجات الشحنات المفتوحة والمغلقة.",
      en: "Products from open and closed shipments.",
      zh: "来自未结案和已结案货运的产品。",
    },
    dateFilter: "eta",
    dateHint: {
      ar: "فلترة حسب ETA للشحنة",
      en: "Filter by shipment ETA",
      zh: "按货运 ETA 筛选",
    },
  },
  costs: {
    title: { ar: "تقرير المصاريف", en: "Costs report", zh: "费用报告" },
    description: {
      ar: "تكاليف الشحنات وإجمالي الإغلاق.",
      en: "Shipment costs and closing totals.",
      zh: "货运费用及结案合计。",
    },
    dateFilter: "closed",
    dateHint: {
      ar: "فلترة حسب تاريخ الإغلاق",
      en: "Filter by closing date",
      zh: "按结案日期筛选",
    },
  },
  "ready-to-close": {
    title: { ar: "جاهزة للإغلاق", en: "Ready to close", zh: "待结案" },
    description: {
      ar: "الشحنات الموجودة في الجمارك.",
      en: "Shipments currently in customs.",
      zh: "当前处于清关中的货运。",
    },
    dateFilter: "none",
  },
  containers: {
    title: { ar: "الحاويات", en: "Containers", zh: "集装箱" },
    description: {
      ar: "كل الحاويات وأوزانها وكرتينها.",
      en: "All containers with weights and cartons.",
      zh: "全部集装箱及其重量和箱数。",
    },
    dateFilter: "eta",
    dateHint: {
      ar: "فلترة حسب ETA للشحنة",
      en: "Filter by shipment ETA",
      zh: "按货运 ETA 筛选",
    },
  },
  "container-files": {
    title: { ar: "ملفات الحاويات", en: "Container files", zh: "集装箱文件" },
    description: {
      ar: "كل ملفات Excel/CSV المرفوعة مع إمكانية التحميل.",
      en: "All uploaded Excel/CSV files with download links.",
      zh: "所有已上传的 Excel/CSV 文件，可下载。",
    },
    dateFilter: "none",
  },
  "new-products": {
    title: { ar: "منتجات جديدة", en: "New products", zh: "新产品" },
    description: {
      ar: "منتجات واردة معلمة كجديدة.",
      en: "Incoming products marked as new.",
      zh: "标记为新到产品的在途产品。",
    },
    dateFilter: "eta",
    dateHint: {
      ar: "فلترة حسب ETA للشحنة",
      en: "Filter by shipment ETA",
      zh: "按货运 ETA 筛选",
    },
  },
  "disassembled-products": {
    title: { ar: "منتجات مفككة", en: "Disassembled products", zh: "拆散件产品" },
    description: {
      ar: "منتجات واردة معلمة كمفككة.",
      en: "Incoming products marked as disassembled.",
      zh: "标记为拆散件的在途产品。",
    },
    dateFilter: "eta",
    dateHint: {
      ar: "فلترة حسب ETA للشحنة",
      en: "Filter by shipment ETA",
      zh: "按货运 ETA 筛选",
    },
  },
  "duplicate-products": {
    title: { ar: "منتجات مكررة", en: "Duplicate products", zh: "重复产品" },
    description: {
      ar: "منتجات موجودة في أكثر من شحنة مفتوحة.",
      en: "Products appearing in more than one open shipment.",
      zh: "出现在多个未结案货运中的产品。",
    },
    dateFilter: "none",
  },
  "date-range-products": {
    title: { ar: "منتجات بفترة", en: "Products by date range", zh: "按日期范围的产品" },
    description: {
      ar: "منتجات الشحنات داخل فترة ETA محددة.",
      en: "Shipment products within a selected ETA range.",
      zh: "指定 ETA 范围内的货运产品。",
    },
    dateFilter: "eta",
    dateHint: {
      ar: "فلترة حسب ETA للشحنة",
      en: "Filter by shipment ETA",
      zh: "按货运 ETA 筛选",
    },
  },
  "product-history": {
    title: { ar: "تاريخ منتج", en: "Product history", zh: "产品历史" },
    description: {
      ar: "تاريخ استيراد المنتجات من الشحنات.",
      en: "Import history of products across shipments.",
      zh: "产品在各货运中的进口历史。",
    },
    dateFilter: "eta",
    dateHint: {
      ar: "فلترة حسب ETA للشحنة",
      en: "Filter by shipment ETA",
      zh: "按货运 ETA 筛选",
    },
  },
  suppliers: {
    title: { ar: "الموردين", en: "Suppliers", zh: "供应商" },
    description: {
      ar: "ملخص الموردين وعدد الشحنات.",
      en: "Supplier summary and shipment counts.",
      zh: "供应商汇总及货运数量。",
    },
    dateFilter: "none",
  },
  companies: {
    title: { ar: "شركات الاستيراد", en: "Import companies", zh: "进口公司" },
    description: {
      ar: "ملخص الشركات وعدد الشحنات.",
      en: "Company summary and shipment counts.",
      zh: "公司汇总及货运数量。",
    },
    dateFilter: "none",
  },
  "all-products": {
    title: { ar: "الأصناف", en: "All products", zh: "全部产品" },
    description: {
      ar: "كل المنتجات على النظام: الاسم، الكود (SKU)، والباركود — مع تصدير Excel.",
      en: "All products in the system: name, SKU, and barcode — with Excel export.",
      zh: "系统中全部产品：名称、SKU 和条形码，支持 Excel 导出。",
    },
    dateFilter: "none",
  },
  "customs-releases": {
    title: { ar: "الافراجات الجمركية", en: "Customs releases", zh: "海关放行" },
    description: {
      ar: "ملفات PDF للإفراج الجمركي مع تاريخ الإغلاق وروابط التحميل.",
      en: "Customs release PDFs with closing date and download links.",
      zh: "海关放行 PDF，含结案日期与下载链接。",
    },
    dateFilter: "closed",
    dateHint: {
      ar: "فلترة حسب تاريخ إغلاق الشحنة",
      en: "Filter by shipment closing date",
      zh: "按货运结案日期筛选",
    },
  },
  "shipment-invoices": {
    title: { ar: "فواتير INV", en: "INV invoices", zh: "INV 发票" },
    description: {
      ar: "ملفات INV المرفوعة عند إنشاء الشحنات مع تاريخ الرفع وروابط التحميل.",
      en: "INV files uploaded when creating shipments, with upload date and links.",
      zh: "创建货运时上传的 INV 文件，含上传日期与链接。",
    },
    dateFilter: "uploaded",
    dateHint: {
      ar: "فلترة حسب تاريخ رفع الملف",
      en: "Filter by file upload date",
      zh: "按文件上传日期筛选",
    },
  },
};

function pick(entry: { ar: string; en: string; zh: string }, lang: AppLanguage) {
  if (lang === "ar") return entry.ar;
  if (lang === "zh") return entry.zh;
  return entry.en;
}

export function getLocalizedReport(slug: ReportSlug, lang: AppLanguage) {
  const meta = REPORT_META[slug];
  return {
    slug,
    title: pick(meta.title, lang),
    description: pick(meta.description, lang),
    dateFilter: meta.dateFilter,
    dateHint: meta.dateHint ? pick(meta.dateHint, lang) : undefined,
  };
}

export function getLocalizedReports(lang: AppLanguage) {
  return (Object.keys(REPORT_META) as ReportSlug[]).map((slug) => getLocalizedReport(slug, lang));
}

export function findLocalizedReport(slug: string, lang: AppLanguage) {
  if (!(slug in REPORT_META)) return null;
  return getLocalizedReport(slug as ReportSlug, lang);
}
