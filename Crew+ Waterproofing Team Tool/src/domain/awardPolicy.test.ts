import { describe, expect, it } from "vitest";
import { createSeedState } from "../data/seed";
import { canCallerAwardRule, resolveServerAwardPoints } from "./awardPolicy";

describe("hardened award policy", () => {
  it("allows self-serve ritual earns only for the caller", () => {
    const state = createSeedState();
    const jesse = state.users.find((user) => user.id === "u1")!;
    expect(canCallerAwardRule(jesse, "u1", "earn-daily")).toBe(true);
    expect(canCallerAwardRule(jesse, "u4", "earn-daily")).toBe(false);
  });

  it("requires manager/admin for manager-granted earns and redemptions", () => {
    const state = createSeedState();
    const crew = state.users.find((user) => user.id === "u4")!;
    const manager = state.users.find((user) => user.role === "manager")!;
    const admin = state.users.find((user) => user.orgRole === "Operations / Admin")!;
    expect(canCallerAwardRule(crew, "u4", "earn-kpi")).toBe(false);
    expect(canCallerAwardRule(manager, "u4", "earn-kpi")).toBe(true);
    expect(canCallerAwardRule(manager, "u4", "redeem")).toBe(false);
    expect(canCallerAwardRule(admin, "u4", "redeem")).toBe(true);
    expect(canCallerAwardRule(admin, "u4", "earn-ww-day")).toBe(false);
  });

  it("clamps habit points at the server-side weekly cap", () => {
    const state = createSeedState();
    const rule = state.earningRules.find((item) => item.id === "earn-daily")!;
    const events = [
      { id: "a", userId: "u3", type: "crew_habit_ritual", points: 298, reason: "existing", ref: "ritual:u3:v1:daily:2026-W31", ts: "2026-07-28", source: "crew" as const },
    ];
    expect(resolveServerAwardPoints(rule, events, "u3", "2026-W31", 300)).toBe(2);
  });
});
