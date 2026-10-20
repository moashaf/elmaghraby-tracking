import { describe, expect, it } from "vitest";
import { canTransitionToCustoms, isoDateOnly } from "@/lib/eta";

describe("canTransitionToCustoms", () => {
  it("allows customs on or after the cargo ETA date", () => {
    expect(canTransitionToCustoms("2026-10-01", "2026-10-20")).toBe(true);
    expect(canTransitionToCustoms("2026-10-20", "2026-10-20")).toBe(true);
  });

  it("blocks customs before ETA and ignores time suffixes", () => {
    expect(canTransitionToCustoms("2027-10-01", "2026-10-20")).toBe(false);
    expect(isoDateOnly("2026-10-01T00:00:00.000Z")).toBe("2026-10-01");
  });
});
