import { describe, expect, it } from "vitest";
import { canTransitionToCustoms, cargoEtaAfterVoyageWindow, isoDateOnly } from "@/lib/eta";

describe("canTransitionToCustoms", () => {
  it("allows customs on or after the cargo ETA date", () => {
    expect(canTransitionToCustoms("2026-10-01", "2026-10-20")).toBe(true);
    expect(canTransitionToCustoms("2026-10-20", "2026-10-20")).toBe(true);
  });

  it("blocks a real future ETA", () => {
    expect(canTransitionToCustoms("2026-11-01", "2026-10-20", "2026-08-16")).toBe(false);
    expect(isoDateOnly("2026-10-01T00:00:00.000Z")).toBe("2026-10-01");
  });

  it("unrolls a next-year ATD and allows customs after the ship already arrived", () => {
    expect(cargoEtaAfterVoyageWindow("2027-10-01", "2026-08-16", "2026-10-20")).toBe("2026-10-01");
    expect(canTransitionToCustoms("2027-10-01", "2026-10-20", "2026-08-16")).toBe(true);
  });
});
