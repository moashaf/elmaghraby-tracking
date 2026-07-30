import { describe, expect, it } from "vitest";
import {
  CLOSE_COST_ITEMS,
  formStringsToLineItems,
  lineItemsToFormStrings,
  toCloseCostRollups,
} from "@/lib/close-cost-items";

describe("close-cost-items", () => {
  it("maps groups into legacy rollup columns", () => {
    const form = lineItemsToFormStrings({});
    form.delivery_permit_egp = "100";
    form.taxes = "50";
    form.warehouse_unload_transport = "25";
    form.salah_expenses = "10";

    const rollups = toCloseCostRollups(formStringsToLineItems(form));
    expect(rollups.customs_cost).toBe(100);
    expect(rollups.clearance_cost).toBe(50);
    expect(rollups.local_transport_cost).toBe(25);
    expect(rollups.other_expenses).toBe(10);
    expect(rollups.total_cost).toBe(185);
  });

  it("covers all excel-style line items", () => {
    expect(CLOSE_COST_ITEMS).toHaveLength(34);
  });
});
