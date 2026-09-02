import type {
  AppState,
  MaintenanceRequest,
  MaintenanceTargetType,
  Material,
  OfflineCommand,
  PointsEvent,
  ServiceId,
  Streak,
  TaskCompletion,
  TaskFrequency,
  Transaction,
  Truck,
  TruckLog,
  TruckTask,
  TxType,
  User,
} from "../types";
import { canonicalWarehouseRef, legacyOrCanonicalRefs } from "./pointsAwardPolicy";
import type { MaterialUnit } from "../types";

const VANCOUVER_TZ = "America/Vancouver";
const DAY_MS = 86_400_000;
const DAILY_100_POINTS = 25;
const STREAK_BONUS_POINTS = 25;

export const ALLOWED_MATERIAL_UNITS: MaterialUnit[] = ["Unit", "Roll", "Drum", "Box", "Sausage"];

export function id(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function money(value: number) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(value || 0);
}

export function normalizeMaterialUnit(value: string): MaterialUnit | null {
  const normalized = value.trim().toLowerCase();
  return ALLOWED_MATERIAL_UNITS.find((unit) => unit.toLowerCase() === normalized) ?? null;
}

export function remapProvisionalMaterialUnit(value: string): MaterialUnit {
  const normalized = value.trim().toLowerCase();
  if (/barrel|gallon|litre|liter|pail|jug|can|tank|drum|\bgal\b|\bltr?\b/.test(normalized)) return "Drum";
  if (/roll/.test(normalized)) return "Roll";
  if (/box|case/.test(normalized)) return "Box";
  if (/tube|sausage/.test(normalized)) return "Sausage";
  return "Unit";
}

export function stepForMaterialUnit(unit: MaterialUnit): 0.25 | 1 {
  return unit === "Drum" ? 0.25 : 1;
}

export function applyCostChangeFlag(existing: Material | undefined, next: Material, now = new Date().toISOString()): Material {
  if (existing && next.cost !== existing.cost) {
    return { ...next, previousCost: existing.cost, priceChangedAt: now };
  }
  return { ...next, previousCost: existing?.previousCost, priceChangedAt: existing?.priceChangedAt };
}

export function priceChangeMaterials(materials: Material[]) {
  return materials.filter((material) => material.previousCost != null && material.cost !== material.previousCost);
}

export function stockStatus(material: Pick<Material, "qty" | "reorderPoint">) {
  if (material.qty <= 0) return { key: "bad" as const, label: "Out" };
  if (material.qty < material.reorderPoint) return { key: "bad" as const, label: "Reorder" };
  if (material.qty <= material.reorderPoint * 1.15) return { key: "warn" as const, label: "Low" };
  return { key: "good" as const, label: "OK" };
}

export function signedQuantity(type: TxType, qty: number) {
  if (["use", "deliver", "loss"].includes(type)) return -Math.abs(qty);
  if (["receive", "return"].includes(type)) return Math.abs(qty);
  if (type === "adjust") return qty;
  return qty;
}

export function setExactCountDelta(currentQty: number, targetQty: number) {
  return targetQty - currentQty;
}

export function applyTransactions(materials: Material[], txs: Pick<Transaction, "materialId" | "qty" | "type">[]) {
  return materials.map((material) => {
    const delta = txs
      .filter((tx) => tx.materialId === material.id)
      .reduce((sum, tx) => sum + signedQuantity(tx.type, tx.qty), 0);
    return delta === 0 ? material : { ...material, qty: Math.max(0, roundStep(material.qty + delta, material.step)) };
  });
}

export function roundStep(value: number, step: 0.25 | 0.5 | 1) {
  return Math.round(value / step) * step;
}

export function roundUpStep(value: number, step: 0.25 | 0.5 | 1) {
  return Math.ceil(value / step) * step;
}

export function reorderLine(material: Material) {
  const rawNeed = Math.max(material.step, material.reorderPoint - material.qty + material.reorderPoint * 0.2);
  const suggestedQty = roundUpStep(Math.max(rawNeed, 0), material.step);
  const pallets = material.unitsPerPallet ? Math.ceil(suggestedQty / material.unitsPerPallet) : 0;
  return {
    materialId: material.id,
    suggestedQty,
    pallets,
    lineCost: suggestedQty * material.cost,
  };
}

export function reorderEstimate(materials: Material[], freight = 175) {
  const lines = materials.filter((material) => material.strictTracking !== false && stockStatus(material).key !== "good").map(reorderLine);
  const subtotal = lines.reduce((sum, line) => sum + line.lineCost, 0);
  const gst = subtotal * 0.05;
  return { lines, subtotal, gst, freight, total: subtotal + gst + freight };
}

