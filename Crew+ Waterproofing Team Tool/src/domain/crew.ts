import type { Cadence, Certification, CertificationType, CrewState, PointsEvent, Profile, RedemptionStatus, Review, ReviewRating, ReviewType, RolePermissionKey } from "../types";

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

export function cappedHabitAward(state: CrewState, userId: string, points: number, weekKey: string) {
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
  const weekKey = periodKey.slice(0, 8);
  const points = rule.habit ? cappedHabitAward(state, userId, rule.points, weekKey) : rule.points;
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
    { type: "quarterly" as ReviewType, scheduledFor: `${year}-12-15` },
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

export function submitFeedback(state: CrewState, userId: string, message: string, now = new Date().toISOString()) {
  const ref = `feedback:${userId}:${now.slice(0, 10)}:${message.slice(0, 12)}`;
  if (!message.trim() || !shouldAward(state.pointsEvents, ref, "crew_feedback")) return state;
  // TODO confirm with client: feedback was included in the defaulted "+5 etc." group.
  const event: PointsEvent = { id: uid("pe"), userId, type: "crew_feedback", points: rulePoints(state, "earn-feedback", 5), reason: "Company feedback submitted", ref, ts: now, source: "crew" };
  return { ...state, pointsEvents: [event, ...state.pointsEvents] };
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
  const score = ratings.reduce((sum, rating) => sum + (rating === "exceeds" ? 3 : rating === "meets" ? 2 : 1), 0) / ratings.length;
  if (score >= 2.5) return "green";
  if (score >= 1.6) return "amber";
  return "red";
}

export function estimatedBonusDollars(state: CrewState, user: Profile) {
  const period = state.bonusPeriods[0];
  const weight = state.bonusConfig.roleWeights[user.orgRole] ?? 1;
  const pool = period.annualProfit * period.poolPercent;
  return Math.round(pool * weight * 100) / 100;
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

function daysUntil(dateIso: string, todayIso: string) {
  const ms = new Date(`${dateIso}T00:00:00`).getTime() - new Date(`${todayIso}T00:00:00`).getTime();
  return Math.ceil(ms / 86400000);
}

function deriveExpiryDate(issuedAt: string | undefined, validityMonths: number | undefined) {
  if (!issuedAt || !validityMonths) return "";
  const date = new Date(`${issuedAt}T00:00:00`);
  date.setMonth(date.getMonth() + validityMonths);
  return date.toISOString().slice(0, 10);
}
