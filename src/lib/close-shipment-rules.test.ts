import { describe, expect, it } from "vitest";
import { isShipmentDelayed, type SystemSettings } from "@/lib/system-settings";
import { isSupplierPathAllowed, validateCloseShipmentRules } from "@/lib/close-shipment-rules";

const settings: SystemSettings = {
  require_costs_before_close: true,
  require_customs_document: true,
  delayed_after_eta_days: 0,
};

describe("validateCloseShipmentRules", () => {
  it("closes with a customs PDF even when costs are zero", () => {
    const result = validateCloseShipmentRules({
      isAlreadyClosed: false,
      totalCost: 0,
      hasCustomsDocument: true,
      closing: true,
      settings,
    });
    expect(result.ok).toBe(true);
  });

  it("requires a customs release PDF when closing", () => {
    const blocked = validateCloseShipmentRules({
      isAlreadyClosed: false,
      totalCost: 100,
      hasCustomsDocument: false,
      closing: true,
      settings: { ...settings, require_customs_document: false },
    });
    expect(blocked.ok).toBe(false);

    const allowed = validateCloseShipmentRules({
      isAlreadyClosed: false,
      totalCost: 0,
      hasCustomsDocument: true,
      closing: true,
      settings: { ...settings, require_customs_document: false },
    });
    expect(allowed.ok).toBe(true);
  });

  it("does not require a PDF when only saving costs", () => {
    const result = validateCloseShipmentRules({
      isAlreadyClosed: false,
      totalCost: 0,
      hasCustomsDocument: false,
      closing: false,
      settings,
    });
    expect(result.ok).toBe(true);
  });

  it("skips gates when already closed", () => {
    const result = validateCloseShipmentRules({
      isAlreadyClosed: true,
      totalCost: 0,
      hasCustomsDocument: false,
      settings,
    });
    expect(result.ok).toBe(true);
  });
});

describe("isShipmentDelayed", () => {
  it("flags in-sea shipments past ETA", () => {
    expect(isShipmentDelayed("2026-01-01", "in_sea", settings, "2026-01-05")).toBe(true);
    expect(isShipmentDelayed("2026-01-10", "in_sea", settings, "2026-01-05")).toBe(false);
    expect(isShipmentDelayed("2026-01-01", "customs", settings, "2026-01-05")).toBe(false);
  });
});

describe("isSupplierPathAllowed", () => {
  it("allows supplier portal and settings only", () => {
    expect(isSupplierPathAllowed("/supplier")).toBe(true);
    expect(isSupplierPathAllowed("/supplier/purchase-orders")).toBe(true);
    expect(isSupplierPathAllowed("/settings")).toBe(true);
    expect(isSupplierPathAllowed("/shipments")).toBe(false);
    expect(isSupplierPathAllowed("/")).toBe(false);
  });
});
