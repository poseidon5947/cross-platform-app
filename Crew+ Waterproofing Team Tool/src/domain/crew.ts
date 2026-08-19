import type { Cadence, Certification, CertificationType, CompensationRecord, CrewState, IncidentReportInput, OnboardingInput, PointsEvent, Profile, QuarterlyReviewDetail, RedemptionStatus, Review, ReviewRating, ReviewType, RolePermissionKey, TimeOffKind } from "../types";

export const JOB_RESPONSIBILITY_ITEMS = [
  "Arrives prepared and on time",
  "Prepares truck correctly",
  "Protects customer property",
  "Completes waterproofing to company standard",
  "Completes paperwork daily",
  "Cleans site before leaving",
  "Maintains tools and equipment",
  "Represents company professionally",
] as const;

export const KPI_REVIEW_ITEMS: Array<{ name: string; target: string }> = [
  { name: "Attendance", target: "100%" },
  { name: "Daily paperwork", target: "100%" },
  { name: "Safety violations", target: "Zero" },
  { name: "Customer complaints", target: "Zero" },
  { name: "Rework", target: "Under target" },
  { name: "Vehicle inspections", target: "Weekly" },
  { name: "Training completed", target: "Yes" },
];

export const OVERALL_RATING_LABELS = ["Developing", "Meets Expectations", "Strong Performer", "Exceeds Expectations", "Ready for More Responsibility"] as const;

const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function walletBalance(events: PointsEvent[], userId: string) {
  return events.filter((event) => event.userId === userId).reduce((sum, event) => sum + event.points, 0);
}

export function leaderboard(state: CrewState) {
  return state.users
    .map((user) => ({ user, balance: walletBalance(state.pointsEvents, user.id) }))
    .sort((a, b) => b.balance - a.balance);
}

export function impliedRewardValue(points: number, dollarPerPoint: number) {
  return Math.round(points * dollarPerPoint * 100) / 100;
}

export function shouldAward(events: PointsEvent[], ref: string, type: string) {
  return !events.some((event) => event.ref === ref && event.type === type);
}

export function habitPointsThisWeek(events: PointsEvent[], userId: string, weekKey: string) {
  return events
    .filter((event) => event.userId === userId && event.type.startsWith("crew_habit") && event.ref.includes(weekKey))
    .reduce((sum, event) => sum + event.points, 0);
}

export function habitAwardPoints(state: CrewState, userId: string, points: number, weekKey: string) {
  if (!state.walletConfig.weeklyHabitCap || state.walletConfig.weeklyHabitCap <= 0) return points;
  const already = habitPointsThisWeek(state.pointsEvents, userId, weekKey);
  return Math.max(0, Math.min(points, state.walletConfig.weeklyHabitCap - already));
}

export function rulePoints(state: CrewState, ruleId: string, fallback = 0) {
  return state.earningRules.find((item) => item.id === ruleId && item.active)?.points ?? fallback;
}

export function completeRitual(state: CrewState, userId: string, valueId: string, cadence: Cadence, periodKey: string, now = new Date().toISOString()) {
  const rule = state.earningRules.find((item) => item.id === (cadence === "daily" ? "earn-daily" : cadence === "weekly" ? "earn-weekly" : "earn-monthly"));
  const ref = `ritual:${userId}:${valueId}:${cadence}:${periodKey}`;
  if (!rule || !shouldAward(state.pointsEvents, ref, "crew_habit_ritual")) return state;
  const points = rule.habit ? habitAwardPoints(state, userId, rule.points, periodKey.slice(0, 8)) : rule.points;
  const event: PointsEvent = { id: uid("pe"), userId, type: "crew_habit_ritual", points, reason: rule.action, ref, ts: now, source: "crew" };
  return {
    ...state,
    pointsEvents: points > 0 ? [event, ...state.pointsEvents] : state.pointsEvents,
    ritualCompletions: [{ id: uid("ritual"), userId, valueId, cadence, periodKey, completedAt: now, pointsEventRef: event.id }, ...state.ritualCompletions],
  };
}

export function requestRedemption(state: CrewState, userId: string, rewardId: string, now = new Date().toISOString()) {
  const reward = state.rewards.find((item) => item.id === rewardId);
  if (!reward || !isRedemptionWindowOpen(now) || walletBalance(state.pointsEvents, userId) < reward.points) return state;
  return {
    ...state,
    redemptions: [{ id: uid("redeem"), userId, rewardId, points: reward.points, status: "requested" as RedemptionStatus, requestedAt: now }, ...state.redemptions],
  };
}

