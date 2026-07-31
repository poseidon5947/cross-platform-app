export type AwardKind =
  | "sop_completed"
  | "crew_rule"
  | "redeem"
  | "daily_100"
  | "streak_bonus"
  | "daily_100_reversal"
  | "streak_reversal"
  | "manual_adjust";

export interface AwardCaller {
  id: string;
  role: "admin" | "manager" | "crew";
  orgRole?: string | null;
}

export interface DailyAwardTask {
  id: string;
  freq: "daily" | "weekly" | "monthly";
  requiredForDailyPoints?: boolean;
}

export interface DailyAwardCompletion {
  userId: string;
  taskId: string;
  periodKey: string;
}

const selfServeCrewRules = new Set(["earn-daily", "earn-weekly", "earn-monthly", "earn-feedback"]);
const managerCrewRules = new Set(["earn-swot", "earn-review", "earn-kpi", "earn-google", "earn-compliment", "earn-safety", "earn-peer", "earn-certs"]);

export function canAwardCanonical(caller: AwardCaller, targetUserId: string, kind: AwardKind, ruleKey = "") {
  const isAdmin = caller.role === "admin";
  const isManager = caller.role === "manager";
  const isAdminOrManager = isAdmin || isManager;
  const isHrOwner = isAdmin && ["Operations", "CFO"].includes(caller.orgRole ?? "");

  if (kind === "manual_adjust") return isAdmin;
  if (kind === "redeem") return isAdmin || isHrOwner;
  if (kind === "sop_completed") return isAdminOrManager;
  if (kind === "daily_100" || kind === "streak_bonus" || kind === "daily_100_reversal" || kind === "streak_reversal") return caller.id === targetUserId || isAdminOrManager;
  if (kind === "crew_rule" && selfServeCrewRules.has(ruleKey)) return caller.id === targetUserId;
  if (kind === "crew_rule" && managerCrewRules.has(ruleKey)) return isAdminOrManager || isHrOwner;
  return false;
}

export function requiredDailyComplete(tasks: DailyAwardTask[], completions: DailyAwardCompletion[], userId: string, dayKey: string) {
  const required = tasks.filter((task) => task.freq === "daily" && task.requiredForDailyPoints !== false);
  if (!required.length) return false;
  const done = new Set(completions.filter((item) => item.userId === userId && item.periodKey === dayKey).map((item) => item.taskId));
  return required.every((task) => done.has(task.id));
}

export function canonicalWarehouseRef(userId: string, dayKey: string) {
  return `${userId}:${dayKey}`;
}

export function legacyOrCanonicalRefs(userId: string, dayKey: string) {
  return [dayKey, canonicalWarehouseRef(userId, dayKey)];
}
