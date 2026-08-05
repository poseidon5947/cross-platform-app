import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const selfServeCrewRules = new Set(["earn-daily", "earn-weekly", "earn-monthly", "earn-feedback", "earn-cert-detail", "earn-swot"]);
const managerCrewRules = new Set(["earn-review", "earn-kpi", "earn-google", "earn-compliment", "earn-safety", "earn-peer", "earn-certs"]);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const body = await req.json().catch(() => ({}));
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "Unauthorized" }, 401);

  const { data: caller, error: callerError } = await service.from("profiles").select("id,role,org_role").eq("id", userData.user.id).single();
  if (callerError) return json({ error: callerError.message }, 403);

  const kind = resolveKind(body);
  if (!kind) return json({ error: "kind is required" }, 400);

  try {
    if (kind === "sop_completed") return await awardSopCompleted(service, caller, body);
    if (kind === "crew_rule") return await awardCrewRule(service, caller, userData.user.id, body);
    if (kind === "redeem") return await awardRedeem(service, caller, body);
    if (kind === "daily_100") return await awardDaily100(service, caller, body);
    if (kind === "streak_bonus") return await awardStreakBonus(service, caller, body);
    if (kind === "daily_100_reversal") return await awardDailyReversal(service, caller, body);
    if (kind === "streak_reversal") return await awardStreakReversal(service, caller, body);
    if (kind === "manual_adjust") return await awardManualAdjust(service, caller, body);
    return json({ error: `Unsupported award kind: ${kind}` }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Could not award points" }, 500);
  }
});

function resolveKind(body: Record<string, unknown>) {
  if (body.kind) return String(body.kind);
  if (body.type && body.type !== "crew_manual_award") return String(body.type);
  if (body.sopId) return "sop_completed";
  if (body.ruleKey === "redeem") return "redeem";
  if (body.ruleKey) return "crew_rule";
  return "";
}

async function awardSopCompleted(service: any, caller: any, body: Record<string, unknown>) {
  if (!isManager(caller)) return json({ error: "Only managers can award SOP points" }, 403);
  const sopId = stringValue(body.sopId || body.ref);
  if (!sopId) return json({ error: "sopId is required" }, 400);

  const { data: sop, error } = await service.from("sop").select("id,title,created_by").eq("id", sopId).single();
  if (error) return json({ error: error.message }, 400);

  return insertIdempotent(service, {
    userId: sop.created_by,
    type: "sop_completed",
    points: 20,
    reason: `SOP approved: ${sop.title ?? sopId}`,
    ref: sopId,
    contract: "suite.points.v1",
  });
}

async function awardCrewRule(service: any, caller: any, callerId: string, body: Record<string, unknown>) {
  const crewMemberId = stringValue(body.crewMemberId || body.userId);
  const ruleKey = stringValue(body.ruleKey);
  const ref = stringValue(body.ref);
  const weekKey = stringValue(body.weekKey);
  if (!crewMemberId || !ruleKey || !ref) return json({ error: "crewMemberId, ruleKey, and ref are required" }, 400);

  if (selfServeCrewRules.has(ruleKey) && crewMemberId !== callerId) return json({ error: "Self-serve awards can only be earned by the caller" }, 403);
  if (managerCrewRules.has(ruleKey) && !isManager(caller) && !isHrOwner(caller)) return json({ error: "This award requires manager/admin approval" }, 403);
  if (!selfServeCrewRules.has(ruleKey) && !managerCrewRules.has(ruleKey)) return json({ error: "No Crew+ award policy is configured for this rule" }, 403);

  const { data: rule, error } = await service.from("crew_earning_rule").select("id,action,points,habit,active,weekly_cap").eq("id", ruleKey).single();
  if (error || !rule?.active) return json({ error: "Unknown or inactive earning rule" }, 400);

  let points = Number(rule.points);
  if (rule.habit) {
    const cap = Number(rule.weekly_cap ?? Deno.env.get("CREW_WEEKLY_HABIT_CAP") ?? 0);
    if (cap > 0) {
      const key = weekKey || ref.split(":").find((part) => /^20\d\d-W\d\d/.test(part)) || ref;
      const { data: rows, error: habitError } = await service.from("points_events").select("points").eq("user_id", crewMemberId).like("type", "crew_habit%").ilike("ref", `%${key}%`);
      if (habitError) return json({ error: habitError.message }, 500);
      const already = (rows ?? []).reduce((sum: number, event: { points: number }) => sum + Number(event.points), 0);
      points = Math.max(0, Math.min(points, cap - already));
      if (points <= 0) return json({ eventId: null, awardedAt: null, alreadyAwarded: true, capped: true });
    }
  }

  return insertIdempotent(service, { userId: crewMemberId, type: eventTypeForRule(ruleKey), points, reason: rule.action, ref, contract: "suite.points.v1" });
}

