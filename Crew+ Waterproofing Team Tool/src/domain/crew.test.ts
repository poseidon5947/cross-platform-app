import { describe, expect, it } from "vitest";
import { createSeedState } from "../data/seed";
import { acknowledgePolicy, approveRedemption, awardCertDetail, bonusPercentForAverage, bonusTrajectory, canSeeBonusDollars, certAlertLevel, certAlertLevelFromType, completeReview, completeRitual, habitAwardPoints, hasRolePermission, impliedRewardValue, isRedemptionWindowOpen, nextQuarterDeadline, nextRedemptionWindow, recordTimeOff, requestRedemption, reviewDueDates, reviewIncidentReport, submitIncidentReport, submitQuarterlySwot, superviseIncidentReport, timeOffEligibilityDate, timeOffSummary, vacationReminderText, walletBalance, wordCount } from "./crew";
import type { IncidentReportInput } from "../types";

describe("Crew+ wallet", () => {
  it("sums earned and redeemed points from the append-only ledger", () => {
    let state = createSeedState();
    state = { ...state, pointsEvents: [{ id: "seed-extra", userId: "u3", type: "crew_feedback", points: 600, reason: "Seed balance", ref: "seed-extra", ts: "2026-07-28T08:00:00Z", source: "crew" }, ...state.pointsEvents] };
    state = requestRedemption(state, "u3", "r1", "2026-07-31T09:00:00Z");
    state = approveRedemption(state, state.redemptions[0].id, "u1", "2026-07-31T10:00:00Z");
    expect(walletBalance(state.pointsEvents, "u3")).toBe(805);
  });

  it("shows implied reward value from the configurable anchor", () => {
    expect(impliedRewardValue(200, 0.25)).toBe(50);
  });

  it("leaves repeated habit points uncapped while idempotency blocks duplicate refs", () => {
    let state = createSeedState();
    state = { ...state, pointsEvents: [{ id: "habit-heavy", userId: "u3", type: "crew_habit_ritual", points: 298, reason: "existing", ref: "ritual:u3:v1:daily:2026-W30", ts: "2026-07-28" }, ...state.pointsEvents] };
    state = completeRitual(state, "u3", "v1", "daily", "2026-W30-Mon", "2026-07-28T09:00:00Z");
    state = completeRitual(state, "u3", "v1", "daily", "2026-W30-Mon", "2026-07-28T10:00:00Z");
    expect(habitAwardPoints(state, "u3", 5, "2026-W30")).toBe(5);
    expect(state.pointsEvents.filter((event) => event.ref === "ritual:u3:v1:daily:2026-W30-Mon")).toHaveLength(1);
  });

  it("opens redemptions only on quarter-end dates and rolls wallet balances forward", () => {
    let state = createSeedState();
    state = requestRedemption(state, "u3", "r1", "2026-07-30T09:00:00Z");
    expect(state.redemptions).toHaveLength(0);
    expect(isRedemptionWindowOpen("2026-07-31T09:00:00Z")).toBe(true);
    expect(nextRedemptionWindow("2026-08-01T09:00:00Z")).toBe("2026-10-31");
    expect(walletBalance(state.pointsEvents, "u3")).toBe(405);
  });
});

