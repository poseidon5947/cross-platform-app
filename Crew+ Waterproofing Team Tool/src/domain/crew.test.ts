import { describe, expect, it } from "vitest";
import { createSeedState } from "../data/seed";
import { approveRedemption, bonusTrajectory, canSeeBonusDollars, cappedHabitAward, certAlertLevel, certAlertLevelFromType, completeReview, hasRolePermission, impliedRewardValue, isRedemptionWindowOpen, nextRedemptionWindow, requestRedemption, reviewDueDates, walletBalance } from "./crew";

describe("Crew+ wallet", () => {
  it("sums earned and redeemed points from the append-only ledger", () => {
    let state = createSeedState();
    state = { ...state, pointsEvents: [{ id: "seed-extra", userId: "u3", type: "crew_feedback", points: 600, reason: "Seed balance", ref: "seed-extra", ts: "2026-07-28T08:00:00Z", source: "crew" }, ...state.pointsEvents] };
    state = requestRedemption(state, "u3", "r1", "2026-07-31T09:00:00Z");
    state = approveRedemption(state, state.redemptions[0].id, "u1", "2026-07-31T10:00:00Z");
    expect(walletBalance(state.pointsEvents, "u3")).toBe(605);
  });

  it("shows implied reward value from the configurable anchor", () => {
    expect(impliedRewardValue(200, 0.25)).toBe(50);
  });

  it("caps small habit points per week", () => {
    let state = createSeedState();
    state = { ...state, pointsEvents: [{ id: "habit-heavy", userId: "u3", type: "crew_habit_ritual", points: 298, reason: "existing", ref: "ritual:u3:v1:daily:2026-W30", ts: "2026-07-28" }, ...state.pointsEvents] };
    expect(cappedHabitAward(state, "u3", 5, "2026-W30")).toBe(2);
  });

  it("opens redemptions only on quarter-end dates and rolls wallet balances forward", () => {
    let state = createSeedState();
    state = requestRedemption(state, "u3", "r1", "2026-07-30T09:00:00Z");
    expect(state.redemptions).toHaveLength(0);
    expect(isRedemptionWindowOpen("2026-07-31T09:00:00Z")).toBe(true);
    expect(nextRedemptionWindow("2026-08-01T09:00:00Z")).toBe("2026-10-31");
    expect(walletBalance(state.pointsEvents, "u3")).toBe(205);
  });
});

describe("Crew+ cadence, compliance, and privacy", () => {
  it("generates 30/60/90, quarterly, and annual review cadence dates", () => {
    const dates = reviewDueDates("2026-01-01", 2026);
    expect(dates.map((item) => item.type)).toContain("30");
    expect(dates.filter((item) => item.type === "quarterly")).toHaveLength(4);
    expect(dates.at(-1)?.type).toBe("annual");
  });

  it("awards review completion idempotently", () => {
    let state = createSeedState();
    state = completeReview(state, "rev-u1-q3", { responsibilities: "meets", values: "meets", kpis: "meets" });
    state = completeReview(state, "rev-u1-q3", { responsibilities: "exceeds", values: "meets", kpis: "meets" });
    expect(state.pointsEvents.filter((event) => event.ref === "review:rev-u1-q3")).toHaveLength(1);
  });

  it("flags cert renewal windows and gaps", () => {
    expect(certAlertLevel({ id: "c", userId: "u1", name: "Fit Test", expiresAt: "2026-08-03", status: "active" }, "2026-07-28")).toBe("amber");
    expect(certAlertLevel({ id: "c", userId: "u1", name: "First Aid", status: "missing" }, "2026-07-28")).toBe("red");
  });

  it("hides bonus dollars from non-admin/CFO users", () => {
    const state = createSeedState();
    expect(canSeeBonusDollars(state, state.users.find((user) => user.orgRole === "CFO")!)).toBe(true);
    expect(canSeeBonusDollars(state, state.users.find((user) => user.orgRole === "Operations / Admin")!)).toBe(true);
    expect(canSeeBonusDollars(state, state.users.find((user) => user.orgRole === "CEO / Owner")!)).toBe(true);
    expect(canSeeBonusDollars(state, state.users.find((user) => user.orgRole === "Technician")!)).toBe(false);
    expect(bonusTrajectory(["below", "meets", "meets"])).toBe("amber");
  });

  it("uses the intake permission matrix for finer-grained gates", () => {
    const state = createSeedState();
    expect(hasRolePermission(state, state.users.find((user) => user.orgRole === "Operations / Admin")!, "editConfig")).toBe(true);
    expect(hasRolePermission(state, state.users.find((user) => user.orgRole === "Technician")!, "editConfig")).toBe(false);
  });

  it("derives certification expiry alerts from cert type validity and lead days", () => {
    const state = createSeedState();
    const fit = state.certificationTypes.find((item) => item.id === "ct-fit");
    expect(certAlertLevelFromType({ id: "c", userId: "u1", certTypeId: "ct-fit", name: "Fit Test", issuedAt: "2026-07-01", status: "active" }, fit, "2027-05-15")).toBe("amber");
    expect(certAlertLevelFromType({ id: "c", userId: "u1", certTypeId: "ct-fit", name: "Fit Test", issuedAt: "2026-07-01", status: "active" }, fit, "2027-07-02")).toBe("red");
  });
});
