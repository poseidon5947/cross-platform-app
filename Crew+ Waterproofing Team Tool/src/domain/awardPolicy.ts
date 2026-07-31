import type { EarningRule, PointsEvent, Profile } from "../types";

const selfServe = new Set(["earn-daily", "earn-weekly", "earn-monthly", "earn-feedback"]);
const managerOnly = new Set(["earn-swot", "earn-review", "earn-kpi", "earn-google", "earn-compliment", "earn-safety", "earn-peer", "earn-certs"]);

export function canCallerAwardRule(caller: Profile, crewMemberId: string, ruleKey: string) {
  const isAdminOrManager = caller.role === "admin" || caller.role === "manager";
  const isHrOwner = caller.role === "admin" && ["Operations", "Operations / Admin", "CFO"].includes(caller.orgRole);
  if (ruleKey === "redeem") return caller.role === "admin" || isHrOwner;
  if (selfServe.has(ruleKey)) return caller.id === crewMemberId;
  if (managerOnly.has(ruleKey)) return isAdminOrManager || isHrOwner;
  return false;
}

export function resolveServerAwardPoints(rule: EarningRule, events: PointsEvent[], crewMemberId: string, weekKey: string, weeklyCap: number) {
  if (!rule.active) return 0;
  if (!rule.habit) return rule.points;
  const already = events
    .filter((event) => event.userId === crewMemberId && event.type.startsWith("crew_habit") && event.ref.includes(weekKey))
    .reduce((sum, event) => sum + event.points, 0);
  return Math.max(0, Math.min(rule.points, weeklyCap - already));
}

export function eventTypeForRule(ruleKey: string) {
  const map: Record<string, string> = {
    "earn-daily": "crew_habit_ritual",
    "earn-weekly": "crew_habit_ritual",
    "earn-monthly": "crew_habit_ritual",
    "earn-feedback": "crew_feedback",
    "earn-review": "crew_review_completed",
    "earn-kpi": "crew_kpi_hit",
    "earn-google": "crew_google_review",
    "earn-compliment": "crew_compliment",
    "earn-safety": "crew_safety_milestone",
    "earn-peer": "crew_peer_recognition",
    "earn-certs": "crew_certs_current",
  };
  return map[ruleKey] ?? "";
}
