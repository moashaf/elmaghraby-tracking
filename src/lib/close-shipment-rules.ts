import type { SystemSettings } from "@/lib/system-settings";

export type CloseShipmentValidationInput = {
  isAlreadyClosed: boolean;
  totalCost: number;
  hasCustomsDocument: boolean;
  settings: Pick<SystemSettings, "require_costs_before_close" | "require_customs_document">;
};

export type CloseShipmentValidationResult =
  | { ok: true }
  | { ok: false; message: string };

/** Pure close-shipment gate used by the API (and unit tests). */
export function validateCloseShipmentRules(
  input: CloseShipmentValidationInput
): CloseShipmentValidationResult {
  if (!input.isAlreadyClosed && input.settings.require_costs_before_close && input.totalCost <= 0) {
    return { ok: false, message: "يجب إدخال المصاريف قبل إغلاق الشحنة." };
  }

  if (
    !input.isAlreadyClosed &&
    input.settings.require_customs_document &&
    !input.hasCustomsDocument
  ) {
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