async function awardRedeem(service: any, caller: any, body: Record<string, unknown>) {
  if (!isAdmin(caller) && !isHrOwner(caller)) return json({ error: "Only admin/HR can approve redemptions" }, 403);
  const crewMemberId = stringValue(body.crewMemberId || body.userId);
  const ref = stringValue(body.ref);
  const redemptionId = stringValue(body.redemptionId || ref.replace(/^redeem:/, ""));
  if (!crewMemberId || !redemptionId) return json({ error: "crewMemberId and redemptionId are required" }, 400);
  if (!isRedemptionWindowOpen(new Date())) return json({ error: "Redemptions open only on Jan 31, Apr 30, Jul 31, and Oct 31" }, 400);

  const { data: redemption, error } = await service.from("crew_reward_redemption").select("id,user_id,points,status").eq("id", redemptionId).single();
  if (error) return json({ error: error.message }, 400);
  if (redemption.user_id !== crewMemberId) return json({ error: "Redemption/user mismatch" }, 400);

  return insertIdempotent(service, { userId: crewMemberId, type: "redeem", points: -Math.abs(Number(redemption.points)), reason: "Reward redeemed", ref: `redeem:${redemptionId}`, contract: "suite.points.v1" });
}

async function awardDaily100(service: any, caller: any, body: Record<string, unknown>) {
  const ctx = warehouseContext(body);
  if (!canWarehouseCaller(caller, ctx.userId)) return json({ error: "Cannot award Warehouse points for another user" }, 403);
  const existing = await existingResponse(service, "daily_100", ctx.ref);
  if (existing) return existing;
  const complete = await hasRequiredDailyCompletions(service, ctx.userId, ctx.dayKey);
  if (!complete) return json({ error: "Daily tasks are not 100% complete" }, 403);

  await upsertAwardStreak(service, ctx.userId, ctx.dayKey);
  return insertIdempotent(service, { userId: ctx.userId, type: "daily_100", points: 25, reason: "100% daily truck tasks", ref: ctx.ref, contract: "suite.points.v1" });
}

async function awardStreakBonus(service: any, caller: any, body: Record<string, unknown>) {
  const ctx = warehouseContext(body);
  if (!canWarehouseCaller(caller, ctx.userId)) return json({ error: "Cannot award Warehouse points for another user" }, 403);
  if (!await hasRequiredDailyCompletions(service, ctx.userId, ctx.dayKey)) return json({ error: "Daily tasks are not 100% complete" }, 403);
  if (!await eventExistsAnyRef(service, ctx.userId, "daily_100", refsFor(ctx.userId, ctx.dayKey, ctx.ref))) return json({ error: "Daily award must exist before streak bonus" }, 400);

  const { data: streak } = await service.from("streaks").select("count,awarded_on").eq("user_id", ctx.userId).maybeSingle();
  if (!streak || Number(streak.count) % 5 !== 0 || streak.awarded_on !== ctx.dayKey) return json({ error: "No verified streak milestone for this day" }, 403);

  return insertIdempotent(service, { userId: ctx.userId, type: "streak_bonus", points: 25, reason: `${Number(streak.count)}-day streak`, ref: ctx.ref, contract: "suite.points.v1" });
}

