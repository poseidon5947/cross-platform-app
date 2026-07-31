import { describe, expect, it } from "vitest";
import { createSeedState } from "./seed";

describe("Crew+ seed completeness", () => {
  it("contains the production starter content for all v1 modules", () => {
    const state = createSeedState();
    expect(state.config.legalName).toBe("Van-Isle Coating & Sealants Ltd.");
    expect(state.users).toHaveLength(12);
    expect(state.values).toHaveLength(5);
    expect(state.valueRituals).toHaveLength(15);
    expect(state.certificationTypes).toHaveLength(8);
    expect(state.forms).toHaveLength(2);
    expect(state.formQuestions).toHaveLength(8);
    expect(state.earningRules.length).toBeGreaterThanOrEqual(17);
    expect(state.rewards.map((reward) => reward.name)).toEqual(["Cash - $50", "Cash - $100", "Gift Card - $50", "Gift Card - $100", "PTO - half day", "PTO - full day"]);
    expect(state.kpis.length).toBeGreaterThanOrEqual(20);
    expect(state.certifications.some((cert) => cert.userId === "u5" && cert.status === "missing")).toBe(true);
    expect(state.certifications.some((cert) => cert.userId === "u1" && cert.name === "Level 1 First Aid" && cert.status === "expired")).toBe(true);
    expect(state.bonusConfig.ratingFactors.exceeds).toBe(1.3);
    expect(state.walletConfig.rewardDollarPerPoint).toBe(0.25);
    expect(state.config.googleReviewUrl).toContain("merchant-review-solicitation");
    expect(state.pointsEvents.filter((event) => event.type === "crew_google_review" && event.ref.startsWith("google_seed:"))).toHaveLength(3);
    expect(state.pointsEvents.some((event) => event.ref === "google_seed:u6:2026-07" && event.reason === "Seeded 5-star Google review naming Jordan Thorpe")).toBe(true);
    expect(state.pointsEvents.filter((event) => event.userId === "u6" && event.type === "crew_google_review")).toEqual([
      expect.objectContaining({ ref: "google_seed:u6:2026-07", reason: "Seeded 5-star Google review naming Jordan Thorpe" }),
    ]);
    expect(state.walletConfig.weeklyHabitCap).toBeNull();
  });
});