describe("Crew+ cadence, compliance, and privacy", () => {
  it("generates 30/60/90, quarterly, and annual review cadence dates", () => {
    const dates = reviewDueDates("2026-01-01", 2026);
    expect(dates.map((item) => item.type)).toContain("30");
    expect(dates.filter((item) => item.type === "quarterly")).toHaveLength(4);
    expect(dates.find((item) => item.type === "quarterly" && item.scheduledFor.endsWith("12-31"))).toBeTruthy();
    expect(dates.at(-1)?.type).toBe("annual");
  });

  it("submits one quarterly SWOT per deadline and enforces the 500-word cap", () => {
    let state = createSeedState();
    const responses = Object.fromEntries(state.formQuestions.filter((question) => question.formId === "form-swot").map((question) => [question.id, `${question.question} response`]));
    state = submitQuarterlySwot(state, "u3", responses, "2026-08-04T09:00:00Z");
    state = submitQuarterlySwot(state, "u3", responses, "2026-08-05T09:00:00Z");
    expect(nextQuarterDeadline("2026-08-04")).toBe("2026-09-30");
    expect(state.formSubmissions).toHaveLength(1);
    expect(state.pointsEvents.filter((event) => event.ref === "swot:u3:2026-09-30")).toHaveLength(1);
    expect(wordCount(Array(501).fill("word").join(" "))).toBe(501);
  });

  it("records one annual policy acknowledgment per crew member", () => {
    let state = createSeedState();
    state = acknowledgePolicy(state, "policy-bullying-harassment", "u3", "Jon Gregoire", "2026-08-04T09:00:00Z");
    state = acknowledgePolicy(state, "policy-bullying-harassment", "u3", "Jon Gregoire", "2026-08-05T09:00:00Z");
    expect(state.policyAcknowledgments).toHaveLength(1);
    expect(state.policyAcknowledgments[0]).toMatchObject({ year: 2026, signedName: "Jon Gregoire" });
  });

  it("tracks annual sick and vacation balances after the 90-day eligibility date", () => {
    let state = createSeedState();
    state = { ...state, users: state.users.map((user) => user.id === "u3" ? { ...user, hireDate: "2026-01-01", vacationDaysAnnual: 10 } : user) };
    expect(timeOffEligibilityDate("2026-01-01")).toBe("2026-04-01");
    state = recordTimeOff(state, "u3", "paid_sick", 1, "2026-03-31");
    expect(state.timeOffEntries).toHaveLength(0);
    state = recordTimeOff(state, "u3", "paid_sick", 1, "2026-04-01");
    state = recordTimeOff(state, "u3", "vacation", 2, "2026-08-10");
    const summary = timeOffSummary(state, "u3", 2026);
    expect(summary.paidSickRemaining).toBe(4);
    expect(summary.unpaidSickRemaining).toBe(3);
    expect(summary.vacationRemaining).toBe(8);
    expect(vacationReminderText(state, "u3", 2026)).toContain("8 of 10 vacation days remaining");
    expect(timeOffSummary(state, "u3", 2027).paidSickRemaining).toBe(5);
  });

  it("awards review completion idempotently", () => {
    let state = createSeedState();
    state = completeReview(state, "rev-u1-q3-2026", { responsibilities: 3, values: 3, kpis: 3 });
    state = completeReview(state, "rev-u1-q3-2026", { responsibilities: 4, values: 3, kpis: 3 });
    expect(state.pointsEvents.filter((event) => event.ref === "review:rev-u1-q3-2026")).toHaveLength(1);
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
    expect(bonusTrajectory([2, 3, 3])).toBe("red");
    expect(bonusPercentForAverage(4)).toBe(0.04);
  });

  it("awards certification detail completion once when key fields are filled", () => {
    let state = createSeedState();
    state = {
      ...state,
      certifications: state.certifications.map((cert) => cert.id === "cert-jon-fa" ? { ...cert, courseDate: "2026-07-15", expiresAt: "2029-07-15", certificateNumber: "FA-123" } : cert),
    };
    state = awardCertDetail(state, "u3", "cert-jon-fa", "2026-07-29T09:00:00Z");
    state = awardCertDetail(state, "u3", "cert-jon-fa", "2026-07-29T10:00:00Z");
    expect(state.pointsEvents.filter((event) => event.ref === "cert_detail:u3:cert-jon-fa")).toHaveLength(1);
    expect(walletBalance(state.pointsEvents, "u3")).toBe(410);
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

describe("Crew+ damage and incident reports", () => {
  it("lets any crew member submit a damage and incident report", () => {
    let state = createSeedState();
    state = submitIncidentReport(state, "u3", incidentInput(), "2026-08-07T09:00:00Z");
    expect(state.incidentReports).toHaveLength(1);
    expect(state.incidentReports[0]).toMatchObject({
      reportedByUserId: "u3",
      assetDescription: "Truck passenger mirror",
      createdAt: "2026-08-07T09:00:00Z",
    });
  });

  it("records supervisor sign-off with signed name and timestamp", () => {
    let state = submitIncidentReport(createSeedState(), "u3", incidentInput(), "2026-08-07T09:00:00Z");
    state = superviseIncidentReport(state, state.incidentReports[0].id, "u1", "Jesse Dares", "Reviewed on site.", "2026-08-07T10:00:00Z");
    expect(state.incidentReports[0]).toMatchObject({
      supervisorName: "Jesse",
      supervisorSignedName: "Jesse Dares",
      supervisorSignedAt: "2026-08-07T10:00:00Z",
      supervisorComments: "Reviewed on site.",
    });
  });

  it("lets management review set the further-action flag", () => {
    let state = submitIncidentReport(createSeedState(), "u3", incidentInput(), "2026-08-07T09:00:00Z");
    state = reviewIncidentReport(state, state.incidentReports[0].id, "u8", "Operations / Admin", true, "Book mirror repair and review spotter process.");
    expect(state.incidentReports[0]).toMatchObject({
      reviewedByUserId: "u8",
      reviewedByPosition: "Operations / Admin",
      furtherActionRequired: true,
      furtherActionDetails: "Book mirror repair and review spotter process.",
    });
  });

  it("does not allow a non-manager crew member to complete management review", () => {
    let state = submitIncidentReport(createSeedState(), "u3", incidentInput(), "2026-08-07T09:00:00Z");
    state = reviewIncidentReport(state, state.incidentReports[0].id, "u4", "Technician", true, "Should not save.");
    expect(state.incidentReports[0].reviewedByUserId).toBeUndefined();
    expect(state.incidentReports[0].furtherActionRequired).toBeUndefined();
  });
});

function incidentInput(): IncidentReportInput {
  return {
    dateOfReport: "2026-08-07",
    dateOfIncident: "2026-08-06",
    timeOfIncident: "14:30",
    location: "on_site",
    jobTitle: "Dock waterproofing",
    supervisorForeman: "Jesse Dares",
    propertyType: "company_vehicle",
    assetDescription: "Truck passenger mirror",
    assetIdOrPlate: "VIW-12",
    propertyOwner: "Van-Isle",
    incidentDescription: "Mirror clipped a post while backing into a tight staging area.",
    damageType: "Cracked mirror housing",
    estimatedCost: 250,
    anyoneInjured: false,
    otherPartyInvolved: false,
    photosTaken: true,
    photoFileNames: ["mirror.jpg"],
    witnessStatementsAttached: true,
    policeReportFiled: false,
    immediateActionTaken: "Moved truck, inspected for safe operation, notified foreman.",
    correctiveActions: "Use a spotter when backing into tight staging areas.",
    correctiveActionOwner: "Crew Lead",
    correctiveActionDueDate: "2026-08-14",
    witnesses: [{ name: "Shane Smith", contact: "778-000-0000", statementTaken: true }],
  };
}