export const CASHOUT_REWARD_NAME = "Cash out to payroll";

export function cashoutReward(state: CrewState) {
  return state.rewards.find((item) => item.name === CASHOUT_REWARD_NAME);
}

export function cashoutPromptActive(state: CrewState, userId: string, nowIso: string) {
  const reward = cashoutReward(state);
  if (!reward || !isRedemptionWindowOpen(nowIso) || walletBalance(state.pointsEvents, userId) <= 0) return false;
  return !state.redemptions.some((item) => item.userId === userId && item.rewardId === reward.id && item.status === "requested");
}

export function requestCashout(state: CrewState, userId: string, now = new Date().toISOString()) {
  const reward = cashoutReward(state);
  const balance = walletBalance(state.pointsEvents, userId);
  if (!reward || !isRedemptionWindowOpen(now) || balance <= 0) return state;
  if (state.redemptions.some((item) => item.userId === userId && item.rewardId === reward.id && item.status === "requested")) return state;
  return {
    ...state,
    redemptions: [{ id: uid("redeem"), userId, rewardId: reward.id, points: balance, status: "requested" as RedemptionStatus, requestedAt: now }, ...state.redemptions],
  };
}

export function pendingPayrollCashouts(state: CrewState) {
  const reward = cashoutReward(state);
  return state.redemptions
    .filter((item) => reward && item.rewardId === reward.id && item.status === "requested")
    .map((item) => ({ redemption: item, dollarValue: impliedRewardValue(item.points, state.walletConfig.rewardDollarPerPoint) }));
}

export function approveRedemption(state: CrewState, redemptionId: string, approvedBy: string, now = new Date().toISOString()) {
  const redemption = state.redemptions.find((item) => item.id === redemptionId);
  if (!redemption || redemption.status !== "requested" || !isRedemptionWindowOpen(now)) return state;
  const ref = `redeem:${redemption.id}`;
  if (!shouldAward(state.pointsEvents, ref, "redeem")) return state;
  const event: PointsEvent = { id: uid("pe"), userId: redemption.userId, type: "redeem", points: -redemption.points, reason: `Reward redeemed: ${rewardName(state, redemption.rewardId)}`, ref, ts: now, source: "crew" };
  return {
    ...state,
    pointsEvents: [event, ...state.pointsEvents],
    redemptions: state.redemptions.map((item) => item.id === redemptionId ? { ...item, status: "approved" as const, approvedAt: now, approvedBy, externalRef: event.id } : item),
  };
}

export function reviewDueDates(hireDate: string, year: number) {
  const hire = new Date(`${hireDate}T00:00:00`);
  const addDays = (days: number) => {
    const copy = new Date(hire);
    copy.setDate(copy.getDate() + days);
    return copy.toISOString().slice(0, 10);
  };
  return [
    { type: "30" as ReviewType, scheduledFor: addDays(30) },
    { type: "60" as ReviewType, scheduledFor: addDays(60) },
    { type: "90" as ReviewType, scheduledFor: addDays(90) },
    { type: "quarterly" as ReviewType, scheduledFor: `${year}-03-31` },
    { type: "quarterly" as ReviewType, scheduledFor: `${year}-06-30` },
    { type: "quarterly" as ReviewType, scheduledFor: `${year}-09-30` },
    { type: "quarterly" as ReviewType, scheduledFor: `${year}-12-31` },
    { type: "annual" as ReviewType, scheduledFor: `${year}-12-10` },
  ];
}

export function completeReview(state: CrewState, reviewId: string, ratings: Review["ratings"], now = new Date().toISOString()) {
  const review = state.reviews.find((item) => item.id === reviewId);
  if (!review) return state;
  const ref = `review:${reviewId}`;
  // TODO confirm with client: review completion was included in the defaulted "+5 etc." group.
  const points = shouldAward(state.pointsEvents, ref, "crew_review_completed") ? rulePoints(state, "earn-review", 5) : 0;
  const event: PointsEvent = { id: uid("pe"), userId: review.userId, type: "crew_review_completed", points, reason: "Review completed on time", ref, ts: now, source: "crew" };
  return {
    ...state,
    pointsEvents: points ? [event, ...state.pointsEvents] : state.pointsEvents,
    reviews: state.reviews.map((item) => item.id === reviewId ? { ...item, ratings, status: "completed" as const, completedAt: now } : item),
  };
}

export function quarterlyReviewEligible(user: Profile, todayIso: string) {
  if (user.underNotice) return false;
  if (user.disciplinaryActionAt && daysBetween(user.disciplinaryActionAt, todayIso) < 90) return false;
  if (!user.hireDate || daysBetween(user.hireDate, todayIso) < 90) return false;
  return true;
}