async function awardDailyReversal(service: any, caller: any, body: Record<string, unknown>) {
  const ctx = warehouseContext(body);
  if (!canWarehouseCaller(caller, ctx.userId)) return json({ error: "Cannot reverse Warehouse points for another user" }, 403);
  const existing = await existingResponse(service, "daily_100_reversal", ctx.ref);
  if (existing) return existing;
  if (await hasRequiredDailyCompletions(service, ctx.userId, ctx.dayKey)) return json({ error: "Daily tasks are still 100% complete" }, 403);
  if (!await eventExistsAnyRef(service, ctx.userId, "daily_100", refsFor(ctx.userId, ctx.dayKey, ctx.ref))) return json({ error: "No daily award exists to reverse" }, 400);

  await decrementAwardStreak(service, ctx.userId, ctx.dayKey);
  return insertIdempotent(service, { userId: ctx.userId, type: "daily_100_reversal", points: -25, reason: "Daily task completion removed", ref: ctx.ref, contract: "suite.points.v1" });
}

async function awardStreakReversal(service: any, caller: any, body: Record<string, unknown>) {
  const ctx = warehouseContext(body);
  if (!canWarehouseCaller(caller, ctx.userId)) return json({ error: "Cannot reverse Warehouse streak points for another user" }, 403);
  const existing = await existingResponse(service, "manual_adjust", ctx.ref);
  if (existing) return existing;
  if (await hasRequiredDailyCompletions(service, ctx.userId, ctx.dayKey)) return json({ error: "Daily tasks are still 100% complete" }, 403);
  if (!await eventExistsAnyRef(service, ctx.userId, "streak_bonus", refsFor(ctx.userId, ctx.dayKey, ctx.ref))) return json({ error: "No streak bonus exists to reverse" }, 400);

  return insertIdempotent(service, { userId: ctx.userId, type: "manual_adjust", points: -25, reason: "Reversed streak bonus", ref: ctx.ref, contract: "suite.points.v1" });
}

async function awardManualAdjust(service: any, caller: any, body: Record<string, unknown>) {
  if (!isAdmin(caller)) return json({ error: "Only admins can manually adjust points" }, 403);
  const userId = stringValue(body.crewMemberId || body.userId);
  const ref = stringValue(body.ref);
  const points = Number(body.points);
  const reason = stringValue(body.reason || "Manual points adjustment");
  if (!userId || !ref || !Number.isFinite(points) || points === 0) return json({ error: "user, ref, and non-zero points are required" }, 400);
  return insertIdempotent(service, { userId, type: "manual_adjust", points, reason, ref, contract: "suite.points.v1" });
}

async function insertIdempotent(service: any, event: { userId: string; type: string; points: number; reason: string; ref: string; contract: string }) {
  const existing = await existingResponse(service, event.type, event.ref);
  if (existing) return existing;

  const { data, error } = await service.from("points_events").insert({ user_id: event.userId, type: event.type, points: event.points, reason: event.reason, ref: event.ref, ts: new Date().toISOString() }).select("id,ts").single();
  if (error) return json({ error: error.message }, 500);
  return json({ eventId: data.id, awardedAt: data.ts, alreadyAwarded: false, contract: event.contract });
}

async function existingResponse(service: any, type: string, ref: string) {
  const { data: existing, error } = await service.from("points_events").select("id,ts").eq("type", type).eq("ref", ref).maybeSingle();
  if (error) return json({ error: error.message }, 500);
  return existing ? json({ eventId: existing.id, awardedAt: existing.ts, alreadyAwarded: true }) : null;
}

