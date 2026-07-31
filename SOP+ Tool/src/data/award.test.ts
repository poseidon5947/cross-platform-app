import { describe, expect, it } from "vitest";
import { createSeedState } from "./seed";
import { findExistingSopAward, shouldRequestSopAward } from "./award";

describe("server award guard", () => {
  it("detects existing sop_completed awards by SOP ref", () => {
    const state = createSeedState();
    expect(findExistingSopAward(state.pointsEvents, "sop-1-1")?.points).toBe(20);
    expect(shouldRequestSopAward(state.pointsEvents, "sop-1-1")).toBe(false);
    expect(shouldRequestSopAward(state.pointsEvents, "new-sop")).toBe(true);
  });
});
