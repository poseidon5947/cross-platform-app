import { describe, expect, it } from "vitest";
import { canAwardCanonical, canonicalWarehouseRef, legacyOrCanonicalRefs, requiredDailyComplete } from "./pointsAwardPolicy";

describe("canonical points award policy", () => {
  it("gates canonical award kinds by role and target user", () => {
    const crew = { id: "u1", role: "crew" as const };
    const manager = { id: "u2", role: "manager" as const };
    const admin = { id: "u3", role: "admin" as const, orgRole: "Operations" };

    expect(canAwardCanonical(crew, "u1", "daily_100")).toBe(true);
    expect(canAwardCanonical(crew, "u4", "daily_100")).toBe(false);
    expect(canAwardCanonical(manager, "u1", "sop_completed")).toBe(true);
    expect(canAwardCanonical(crew, "u1", "sop_completed")).toBe(false);
    expect(canAwardCanonical(manager, "u1", "manual_adjust")).toBe(false);
    expect(canAwardCanonical(admin, "u1", "manual_adjust")).toBe(true);
    expect(canAwardCanonical(manager, "u1", "redeem")).toBe(false);
    expect(canAwardCanonical(admin, "u1", "redeem")).toBe(true);
  });

  it("requires all server-visible required daily tasks before Warehouse points", () => {
    const tasks = [
      { id: "a", freq: "daily" as const },
      { id: "b", freq: "daily" as const },
      { id: "pack", freq: "daily" as const, requiredForDailyPoints: false },
      { id: "weekly", freq: "weekly" as const },
    ];
    expect(requiredDailyComplete(tasks, [{ userId: "u1", taskId: "a", periodKey: "2026-07-28" }], "u1", "2026-07-28")).toBe(false);
    expect(requiredDailyComplete(tasks, [
      { userId: "u1", taskId: "a", periodKey: "2026-07-28" },
      { userId: "u1", taskId: "b", periodKey: "2026-07-28" },
    ], "u1", "2026-07-28")).toBe(true);
  });

  it("uses user-scoped Warehouse refs while recognizing legacy day refs", () => {
    expect(canonicalWarehouseRef("u1", "2026-07-28")).toBe("u1:2026-07-28");
    expect(legacyOrCanonicalRefs("u1", "2026-07-28")).toEqual(["2026-07-28", "u1:2026-07-28"]);
  });
});
