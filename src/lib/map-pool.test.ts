import { describe, expect, it } from "vitest";
import { mapPool, withTimeout } from "@/lib/map-pool";

describe("mapPool", () => {
  it("runs workers with a concurrency cap and preserves order", async () => {
    let active = 0;
    let maxActive = 0;
    const result = await mapPool([1, 2, 3, 4, 5], 2, async (value) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active -= 1;
      return value * 10;
    });
    expect(result).toEqual([10, 20, 30, 40, 50]);
    expect(maxActive).toBeLessThanOrEqual(2);
  });
});

describe("withTimeout", () => {
  it("returns null when the promise never settles in time", async () => {
    const hung = new Promise<string>(() => undefined);
    await expect(withTimeout(hung, 20)).resolves.toBeNull();
  });

  it("returns the value when it finishes in time", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 100)).resolves.toBe("ok");
  });
});
