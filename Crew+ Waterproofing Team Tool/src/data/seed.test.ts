import { describe, expect, it } from "vitest";
import { createSeedState } from "./seed";

describe("Crew+ seed completeness", () => {
  it("contains the production starter content for all v1 modules", () => {
    const state = createSeedState();
    expect(state.config.legalName).toBe("Van-Isle Coating & Sealants Ltd.");
    expect(state.users).toHaveLength(15);
    expect(state.users.some((user) => user.name === "Ken")).toBe(true);
    expect(state.values.map((value) => value.name)).toEqual(["Clear", "Helpful", "Professional"]);
    expect(state.valueRituals).toHaveLength(3);
    expect(state.certificationTypes).toHaveLength(8);
    expect(state.forms).toHaveLength(4);
    expect(state.formQuestions).toHaveLength(31);
    expect(state.formQuestions.filter((question) => question.formId === "form-quarterly-scorecard")).toHaveLength(20);
    expect(state.formQuestions.filter((question) => question.formId === "form-swot").every((question) => question.wordLimit === 500)).toBe(true);
    expect(state.forms.find((form) => form.id === "form-swot")?.dueMonthDays).toEqual(["03-31", "06-30", "09-30", "12-31"]);
    expect(state.policyDocuments[0]).toMatchObject({ annualDueMonthDay: "08-31", version: "2026" });
    expect(state.timeOffPolicies[0]).toMatchObject({ year: 2026, paidSickDays: 5, unpaidSickDays: 3, eligibilityDays: 90 });
    expect(state.nudges.some((nudge) => nudge.type === "vacation" && nudge.channel === "Email + Text")).toBe(true);
    expect(state.earningRules.length).toBeGreaterThanOrEqual(17);
    expect(state.rewards.map((reward) => reward.name)).toEqual(["Cash - $50", "Cash - $100", "Gift Card - $50", "Gift Card - $100", "PTO - half day", "PTO - full day"]);
    expect(state.kpis.length).toBeGreaterThanOrEqual(20);
    expect(state.certifications.some((cert) => cert.userId === "u5")).toBe(false);
    expect(state.certifications.some((cert) => cert.userId === "u7" && cert.name === "Fit Test (respirator)")).toBe(true);
    expect(state.bonusConfig.ratingFactors[4]).toBe(0.04);
    expect(state.walletConfig.rewardDollarPerPoint).toBe(0.25);
    expect(state.config.googleReviewUrl).toContain("merchant-review-solicitation");
    expect(state.pointsEvents.filter((event) => event.type === "crew_google_review" && event.ref.startsWith("google_seed:"))).toHaveLength(5);
    expect(state.pointsEvents.some((event) => event.ref === "google_seed:u6:2026-07" && event.reason === "Seeded 5-star Google review naming Jordan Thorpe")).toBe(true);
    expect(state.pointsEvents.filter((event) => event.userId === "u6" && event.type === "crew_google_review")).toHaveLength(2);
    expect(state.reviews.some((review) => review.userId === "u15" && review.notes.includes("Not eligible"))).toBe(true);
    expect(state.walletConfig.weeklyHabitCap).toBeNull();
  });
});
