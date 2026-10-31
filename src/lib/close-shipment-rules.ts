import type { SystemSettings } from "@/lib/system-settings";

export type CloseShipmentValidationInput = {
  isAlreadyClosed: boolean;
  totalCost: number;
  hasCustomsDocument: boolean;
  closing?: boolean;
  settings: Pick<SystemSettings, "require_costs_before_close" | "require_customs_document">;
};

export type CloseShipmentValidationResult =
  | { ok: true }
  | { ok: false; message: string };

/** Pure close-shipment gate used by the API (and unit tests). */
export function validateCloseShipmentRules(
  input: CloseShipmentValidationInput
): CloseShipmentValidationResult {
  const isClosing = input.closing !== false && !input.isAlreadyClosed;
  if (isClosing && !input.hasCustomsDocument) {
    return { ok: false, message: "ارفع ملف PDF للإفراج الجمركي قبل الإغلاق." };
  }

  return { ok: true };
}

export function isSupplierPathAllowed(pathname: string): boolean {
  return (
    pathname === "/settings" ||
    pathname === "/supplier" ||
    pathname.startsWith("/supplier/") ||
    pathname === "/login"
  );
}
