import { describe, expect, it } from "vitest";
import { mergeOrAppendProductLine } from "@/lib/shipment-product-quantity";

const base = {
  product_id: "p1",
  cartons_count: "3",
  unit_quantity: "10",
  quantity: "30",
  notes: "",
  is_new_incoming_product: false,
  is_disassembled: false,
};

describe("mergeOrAppendProductLine", () => {
  it("adds cartons onto an existing matching line", () => {
    const next = mergeOrAppendProductLine([base], { ...base, cartons_count: "2", quantity: "20" });
    expect(next).toHaveLength(1);
    expect(next[0].cartons_count).toBe("5");
    expect(next[0].quantity).toBe("50");
  });

  it("keeps a separate row when unit quantity differs", () => {
    const next = mergeOrAppendProductLine([base], { ...base, unit_quantity: "12", cartons_count: "2", quantity: "24" });
    expect(next).toHaveLength(2);
  });
});
