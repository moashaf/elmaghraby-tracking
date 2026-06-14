/** Display value from uploaded INV PDF file name (e.g. 26020.pdf → 26020). */
export function displayInvoiceNumber(fileName: string): string {
  return fileName.replace(/\.pdf$/i, "").trim();
}

/** Numeric sort key for sequential invoice numbers (26020, 26021, …). */
export function parseInvoiceSortKey(fileName: string | null | undefined): number {
  if (!fileName) return Number.MAX_SAFE_INTEGER;
  const base = displayInvoiceNumber(fileName);
  if (/^\d+$/.test(base)) return Number.parseInt(base, 10);
  const match = base.match(/(\d+)/);
  return match ? Number.parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER - 1;
}

export function compareShipmentsByInvoiceNumber(
  a: { invoice_file_name: string | null },
  b: { invoice_file_name: string | null }
): number {
  const diff = parseInvoiceSortKey(a.invoice_file_name) - parseInvoiceSortKey(b.invoice_file_name);
  if (diff !== 0) return diff;
  return (a.invoice_file_name ?? "").localeCompare(b.invoice_file_name ?? "", "ar");
}
