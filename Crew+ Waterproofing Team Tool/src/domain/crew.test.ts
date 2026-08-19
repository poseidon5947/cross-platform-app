import { describe, expect, it } from "vitest";
import { createSeedState } from "../data/seed";
import { acknowledgePolicy, approveRedemption, awardCertDetail, bonusPercentForAverage, bonusTrajectory, canSeeBonusDollars, cashoutPromptActive, cashoutReward, certAlertLevel, certAlertLevelFromType, completeReview, completeRitual, confirmIncidentReceipt, habitAwardPoints, hasRolePermission, impliedRewardValue, isRedemptionWindowOpen, newHirePolicySignDue, nextQuarterDeadline, nextRedemptionWindow, onboardingComplete, pendingPayrollCashouts, policyAdminUpdateReminderActive, recordTimeOff, requestCashout, requestRedemption, reviewDueDates, submitIncidentReport, submitOnboarding, submitQuarterlySwot, timeOffEligibilityDate, timeOffSummary, vacationReminderText, walletBalance, wordCount } from "./crew";
import type { IncidentReportInput, OnboardingInput } from "../types";

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

  it("lets a crew member cash out their full balance to payroll only during an open window", () => {
    let state = createSeedState();
    const balance = walletBalance(state.pointsEvents, "u3");
    state = requestCashout(state, "u3", "2026-08-01T09:00:00Z");
    expect(state.redemptions).toHaveLength(0);
    expect(cashoutPromptActive(state, "u3", "2026-07-31T09:00:00Z")).toBe(true);
    state = requestCashout(state, "u3", "2026-07-31T09:00:00Z");
    expect(state.redemptions).toHaveLength(1);
    expect(state.redemptions[0]).toMatchObject({ userId: "u3", points: balance, status: "requested", rewardId: cashoutReward(state)!.id });
    expect(cashoutPromptActive(state, "u3", "2026-07-31T09:00:00Z")).toBe(false);
    const pending = pendingPayrollCashouts(state);
    expect(pending).toHaveLength(1);
    expect(pending[0].dollarValue).toBe(impliedRewardValue(balance, state.walletConfig.rewardDollarPerPoint));
    state = requestCashout(state, "u3", "2026-10-31T09:00:00Z");
    expect(state.redemptions).toHaveLength(1);
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

  it("blocks the sectioned policy from being signed until every section is initialed", () => {
    let state = createSeedState();
    const policy = state.policyDocuments.find((item) => item.id === "policy-crew-code-of-conduct")!;
    const partial = Object.fromEntries(policy.sections!.slice(0, -1).map((section) => [section, "JG"]));
    state = acknowledgePolicy(state, policy.id, "u3", "Jon Gregoire", "2026-08-20T09:00:00Z", partial);
    expect(state.policyAcknowledgments).toHaveLength(0);
    const complete = Object.fromEntries(policy.sections!.map((section) => [section, "JG"]));
    state = acknowledgePolicy(state, policy.id, "u3", "Jon Gregoire", "2026-08-20T09:00:00Z", complete);
    expect(state.policyAcknowledgments).toHaveLength(1);
    expect(state.policyAcknowledgments[0].sectionInitials).toMatchObject(complete);
  });

  it("flags new hires seven days past hire date who haven't signed the sectioned policy", () => {
    let state = createSeedState();
    state = { ...state, users: state.users.map((user) => user.id === "u3" ? { ...user, hireDate: "2026-08-01", accessUpgradedAt: "2026-08-04T09:00:00Z" } : user) };
    expect(newHirePolicySignDue(state, "2026-08-05")).toHaveLength(0);
    expect(newHirePolicySignDue(state, "2026-08-09").map((user) => user.id)).toEqual(["u3"]);
  });

  it("flags the admin annual-update reminder two weeks before the due date, not before", () => {
    const policy = createSeedState().policyDocuments.find((item) => item.id === "policy-crew-code-of-conduct")!;
    expect(policyAdminUpdateReminderActive(policy, "2026-08-16")).toBe(false);
    expect(policyAdminUpdateReminderActive(policy, "2026-08-18")).toBe(true);
    expect(policyAdminUpdateReminderActive(policy, "2026-08-31")).toBe(true);
    expect(policyAdminUpdateReminderActive(policy, "2026-09-01")).toBe(false);
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
    expect(walletBalance(state.pointsEvents, "u3")).toBe(415);
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
  it("lets any crew member submit the simplified incident report", () => {
    let state = createSeedState();
    state = submitIncidentReport(state, "u3", incidentInput(), "2026-08-10T09:00:00Z");
    expect(state.incidentReports).toHaveLength(1);
    expect(state.incidentReports[0]).toMatchObject({
      reportedByUserId: "u3",
      employeeName: "Jon Gregoire",
      employeeRole: "Senior Technician",
      incidentCause: "Backing into tight staging area",
      reportedByName: "Jon Gregoire",
      createdAt: "2026-08-10T09:00:00Z",
    });
  });

  it("lets a Crew Lead confirm receipt", () => {
    let state = submitIncidentReport(createSeedState(), "u3", incidentInput(), "2026-08-10T09:00:00Z");
    state = confirmIncidentReceipt(state, state.incidentReports[0].id, "u1", "2026-08-10T10:00:00Z");
    expect(state.incidentReports[0]).toMatchObject({
      confirmedByUserId: "u1",
      confirmedByName: "Jesse",
      confirmedAt: "2026-08-10T10:00:00Z",
    });
  });

  it("lets an owner confirm receipt", () => {
    let state = submitIncidentReport(createSeedState(), "u3", incidentInput(), "2026-08-10T09:00:00Z");
    state = confirmIncidentReceipt(state, state.incidentReports[0].id, "u7", "2026-08-10T11:00:00Z");
    expect(state.incidentReports[0]).toMatchObject({
      confirmedByUserId: "u7",
      confirmedByName: "J. Rogers",
      confirmedAt: "2026-08-10T11:00:00Z",
    });
  });

  it("does not allow an admin without Crew Lead or Owner org role to confirm receipt", () => {
    let state = submitIncidentReport(createSeedState(), "u3", incidentInput(), "2026-08-10T09:00:00Z");
    state = confirmIncidentReceipt(state, state.incidentReports[0].id, "u8", "2026-08-10T12:00:00Z");
    expect(state.incidentReports[0].confirmedByUserId).toBeUndefined();
    expect(state.incidentReports[0].confirmedAt).toBeUndefined();
  });
});

describe("Crew+ onboarding", () => {
  it("lets a crew member submit their own onboarding form once", () => {
    let state = createSeedState();
    expect(onboardingComplete(state, "u3")).toBe(false);
    state = submitOnboarding(state, "u3", onboardingInput(), "2026-08-11T09:00:00Z");
    expect(onboardingComplete(state, "u3")).toBe(true);
    expect(state.onboarding[0]).toMatchObject({ userId: "u3", sin: "123456789", completedAt: "2026-08-11T09:00:00Z" });
  });

  it("rejects a second submission once onboarding is already complete", () => {
    let state = createSeedState();
    state = submitOnboarding(state, "u3", onboardingInput(), "2026-08-11T09:00:00Z");
    const before = state.onboarding.length;
    state = submitOnboarding(state, "u3", onboardingInput(), "2026-08-11T10:00:00Z");
    expect(state.onboarding.length).toBe(before);
  });

  it("rejects an incomplete submission", () => {
    let state = createSeedState();
    state = submitOnboarding(state, "u3", { ...onboardingInput(), sin: "" }, "2026-08-11T09:00:00Z");
    expect(onboardingComplete(state, "u3")).toBe(false);
  });
});

function onboardingInput(): OnboardingInput {
  return {
    userId: "u3",
    dateOfBirth: "1995-04-08",
    address: "123 Main St",
    city: "Victoria",
    postalCode: "V8V 1A1",
    sin: "123456789",
    driversLicenseNumber: "1234-56789-01234",
    allergiesMedical: "None",
    hourlyWage: 32,
    startDate: "2026-08-15",
    vacationPayAcknowledged: true,
    directDepositSignedName: "Jon Gregoire",
    directDepositSignedAt: "2026-08-11T09:00:00Z",
    hoursTrackingSignedName: "Jon Gregoire",
    hoursTrackingSignedAt: "2026-08-11T09:00:00Z",
    emergencyContactName: "Alex Gregoire",
    emergencyContactRelationship: "Sibling",
    emergencyContactPhone: "613-555-0100",
  };
}

function incidentInput(): IncidentReportInput {
  return {
    employeeName: "Jon Gregoire",
    employeeRole: "Senior Technician",
    employeePhone: "613-539-5322",
    location: "Dock waterproofing site",
    dateOfIncident: "2026-08-06",
    timeOfIncident: "14:30",
    incidentCause: "Backing into tight staging area",
    incidentDetails: "Truck mirror clipped a post while backing into a tight staging area.",
    actionTaken: "Moved truck, inspected for safe operation, and notified foreman.",
    policeNotified: false,
    followUpRequired: "Use a spotter when backing into tight staging areas.",
    photoFileNames: ["mirror.jpg"],
    reportedByUserId: "u3",
    reportedByName: "Jon Gregoire",
    reportedByRole: "Senior Technician",
    reportedByPhone: "613-539-5322",
  };
}