async function hasRequiredDailyCompletions(service: any, userId: string, dayKey: string) {
  const { data: tasks, error: taskError } = await service.from("truck_tasks").select("id").eq("freq", "daily").neq("required_for_daily_points", false);
  if (taskError) throw new Error(taskError.message);
  if (!tasks?.length) return false;

  const { data: completions, error: completionError } = await service.from("task_completions").select("task_id").eq("user_id", userId).eq("period_key", dayKey);
  if (completionError) throw new Error(completionError.message);
  const done = new Set((completions ?? []).map((item: { task_id: string }) => item.task_id));
  return tasks.every((task: { id: string }) => done.has(task.id));
}

async function upsertAwardStreak(service: any, userId: string, dayKey: string) {
  const { data: streak } = await service.from("streaks").select("count,last,awarded_on").eq("user_id", userId).maybeSingle();
  const yesterday = addDays(dayKey, -1);
  const count = streak?.last === yesterday ? Number(streak.count) + 1 : streak?.last === dayKey ? Number(streak.count) : 1;
  const awardedOn = count % 5 === 0 ? dayKey : streak?.awarded_on ?? null;
  const { error } = await service.from("streaks").upsert({ user_id: userId, count, last: dayKey, awarded_on: awardedOn });
  if (error) throw new Error(error.message);
}

async function decrementAwardStreak(service: any, userId: string, dayKey: string) {
  const { data: streak } = await service.from("streaks").select("count,last,awarded_on").eq("user_id", userId).maybeSingle();
  if (!streak) return;
  const { error } = await service.from("streaks").upsert({
    user_id: userId,
    count: Math.max(0, Number(streak.count) - 1),
    last: streak.last === dayKey ? null : streak.last,
    awarded_on: streak.awarded_on === dayKey ? null : streak.awarded_on,
  });
  if (error) throw new Error(error.message);
}

async function eventExistsAnyRef(service: any, userId: string, type: string, refs: string[]) {
  const { data, error } = await service.from("points_events").select("id").eq("user_id", userId).eq("type", type).in("ref", refs).limit(1);
  if (error) throw new Error(error.message);
  return Boolean(data?.length);
}

function warehouseContext(body: Record<string, unknown>) {
  const userId = stringValue(body.crewMemberId || body.userId);
  const dayKey = stringValue(body.dayKey) || dayKeyFromRef(stringValue(body.ref));
  const ref = stringValue(body.ref) || `${userId}:${dayKey}`;
  if (!userId || !dayKey) throw new Error("crewMemberId/userId and dayKey are required");
  return { userId, dayKey, ref };
}

function refsFor(userId: string, dayKey: string, ref: string) {
  return Array.from(new Set([dayKey, `${userId}:${dayKey}`, ref].filter(Boolean)));
}

function dayKeyFromRef(ref: string) {
  return ref.includes(":") ? ref.split(":").at(-1) ?? ref : ref;
}

function addDays(dayKey: string, days: number) {
  const date = new Date(`${dayKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function eventTypeForRule(ruleKey: string) {
  const map: Record<string, string> = {
    "earn-daily": "crew_habit_ritual",
    "earn-weekly": "crew_habit_ritual",
    "earn-monthly": "crew_habit_ritual",
    "earn-feedback": "crew_feedback",
    "earn-cert-detail": "crew_cert_detail",
    "earn-swot": "crew_swot",
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

function isAdmin(caller: { role: string }) {
  return caller.role === "admin";
}

function isManager(caller: { role: string }) {
  return caller.role === "admin" || caller.role === "manager";
}

function isHrOwner(caller: { role: string; org_role?: string | null }) {
  return caller.role === "admin" && ["Operations", "Operations / Admin", "CFO"].includes(caller.org_role ?? "");
}

function canWarehouseCaller(caller: { id: string; role: string }, userId: string) {
  return caller.id === userId || isManager(caller);
}

function stringValue(value: unknown) {
  return value == null ? "" : String(value);
}

function isRedemptionWindowOpen(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Vancouver", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  return ["01-31", "04-30", "07-31", "10-31"].includes(`${month}-${day}`);
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: cors });
}
