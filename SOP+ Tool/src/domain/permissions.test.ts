import { describe, expect, it } from "vitest";
import { createSeedState } from "../data/seed";
import { canApprove, canCreateSop, canEditSop } from "./sop";

describe("role permissions", () => {
  it("limits create and approve to managers unless crew-lead flags are enabled", () => {
    expect(canCreateSop("manager")).toBe(true);
    expect(canCreateSop("crew")).toBe(false);
    expect(canCreateSop("crew", true)).toBe(true);
    expect(canApprove("manager")).toBe(true);
    expect(canApprove("crew")).toBe(false);
    expect(canApprove("crew", true)).toBe(true);
  });

  it("allows crew to edit assigned or published SOPs only", () => {
    const state = createSeedState();
    const assigned = state.sops.find((sop) => sop.status === "assigned" && sop.assignedTo === "u3")!;
    const otherAssigned = state.sops.find((sop) => sop.status === "assigned" && sop.assignedTo !== "u3")!;
    const published = state.sops.find((sop) => sop.status === "published")!;
    expect(canEditSop("crew", "u3", assigned)).toBe(true);
    expect(canEditSop("crew", "u3", otherAssigned)).toBe(false);
    expect(canEditSop("crew", "u3", published)).toBe(true);
  });
});