function zonedParts(date = new Date(), timeZone = VANCOUVER_TZ) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function todayKey(date = new Date(), timeZone = VANCOUVER_TZ) {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

export function monthKey(date = new Date(), timeZone = VANCOUVER_TZ) {
  const p = zonedParts(date, timeZone);
  return `${p.year}-M${p.month}`;
}

export function weekKey(date = new Date(), timeZone = VANCOUVER_TZ) {
  const p = zonedParts(date, timeZone);
  const noon = new Date(`${p.year}-${p.month}-${p.day}T12:00:00Z`);
  const day = (noon.getUTCDay() + 6) % 7;
  const monday = new Date(noon.getTime() - day * DAY_MS);
  return todayKey(monday, "UTC");
}

export function periodKey(freq: TaskFrequency, date = new Date()) {
  if (freq === "weekly") return weekKey(date);
  if (freq === "monthly") return monthKey(date);
  return todayKey(date);
}

export function isTaskDone(completions: TaskCompletion[], userId: string, task: TruckTask, date = new Date()) {
  return completions.some((completion) => {
    return completion.userId === userId && completion.taskId === task.id && completion.periodKey === periodKey(task.freq, date);
  });
}

export function dailyProgress(tasks: TruckTask[], completions: TaskCompletion[], userId: string, date = new Date()) {
  const daily = tasks.filter((task) => task.freq === "daily" && task.requiredForDailyPoints !== false);
  const done = daily.filter((task) => isTaskDone(completions, userId, task, date)).length;
  return { done, total: daily.length, pct: daily.length ? Math.round((done / daily.length) * 100) : 0 };
}

export function evaluateDailyPoints(
  state: Pick<AppState, "truckTasks" | "taskCompletions" | "pointsEvents" | "streaks">,
  userId: string,
  date = new Date(),
) {
  const ref = todayKey(date);
  const eventRef = canonicalWarehouseRef(userId, ref);
  const acceptedRefs = legacyOrCanonicalRefs(userId, ref);
  const progress = dailyProgress(state.truckTasks, state.taskCompletions, userId, date);
  const alreadyAwarded = state.pointsEvents.some((event) => event.userId === userId && event.type === "daily_100" && acceptedRefs.includes(event.ref));
  const alreadyReversed = state.pointsEvents.some(
    (event) => event.userId === userId && event.type === "daily_100_reversal" && acceptedRefs.includes(event.ref),
  );
  let streak = state.streaks.find((row) => row.userId === userId) ?? { userId, count: 0, last: null, awardedOn: null };
  const events: PointsEvent[] = [];

  if (progress.pct === 100 && !alreadyAwarded) {
    const yesterday = todayKey(new Date(date.getTime() - DAY_MS));
    const count = streak.last === yesterday ? streak.count + 1 : streak.last === ref ? streak.count : 1;
    streak = { userId, count, last: ref, awardedOn: count % 5 === 0 ? ref : streak.awardedOn };
    events.push({ id: id("pe"), userId, type: "daily_100", points: DAILY_100_POINTS, reason: "100% daily truck tasks", ref: eventRef, ts: date.toISOString() });
    if (count % 5 === 0) {
      events.push({ id: id("pe"), userId, type: "streak_bonus", points: STREAK_BONUS_POINTS, reason: `${count}-day streak`, ref: eventRef, ts: date.toISOString() });
    }
  }

  if (progress.pct < 100 && alreadyAwarded && !alreadyReversed) {
    const bonusToday = state.pointsEvents.some((event) => event.userId === userId && event.type === "streak_bonus" && acceptedRefs.includes(event.ref));
    events.push({ id: id("pe"), userId, type: "daily_100_reversal", points: -DAILY_100_POINTS, reason: "Daily task completion removed", ref: eventRef, ts: date.toISOString() });
    if (bonusToday) {
      events.push({ id: id("pe"), userId, type: "manual_adjust", points: -STREAK_BONUS_POINTS, reason: "Reversed streak bonus", ref: eventRef, ts: date.toISOString() });
    }
    streak = { userId, count: Math.max(0, streak.count - 1), last: streak.last === ref ? null : streak.last, awardedOn: streak.awardedOn === ref ? null : streak.awardedOn };
  }

  return { events, streak };
}

export function monthlyInventoryLogCsv(state: Pick<AppState, "transactions" | "materials" | "sites" | "services" | "users">, month: string) {
  const normalizedMonth = month.replace("-M", "-");
  const usageTypes: TxType[] = ["use", "deliver", "loss", "return"];
  const head = ["Date", "Material", "Quantity", "Unit", "Action", "Job/Site", "Service", "Crew Member", "Unit Cost", "Value"];
  const rows = state.transactions
    .filter((tx) => usageTypes.includes(tx.type) && tx.ts.slice(0, 7) === normalizedMonth)
    .sort((a, b) => a.ts.localeCompare(b.ts))
    .map((tx) => {
      const material = state.materials.find((item) => item.id === tx.materialId);
      const unitCost = material?.cost ?? 0;
      return [
        tx.ts.slice(0, 10),
        material?.name ?? "",
        tx.qty,
        material?.unit ?? "",
        tx.type,
        state.sites.find((site) => site.id === tx.siteId)?.name ?? "No site",
        state.services.find((service) => service.id === tx.serviceId)?.name ?? "Service",
        state.users.find((user) => user.id === tx.userId)?.name ?? "Unassigned",
        unitCost.toFixed(2),
        (tx.qty * unitCost).toFixed(2),
      ];
    });
  return [head, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function queueCommand(queue: OfflineCommand[], command: OfflineCommand) {
  return [...queue.filter((item) => item.id !== command.id), command];
}

export function serviceRequired(siteId?: string, serviceId?: ServiceId) {
  return Boolean(siteId && serviceId);
}

export function batteryState(lastCharged?: string | null) {
  if (!lastCharged) return { key: "bad" as const, label: "never charged" };
  const days = (Date.now() - new Date(lastCharged).getTime()) / DAY_MS;
  if (days >= 2) return { key: "bad" as const, label: "charge due" };
  if (days >= 1) return { key: "warn" as const, label: "charge soon" };
  return { key: "good" as const, label: "charged" };
}

const KM_TASK_PHRASES = ["record odometer", "record ending km", "record km"];

export function isKmEntryTask(task: Pick<TruckTask, "freq" | "serviceId" | "text">) {
  return task.freq === "daily" && task.serviceId === "veh" && KM_TASK_PHRASES.some((needle) => task.text.toLowerCase().includes(needle));
}

export function vehicleTaskIdsForTruckLog(tasks: TruckTask[], log: Pick<TruckLog, "oilChecked" | "fuelTopped">) {
  const wanted = [...KM_TASK_PHRASES];
  if (log.fuelTopped) wanted.push("gas tank", "fuel");
  return tasks
    .filter((task) => task.freq === "daily" && task.serviceId === "veh")
    .filter((task) => wanted.some((needle) => task.text.toLowerCase().includes(needle)))
    .map((task) => task.id);
}

export function combineDateWithNow(dateStr?: string, now = new Date()) {
  if (!dateStr) return now.toISOString();
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return now.toISOString();
  return new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds()).toISOString();
}

export function applyTruckLog(
  state: Pick<AppState, "trucks" | "truckLogs" | "truckTasks" | "taskCompletions" | "pointsEvents" | "streaks">,
  log: TruckLog,
) {
  const autoTaskIds = vehicleTaskIdsForTruckLog(state.truckTasks, log);
  const pk = periodKey("daily", new Date(log.ts));
  const existingKeys = new Set(state.taskCompletions.map((completion) => `${completion.userId}:${completion.taskId}:${completion.periodKey}`));
  const completions = [
    ...state.taskCompletions,
    ...autoTaskIds
      .filter((taskId) => !existingKeys.has(`${log.driverId}:${taskId}:${pk}`))
      .map((taskId) => ({ id: id("tc"), userId: log.driverId, taskId, periodKey: pk, completedAt: log.ts })),
  ];
  const evaluated = evaluateDailyPoints({ ...state, taskCompletions: completions }, log.driverId, new Date(log.ts));
  return {
    trucks: state.trucks.map((truck: Truck) =>
      truck.id === log.truckId
        ? { ...truck, km: Math.max(truck.km, log.km), lastOil: log.oilChecked ? Math.max(truck.lastOil, log.km) : truck.lastOil }
        : truck,
    ),
    truckLogs: [log, ...state.truckLogs],
    taskCompletions: completions,
    pointsEvents: [...state.pointsEvents, ...evaluated.events],
    streaks: state.streaks.some((row) => row.userId === evaluated.streak.userId)
      ? state.streaks.map((row) => (row.userId === evaluated.streak.userId ? evaluated.streak : row))
      : [...state.streaks, evaluated.streak],
    autoTaskIds,
    pointsEventsCreated: evaluated.events,
  };
}

const MAINTENANCE_RESOLVER_ORG_ROLES = new Set(["Crew Lead", "CEO / Owner", "CEO"]);

export function canResolveMaintenanceRequests(user: Pick<User, "orgRole">) {
  return Boolean(user.orgRole && MAINTENANCE_RESOLVER_ORG_ROLES.has(user.orgRole));
}

export function submitMaintenanceRequest(
  state: AppState,
  userId: string,
  targetType: MaintenanceTargetType,
  targetId: string,
  targetLabel: string,
  description: string,
  deadlineAt?: string,
  now = new Date().toISOString(),
): AppState {
  if (!description.trim() || !targetId) return state;
  const request: MaintenanceRequest = {
    id: `maint-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    targetType,
    targetId,
    targetLabel,
    description: description.trim(),
    requestedBy: userId,
    requestedAt: now,
    status: "open",
    deadlineAt: deadlineAt || undefined,
  };
  return { ...state, maintenanceRequests: [request, ...state.maintenanceRequests] };
}

export function respondToMaintenanceRequest(
  state: AppState,
  responderId: string,
  requestId: string,
  responseNote: string,
  now = new Date().toISOString(),
): AppState {
  const responder = state.users.find((item) => item.id === responderId);
  if (!responder || !canResolveMaintenanceRequests(responder)) return state;
  return {
    ...state,
    maintenanceRequests: state.maintenanceRequests.map((item) =>
      item.id === requestId
        ? { ...item, status: "resolved" as const, respondedBy: responderId, respondedAt: now, responseNote: responseNote.trim() || undefined }
        : item,
    ),
  };
}
