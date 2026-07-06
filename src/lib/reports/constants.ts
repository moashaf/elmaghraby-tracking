import type { ReportSlug } from "@/lib/report-definitions";

export type ProductKindFilter = "all" | "disassembled" | "complete";

/** Reports that support optional product images in export/print. */
export const PRODUCT_IMAGE_REPORT_SLUGS: ReportSlug[] = [
  "incoming-products",
  "new-products",
  "disassembled-products",
  "duplicate-products",
  "date-range-products",
  "product-history",
  "all-products",
];

/** Product shipment reports grouped by SKU with arrival breakdown. */
export const GROUPED_PRODUCT_REPORT_SLUGS: ReportSlug[] = [
  "incoming-products",
  "new-products",
  "disassembled-products",
  "date-range-products",
];

export const INCOMING_FILTER_SLUG = "incoming-products" as const;

export const INCOMING_PRODUCTS_PAGE_SIZE = 50;

export function supportsReportPagination(slug: string) {
  return slug === INCOMING_FILTER_SLUG;
}

export function supportsProductImages(slug: string) {
  return PRODUCT_IMAGE_REPORT_SLUGS.includes(slug as ReportSlug);
}

/** Serial number column in shipment tables (مسلسل). */
export const SHIPMENT_SERIAL_COLUMN = "م";

export const SHIPMENT_LINK_REPORT_SLUGS = [
  "summary",
  "in-sea",
  "customs",
  "delayed",
  "arriving-10",
  "closed",
  "ready-to-close",
  "containers",
  "costs",
  "container-files",
] as const;

/** Shared table classes for shipment listing tables */
export const SHIPMENT_TABLE_CLASS = "table-nowrap table-compact table-data-dense w-full text-sm";

export function hasShipmentLinks(slug: string) {
  return SHIPMENT_LINK_REPORT_SLUGS.includes(slug as (typeof SHIPMENT_LINK_REPORT_SLUGS)[number]);
}

export function supportsIncomingFilters(slug: string) {
  return slug === INCOMING_FILTER_SLUG;
}

export const DOCUMENT_DOWNLOAD_REPORT_SLUGS = [
  "container-files",
  "customs-releases",
  "shipment-invoices",
] as const;

export function hasDocumentDownload(slug: string) {
  return DOCUMENT_DOWNLOAD_REPORT_SLUGS.includes(slug as (typeof DOCUMENT_DOWNLOAD_REPORT_SLUGS)[number]);
}