export function employeeReviewSubmission(state: CrewState, review: Pick<Review, "id" | "userId">) {
  return state.formSubmissions.find((item) => item.formId === "form-quarterly-scorecard" && item.userId === review.userId && item.periodKey === review.id);
}

export function submitQuarterlyReviewAnswers(state: CrewState, userId: string, reviewId: string, responses: Record<string, string>, now = new Date().toISOString()) {
  const review = state.reviews.find((item) => item.id === reviewId);
  const form = state.forms.find((item) => item.id === "form-quarterly-scorecard");
  if (!review || review.userId !== userId || review.status === "completed" || !form) return state;
  const questions = state.formQuestions.filter((item) => item.formId === form.id);
  const complete = questions.every((question) => !question.required || Boolean(responses[question.id]?.trim()));
  if (!complete || employeeReviewSubmission(state, review)) return state;
  return {
    ...state,
    formSubmissions: [{ id: uid("form"), formId: form.id, userId, periodKey: reviewId, responses, submittedAt: now }, ...state.formSubmissions],
  };
}

function averageOf(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export function completeQuarterlyReview(state: CrewState, managerId: string, reviewId: string, detail: QuarterlyReviewDetail, overallRatingIndex: 1 | 2 | 3 | 4 | 5, now = new Date().toISOString()) {
  const review = state.reviews.find((item) => item.id === reviewId);
  const manager = state.users.find((item) => item.id === managerId);
  if (!review || review.status === "completed" || !manager || !canRunReviews(state, manager)) return state;
  if (!employeeReviewSubmission(state, review)) return state;
  const jobAvg = averageOf(Object.values(detail.jobResponsibilities));
  const responsibilities: ReviewRating = jobAvg >= 4 ? "exceeds" : jobAvg >= 3 ? "meets" : "below";
  const coreValuesRating: ReviewRating = detail.coreValues.helpful && detail.coreValues.clear && detail.coreValues.professional ? "exceeds" : "meets";
  const ref = `review:${reviewId}`;
  const points = shouldAward(state.pointsEvents, ref, "crew_review_completed") ? rulePoints(state, "earn-review", 5) : 0;
  const event: PointsEvent = { id: uid("pe"), userId: review.userId, type: "crew_review_completed", points, reason: "Quarterly review completed", ref, ts: now, source: "crew" };
  return {
    ...state,
    pointsEvents: points ? [event, ...state.pointsEvents] : state.pointsEvents,
    reviews: state.reviews.map((item) => item.id === reviewId ? {
      ...item,
      status: "completed" as const,
      completedAt: now,
      overallRating: overallRatingIndex,
      ratings: { ...item.ratings, responsibilities, values: coreValuesRating },
      quarterlyDetail: detail,
    } : item),
  };
}

export function awardKpiHit(state: CrewState, userId: string, kpiId: string, periodKey: string, now = new Date().toISOString()) {
  const ref = `kpi:${userId}:${kpiId}:${periodKey}`;
  if (!shouldAward(state.pointsEvents, ref, "crew_kpi_hit")) return state;
  // TODO confirm with client: KPI hit was included in the defaulted "+5 etc." group.
  const event: PointsEvent = { id: uid("pe"), userId, type: "crew_kpi_hit", points: rulePoints(state, "earn-kpi", 5), reason: "KPI target hit", ref, ts: now, source: "crew" };
  return {
    ...state,
    pointsEvents: [event, ...state.pointsEvents],
    kpiResults: state.kpiResults.map((item) => item.kpiId === kpiId && item.userId === userId && item.periodKey === periodKey ? { ...item, status: "hit" as const, pointsEventRef: event.id } : item),
  };
}

export function awardCertsCurrent(state: CrewState, userId: string, periodKey: string, now = new Date().toISOString()) {
  const ref = `certs:${userId}:${periodKey}`;
  if (!shouldAward(state.pointsEvents, ref, "crew_certs_current")) return state;
  const userCerts = state.certifications.filter((cert) => cert.userId === userId);
  if (!userCerts.length || userCerts.some((cert) => ["expired", "missing"].includes(cert.status))) return state;
  // TODO confirm with client: certs-current was included in the defaulted "+5 etc." group.
  const event: PointsEvent = { id: uid("pe"), userId, type: "crew_certs_current", points: rulePoints(state, "earn-certs", 5), reason: "All certs current", ref, ts: now, source: "crew" };
  return { ...state, pointsEvents: [event, ...state.pointsEvents] };
}

export function certDetailComplete(cert: Certification) {
  return Boolean(cert.courseDate && cert.expiresAt && cert.certificateNumber?.trim());
}

export function awardCertDetail(state: CrewState, userId: string, certId: string, now = new Date().toISOString()) {
  const cert = state.certifications.find((item) => item.id === certId && item.userId === userId);
  const ref = `cert_detail:${userId}:${certId}`;
  if (!cert || !certDetailComplete(cert) || !shouldAward(state.pointsEvents, ref, "crew_cert_detail")) return state;
  const event: PointsEvent = { id: uid("pe"), userId, type: "crew_cert_detail", points: rulePoints(state, "earn-cert-detail", 5), reason: "Certification details completed", ref, ts: now, source: "crew" };
  return { ...state, pointsEvents: [event, ...state.pointsEvents] };
}

export function submitFeedback(state: CrewState, userId: string, message: string, now = new Date().toISOString()) {
  const ref = `feedback:${userId}:${now.slice(0, 10)}:${message.slice(0, 12)}`;
  if (!message.trim() || !shouldAward(state.pointsEvents, ref, "crew_feedback")) return state;
  // TODO confirm with client: feedback was included in the defaulted "+5 etc." group.
  const event: PointsEvent = { id: uid("pe"), userId, type: "crew_feedback", points: rulePoints(state, "earn-feedback", 5), reason: "Company feedback submitted", ref, ts: now, source: "crew" };
  return { ...state, pointsEvents: [event, ...state.pointsEvents] };
}

export function wordCount(value: string) {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

export function nextQuarterDeadline(todayIso: string) {
  const year = Number(todayIso.slice(0, 4));
  const monthDay = todayIso.slice(5, 10);
  const deadline = ["03-31", "06-30", "09-30", "12-31"].find((date) => date >= monthDay);
  return deadline ? `${year}-${deadline}` : `${year + 1}-03-31`;
}

export function submitQuarterlySwot(state: CrewState, userId: string, responses: Record<string, string>, now = new Date().toISOString()) {
  const form = state.forms.find((item) => item.id === "form-swot");
  const questions = state.formQuestions.filter((item) => item.formId === form?.id);
  const complete = Boolean(form) && questions.every((question) => {
    const response = responses[question.id]?.trim() ?? "";
    return (!question.required || Boolean(response)) && (!question.wordLimit || wordCount(response) <= question.wordLimit);
  });
  const periodKey = nextQuarterDeadline(now.slice(0, 10));
  if (!complete || state.formSubmissions.some((item) => item.formId === form?.id && item.userId === userId && item.periodKey === periodKey)) return state;

  const ref = `swot:${userId}:${periodKey}`;
  const points = shouldAward(state.pointsEvents, ref, "crew_swot") ? rulePoints(state, "earn-swot", 5) : 0;
  const event: PointsEvent = { id: uid("pe"), userId, type: "crew_swot", points, reason: "Quarterly SWOT submitted on time", ref, ts: now, source: "crew" };
  return {
    ...state,
    pointsEvents: points ? [event, ...state.pointsEvents] : state.pointsEvents,
    formSubmissions: [{ id: uid("form"), formId: form!.id, userId, periodKey, responses, submittedAt: now }, ...state.formSubmissions],
  };
}

export function policyDueDate(policy: CrewState["policyDocuments"][number], year: number) {
  return `${year}-${policy.annualDueMonthDay}`;
}

export function acknowledgePolicy(state: CrewState, policyId: string, userId: string, signedName: string, now = new Date().toISOString(), sectionInitials?: Record<string, string>) {
  const policy = state.policyDocuments.find((item) => item.id === policyId && item.active);
  const user = state.users.find((item) => item.id === userId);
  const year = Number(now.slice(0, 4));
  if (!policy || !user || !signedName.trim()) return state;
  if (state.policyAcknowledgments.some((item) => item.policyId === policyId && item.userId === userId && item.year === year)) return state;
  if (policy.sections?.length && policy.sections.some((section) => !sectionInitials?.[section]?.trim())) return state;
  return {
    ...state,
    policyAcknowledgments: [{ id: uid("ack"), policyId, userId, year, signedName: signedName.trim(), signedAt: now, sectionInitials }, ...state.policyAcknowledgments],
  };
}

export function policyAdminUpdateReminderActive(policy: CrewState["policyDocuments"][number], todayIso: string) {
  const year = todayIso.slice(0, 4);
  const due = new Date(`${year}-${policy.annualDueMonthDay}T00:00:00Z`);
  const windowStart = new Date(due);
  windowStart.setUTCDate(windowStart.getUTCDate() - 14);
  const today = new Date(`${todayIso}T00:00:00Z`);
  return today >= windowStart && today <= due;
}

export function newHirePolicySignDue(state: CrewState, todayIso: string) {
  const policy = state.policyDocuments.find((item) => item.active && item.sections?.length);
  if (!policy) return [];
  return state.users.filter((user) => {
    if (!user.hireDate || !user.accessUpgradedAt) return false;
    if (daysBetween(user.hireDate, todayIso) < 7) return false;
    return !state.policyAcknowledgments.some((item) => item.policyId === policy.id && item.userId === user.id);
  });
}

export function timeOffEligibilityDate(hireDate: string | undefined, eligibilityDays = 90) {
  if (!hireDate) return "";
  const date = new Date(`${hireDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + eligibilityDays);
  return date.toISOString().slice(0, 10);
}

export function timeOffSummary(state: CrewState, userId: string, year: number) {
  const policy = state.timeOffPolicies.find((item) => item.year === year) ?? { id: `time-off-${year}`, year, paidSickDays: 5, unpaidSickDays: 3, eligibilityDays: 90, renewalMonthDay: "01-01" };
  const user = state.users.find((item) => item.id === userId);
  const entries = state.timeOffEntries.filter((item) => item.userId === userId && item.date.startsWith(String(year)));
  const used = (kind: TimeOffKind) => entries.filter((item) => item.kind === kind).reduce((sum, item) => sum + item.days, 0);
  const paidSickUsed = used("paid_sick");
  const unpaidSickUsed = used("unpaid_sick");
  const vacationUsed = used("vacation");
  const vacationAllowance = user?.vacationDaysAnnual;
  return {
    policy,
    eligibleFrom: timeOffEligibilityDate(user?.hireDate, policy.eligibilityDays),
    paidSickUsed,
    paidSickRemaining: Math.max(0, policy.paidSickDays - paidSickUsed),
    unpaidSickUsed,
    unpaidSickRemaining: Math.max(0, policy.unpaidSickDays - unpaidSickUsed),
    vacationUsed,
    vacationAllowance,
    vacationRemaining: vacationAllowance == null ? null : Math.max(0, vacationAllowance - vacationUsed),
  };
}

export function recordTimeOff(state: CrewState, userId: string, kind: TimeOffKind, days: number, date: string, note = "", now = new Date().toISOString()) {
  if (!Number.isFinite(days) || days <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return state;
  const year = Number(date.slice(0, 4));
  const summary = timeOffSummary(state, userId, year);
  if (!summary.eligibleFrom || date < summary.eligibleFrom) return state;
  const remaining = kind === "paid_sick" ? summary.paidSickRemaining : kind === "unpaid_sick" ? summary.unpaidSickRemaining : summary.vacationRemaining;
  if (remaining == null || days > remaining) return state;
  return {
    ...state,
    timeOffEntries: [{ id: uid("leave"), userId, kind, days, date, note: note.trim() || undefined, createdAt: now }, ...state.timeOffEntries],
  };
}

export function submitIncidentReport(state: CrewState, reportedByUserId: string, input: IncidentReportInput, now = new Date().toISOString()) {
  const user = state.users.find((item) => item.id === reportedByUserId);
  const required = [
    input.employeeName,
    input.employeeRole,
    input.location,
    input.dateOfIncident,
    input.timeOfIncident,
    input.incidentCause,
    input.incidentDetails,
    input.actionTaken,
    input.reportedByName,
    input.reportedByRole,
  ];
  if (!user || required.some((value) => !value.trim())) return state;
  return {
    ...state,
    incidentReports: [{
      ...input,
      id: uid("incident"),
      reportedByUserId,
      employeePhone: cleanOptional(input.employeePhone),
      followUpRequired: cleanOptional(input.followUpRequired),
      photoFileNames: input.photoFileNames?.filter(Boolean),
      reportedByPhone: cleanOptional(input.reportedByPhone),
      createdAt: now,
    }, ...(state.incidentReports ?? [])],
  };
}

export function confirmIncidentReceipt(state: CrewState, reportId: string, confirmerId: string, now = new Date().toISOString()) {
  const confirmer = state.users.find((item) => item.id === confirmerId);
  if (!confirmer || !["Crew Lead", "CEO / Owner", "CEO"].includes(confirmer.orgRole)) return state;
  return {
    ...state,
    incidentReports: (state.incidentReports ?? []).map((report) => report.id === reportId ? {
      ...report,
      confirmedByUserId: confirmerId,
      confirmedByName: confirmer.name,
      confirmedAt: now,
    } : report),
  };
}

export function onboardingComplete(state: CrewState, userId: string) {
  return Boolean((state.onboarding ?? []).find((item) => item.userId === userId)?.completedAt);
}

export function submitOnboarding(state: CrewState, userId: string, input: OnboardingInput, now = new Date().toISOString()) {
  const user = state.users.find((item) => item.id === userId);
  const required = [
    input.dateOfBirth, input.address, input.city, input.postalCode, input.sin, input.driversLicenseNumber,
    input.startDate, input.directDepositSignedName, input.hoursTrackingSignedName,
    input.emergencyContactName, input.emergencyContactPhone,
  ];
  if (!user || onboardingComplete(state, userId) || required.some((value) => !value.trim()) || !(input.hourlyWage > 0) || !input.vacationPayAcknowledged) return state;
  return {
    ...state,
    onboarding: [{
      ...input,
      id: uid("onboard"),
      userId,
      allergiesMedical: cleanOptional(input.allergiesMedical),
      directDepositFileName: cleanOptional(input.directDepositFileName),
      driversLicenseFrontFileName: cleanOptional(input.driversLicenseFrontFileName),
      driversLicenseBackFileName: cleanOptional(input.driversLicenseBackFileName),
      emergencyContactRelationship: cleanOptional(input.emergencyContactRelationship),
      emergencyContactEmail: cleanOptional(input.emergencyContactEmail),
      completedAt: now,
    }, ...(state.onboarding ?? [])],
  };
}

export function vacationReminderText(state: CrewState, userId: string, year: number) {
  const user = state.users.find((item) => item.id === userId);
  const summary = timeOffSummary(state, userId, year);
  if (!user || summary.vacationRemaining == null) return "Vacation allowance pending.";
  return `${user.name}: ${summary.vacationRemaining} of ${summary.vacationAllowance} vacation days remaining for ${year}.`;
}

export function giveRecognition(state: CrewState, fromUserId: string, toUserId: string, message: string, now = new Date().toISOString()) {
  if (!message.trim() || fromUserId === toUserId) return state;
  const recognition = { id: uid("rec"), fromUserId, toUserId, message: message.trim(), ts: now };
  const event: PointsEvent = { id: uid("pe"), userId: toUserId, type: "crew_peer_recognition", points: rulePoints(state, "earn-peer", 5), reason: "Peer recognition received", ref: recognition.id, ts: now, source: "crew" };
  return { ...state, recognitions: [{ ...recognition, pointsEventRef: event.id }, ...state.recognitions], pointsEvents: [event, ...state.pointsEvents] };
}

export function confirmCustomerReview(state: CrewState, userId: string, kind: "google_5_star" | "written_compliment", customerName: string, now = new Date().toISOString()) {
  const type = kind === "google_5_star" ? "crew_google_review" : "crew_compliment";
  // TODO confirm with client: written compliments were included in the defaulted "+5 etc." group.
  const points = kind === "google_5_star" ? rulePoints(state, "earn-google", 200) : rulePoints(state, "earn-compliment", 5);
  const ref = `${type}:${userId}:${customerName}:${now.slice(0, 10)}`;
  if (!shouldAward(state.pointsEvents, ref, type)) return state;
  const event: PointsEvent = { id: uid("pe"), userId, type, points, reason: kind === "google_5_star" ? "5-star Google review naming crew member" : "Written customer compliment", ref, ts: now, source: "crew" };
  return { ...state, pointsEvents: [event, ...state.pointsEvents] };
}

export function quarterlyLeaderboard(events: PointsEvent[], users: Profile[], quarterKey: string) {
  return users
    .map((user) => ({
      user,
      balance: events.filter((event) => event.userId === user.id && event.ts.includes(quarterKey)).reduce((sum, event) => sum + event.points, 0),
    }))
    .sort((a, b) => b.balance - a.balance);
}

export const REDEMPTION_WINDOW_DATES = ["01-31", "04-30", "07-31", "10-31"];

export function isRedemptionWindowOpen(nowIso: string) {
  return REDEMPTION_WINDOW_DATES.includes(nowIso.slice(5, 10));
}

export function nextRedemptionWindow(nowIso: string) {
  const year = Number(nowIso.slice(0, 4));
  const current = nowIso.slice(5, 10);
  const next = REDEMPTION_WINDOW_DATES.find((date) => date > current) ?? REDEMPTION_WINDOW_DATES[0];
  return `${next > current ? year : year + 1}-${next}`;
}

export function certAlertLevel(cert: Certification, todayIso: string) {
  if (cert.status === "missing" || cert.status === "expired") return "red";
  if (!cert.expiresAt) return "white";
  const days = daysUntil(cert.expiresAt, todayIso);
  if (days < 0) return "red";
  if ([7, 30, 60].some((window) => days <= window)) return "amber";
  return "green";
}

export function certAlertLevelFromType(cert: Certification, certType: CertificationType | undefined, todayIso: string) {
  if (cert.status === "missing" || cert.status === "expired") return "red";
  const expiresAt = cert.expiresAt ?? deriveExpiryDate(cert.issuedAt, certType?.validityMonths);
  if (!expiresAt) return "white";
  const days = daysUntil(expiresAt, todayIso);
  if (days < 0) return "red";
  const leadDays = certType?.alertLeadDays?.length ? certType.alertLeadDays : [60, 30, 7];
  if (leadDays.some((window) => days <= window)) return "amber";
  return "green";
}

export function certAlerts(certs: Certification[], todayIso: string) {
  return certs.filter((cert) => ["red", "amber", "white"].includes(certAlertLevel(cert, todayIso)));
}

export function bonusTrajectory(ratings: ReviewRating[]) {
  if (!ratings.length) return "amber";
  const score = ratings.reduce((sum, rating) => sum + numericRating(rating), 0) / ratings.length;
  if (score >= 4) return "green";
  if (score >= 3) return "amber";
  return "red";
}

export function grossAnnualWagesFor(state: CrewState, userId: string) {
  return (state.compensation ?? []).find((item) => item.userId === userId)?.grossAnnualWages;
}

export function isNewHireRestricted(user: Profile, todayIso: string) {
  return Boolean(user.newHireUntil && todayIso < user.newHireUntil && !user.accessUpgradedAt);
}

export function newHireReviewsDue(state: CrewState, todayIso: string) {
  return state.users.filter((user) => user.newHireUntil && todayIso >= user.newHireUntil && !user.accessUpgradedAt);
}

export function promoteToFullAccess(state: CrewState, userId: string, adminId: string, now = new Date().toISOString()) {
  const admin = state.users.find((item) => item.id === adminId);
  if (!admin || admin.role !== "admin") return state;
  return { ...state, users: state.users.map((item) => item.id === userId ? { ...item, accessUpgradedAt: now } : item) };
}

const NOTIFICATION_EXCLUDED_EMPLOYMENT_TYPES = new Set(["temp", "seasonal"]);

export function receivesRoutineNotifications(user: Profile) {
  return !user.employmentType || !NOTIFICATION_EXCLUDED_EMPLOYMENT_TYPES.has(user.employmentType);
}

export function bonusAdminReviewNoticeActive(todayIso: string) {
  const year = todayIso.slice(0, 4);
  return todayIso >= `${year}-11-16` && todayIso <= `${year}-11-30`;
}

export function bonusEmployeeNoticeActive(user: Profile, todayIso: string) {
  if (!receivesRoutineNotifications(user) || !user.hireDate) return false;
  const year = todayIso.slice(0, 4);
  if (todayIso < `${year}-10-31` || todayIso > `${year}-11-30`) return false;
  const sixMonthsBeforeToday = new Date(`${todayIso}T00:00:00Z`);
  sixMonthsBeforeToday.setUTCMonth(sixMonthsBeforeToday.getUTCMonth() - 6);
  return user.hireDate <= sixMonthsBeforeToday.toISOString().slice(0, 10);
}

export function setEmploymentStatus(state: CrewState, adminId: string, userId: string, status: NonNullable<Profile["status"]>) {
  const admin = state.users.find((item) => item.id === adminId);
  if (!admin || admin.role !== "admin") return state;
  return { ...state, users: state.users.map((item) => item.id === userId ? { ...item, status } : item) };
}

export function setCompensation(state: CrewState, adminId: string, userId: string, patch: Partial<Pick<CompensationRecord, "grossAnnualWages" | "payBand" | "retentionBonusAmount" | "retentionBonusPayoutDate" | "costOfLivingIncrease">>, now = new Date().toISOString()) {
  const admin = state.users.find((item) => item.id === adminId);
  if (!admin || admin.role !== "admin") return state;
  const existing = (state.compensation ?? []).find((item) => item.userId === userId);
  const updated: CompensationRecord = { id: existing?.id ?? uid("comp"), userId, ...existing, ...patch, updatedAt: now };
  return {
    ...state,
    compensation: existing ? state.compensation.map((item) => item.userId === userId ? updated : item) : [updated, ...(state.compensation ?? [])],
  };
}

export function estimatedBonusDollars(state: CrewState, user: Profile) {
  const average = averageQuarterlyRating(state, user.id, state.bonusPeriods[0]?.year ?? 2026);
  const percent = bonusPercentForAverage(average);
  const grossAnnualWages = grossAnnualWagesFor(state, user.id);
  if (!isBonusEligible(state, user, state.bonusPeriods[0]?.year ?? 2026) || !grossAnnualWages) return 0;
  return Math.round(grossAnnualWages * percent * 100) / 100;
}

export function averageQuarterlyRating(state: CrewState, userId: string, year: number) {
  const ratings = state.reviews
    .filter((review) => review.userId === userId && review.type === "quarterly" && review.status === "completed" && review.scheduledFor.startsWith(String(year)))
    .map((review) => review.overallRating ? numericRating(review.overallRating) : averageRatings(Object.values(review.ratings)));
  const valid = ratings.filter((rating): rating is number => Number.isFinite(rating));
  return valid.length ? valid.reduce((sum, rating) => sum + rating, 0) / valid.length : 0;
}

export function bonusPercentForAverage(average: number) {
  if (average >= 5) return 0.06;
  if (average >= 4) return 0.04;
  if (average >= 3) return 0.02;
  return 0;
}

export function isBonusEligible(state: CrewState, user: Profile, year: number, todayIso = `${year}-12-25`) {
  if (user.status && user.status !== "Active") return false;
  if (user.underNotice) return false;
  if (user.disciplinaryActionAt && daysBetween(user.disciplinaryActionAt, todayIso) < 92) return false;
  if (!user.hireDate || daysBetween(user.hireDate, todayIso) < 183) return false;
  const completedQuarterlies = state.reviews.filter((review) => review.userId === user.id && review.type === "quarterly" && review.status === "completed" && review.scheduledFor.startsWith(String(year))).length;
  return completedQuarterlies >= 2;
}

export function canSeeBonusDollars(state: CrewState, user: Profile) {
  if (hasRolePermission(state, user, "viewBonusDollars")) return true;
  return user.role === "admin" && (user.orgRole === "CFO" || user.orgRole === "Operations / Admin" || user.orgRole === "CEO / Owner" || state.permissions.cfoUserIds.includes(user.id) || state.permissions.hrOwnerUserIds.includes(user.id));
}

export function canApproveRedemptions(state: CrewState, user: Profile) {
  return user.role === "admin" || state.permissions.hrOwnerUserIds.includes(user.id);
}

export function canRunReviews(state: CrewState, user: Profile) {
  return hasRolePermission(state, user, "manageReviews") || user.role === "admin" || (user.role === "manager" && state.permissions.managerCanReviewCrew);
}

export function hasRolePermission(state: CrewState, user: Profile, key: RolePermissionKey) {
  const config = state.rolePermissions.find((item) => item.orgRole === user.orgRole) ?? state.permissions.rolePermissions?.find((item) => item.orgRole === user.orgRole);
  return Boolean(config?.permissions[key]);
}

function rewardName(state: CrewState, rewardId: string) {
  return state.rewards.find((item) => item.id === rewardId)?.name ?? "Reward";
}

function cleanOptional(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function daysUntil(dateIso: string, todayIso: string) {
  const ms = new Date(`${dateIso}T00:00:00`).getTime() - new Date(`${todayIso}T00:00:00`).getTime();
  return Math.ceil(ms / 86400000);
}

function daysBetween(startIso: string, endIso: string) {
  const ms = new Date(`${endIso}T00:00:00`).getTime() - new Date(`${startIso}T00:00:00`).getTime();
  return Math.floor(ms / 86400000);
}

function numericRating(rating: ReviewRating | undefined) {
  if (typeof rating === "number") return rating;
  if (rating === "exceeds") return 4;
  if (rating === "meets") return 3;
  if (rating === "below") return 2;
  return 0;
}

function averageRatings(ratings: Array<ReviewRating | undefined>) {
  const valid: number[] = ratings.map(numericRating).filter((rating) => rating > 0);
  return valid.length ? valid.reduce((sum, rating) => sum + rating, 0) / valid.length : 0;
}

function deriveExpiryDate(issuedAt: string | undefined, validityMonths: number | undefined) {
  if (!issuedAt || !validityMonths) return "";
  const date = new Date(`${issuedAt}T00:00:00`);
  date.setMonth(date.getMonth() + validityMonths);
  return date.toISOString().slice(0, 10);
}
