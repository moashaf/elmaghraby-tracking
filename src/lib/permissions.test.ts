import { describe, expect, it } from "vitest";
import {
  canActAsSupplier,
  canWrite,
  hasFullAccess,
  isAdmin,
  isStaff,
  isSupplier,
} from "@/lib/permissions";

describe("permissions", () => {
  it("allows admin and manager to write", () => {
    expect(canWrite("admin")).toBe(true);
    expect(canWrite("manager")).toBe(true);
    expect(canWrite("viewer")).toBe(false);
    expect(canWrite("supplier")).toBe(false);
  });

  it("detects admin, supplier, and staff roles", () => {
    expect(isAdmin("admin")).toBe(true);
    expect(isSupplier("supplier")).toBe(true);
    expect(isStaff("viewer")).toBe(true);
    expect(isStaff("supplier")).toBe(false);
  });

  it("scopes supplier workflow helpers", () => {
    expect(canActAsSupplier("supplier")).toBe(true);
    expect(canActAsSupplier("manager")).toBe(true);
    expect(canActAsSupplier("viewer")).toBe(false);
    expect(hasFullAccess("admin")).toBe(true);
    expect(hasFullAccess("manager")).toBe(false);
  });
});
