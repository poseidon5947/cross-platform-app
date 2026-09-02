import { supabase } from "../integrations/supabase";
import type { AppState, MaintenanceRequest, Material, OfflineCommand, PointsEvent, Service, Site, Streak, TaskCompletion, ToolItem, Transaction, Truck, TruckLog, TruckTask, User } from "../types";

function requireClient() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

const materialFromRow = (row: any): Material => ({
  id: row.id,
  name: row.name,
  category: row.category,
  unit: row.unit,
  step: Number(row.step) === 0.25 ? 0.25 : Number(row.step) === 0.5 ? 0.5 : 1,
  pack: row.pack ?? "",
  unitsPerPallet: Number(row.units_per_pallet ?? 0),
  cost: Number(row.cost ?? 0),
  previousCost: row.previous_cost == null ? undefined : Number(row.previous_cost),
  priceChangedAt: row.price_changed_at ?? undefined,
  strictTracking: row.strict_tracking ?? true,
  qty: Number(row.qty ?? 0),
  reorderPoint: Number(row.reorder_point ?? 0),
  bin: row.bin ?? "",
});

const materialToRow = (material: Material, includeQty = true) => ({
  id: isUuid(material.id) ? material.id : undefined,
  name: material.name,
  category: material.category,
  unit: material.unit,
  step: material.step,
  pack: material.pack,
  units_per_pallet: material.unitsPerPallet,
  cost: material.cost,
  previous_cost: material.previousCost ?? null,
  price_changed_at: material.priceChangedAt ?? null,
  strict_tracking: material.strictTracking ?? true,
  ...(includeQty ? { qty: material.qty } : {}),
  reorder_point: material.reorderPoint,
  bin: material.bin,
});

const txFromRow = (row: any): Transaction => ({
  id: row.id,
  materialId: row.material_id,
  qty: Number(row.qty),
  type: row.type,
  siteId: row.site_id ?? undefined,
  serviceId: row.service_id ?? undefined,
  userId: row.user_id,
  note: row.note ?? undefined,
  ts: row.ts,
});

const txToRow = (tx: Omit<Transaction, "id" | "ts">) => ({
  material_id: tx.materialId,
  qty: tx.qty,
  type: tx.type,
  site_id: tx.siteId,
  service_id: tx.serviceId,
  user_id: tx.userId,
  note: tx.note ?? null,
});

const profileFromRow = (row: any): User => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  orgRole: row.org_role ?? undefined,
  color: row.color,
  points: Number(row.points ?? 0),
});

const maintenanceFromRow = (row: any): MaintenanceRequest => ({
  id: row.id,
  targetType: row.target_type,
  targetId: row.target_id,
  targetLabel: row.target_label,
  description: row.description,
  requestedBy: row.requested_by,
  requestedAt: row.requested_at,
  status: row.status,
  respondedBy: row.responded_by ?? undefined,
  respondedAt: row.responded_at ?? undefined,
  responseNote: row.response_note ?? undefined,
  deadlineAt: row.deadline_at ?? undefined,
});

const siteFromRow = (row: any): Site => ({
  id: row.id,
  name: row.name,
  address: row.address ?? "",
  qboCustomerName: row.qbo_customer_name ?? undefined,
  qboProjectId: row.qbo_project_id ?? undefined,
  qboProjectName: row.qbo_project_name ?? undefined,
  source: row.source ?? "manual",
});

const serviceFromRow = (row: any): Service => ({ id: row.id, name: row.name, short: row.id.toUpperCase() });

const toolFromRow = (row: any): ToolItem => ({
  id: row.id,
  name: row.name,
  serviceId: row.service_id,
  battery: row.battery,
  status: row.status,
  condition: row.condition,
  lastCharged: row.last_charged,
  note: row.note ?? undefined,
  outBy: row.out_by ?? undefined,
  outJob: row.out_job ?? undefined,
  outService: row.out_service ?? undefined,
  outTs: row.out_ts ?? undefined,
});

const toolToRow = (tool: ToolItem) => ({
  id: isUuid(tool.id) ? tool.id : undefined,
  name: tool.name,
  service_id: tool.serviceId,
  battery: tool.battery,
  status: tool.status,
  condition: tool.condition,
  last_charged: tool.lastCharged ?? null,
  note: tool.note ?? null,
  out_by: tool.outBy ?? null,
  out_job: tool.outJob ?? null,
  out_service: tool.outService ?? null,
  out_ts: tool.outTs ?? null,
});

const truckFromRow = (row: any): Truck => ({ id: row.id, name: row.name, km: Number(row.km), lastServiced: row.last_serviced, lastOil: Number(row.last_oil) });
const truckTaskFromRow = (row: any): TruckTask => ({
  id: row.id,
  text: row.text,
  serviceId: row.service_id,
  freq: row.freq,
  timeOfDay: row.time_of_day ?? undefined,
  requiredForDailyPoints: row.required_for_daily_points ?? true,
});
const completionFromRow = (row: any): TaskCompletion => ({ id: row.id, userId: row.user_id, taskId: row.task_id, periodKey: row.period_key, completedAt: row.completed_at });
const pointsFromRow = (row: any): PointsEvent => ({ id: row.id, userId: row.user_id, type: row.type, points: row.points, reason: row.reason, ref: row.ref, ts: row.ts });
const truckLogFromRow = (row: any): TruckLog => ({
  id: row.id,
  truckId: row.truck_id,
  ts: row.ts,
  km: Number(row.km),
  driverId: row.driver_id,
  siteId: row.site_id,
  serviceId: row.service_id,
  oilChecked: row.oil_checked,
  fuelTopped: row.fuel_topped,
  gasStation: row.gas_station ?? undefined,
  totalCost: row.total_cost == null ? undefined : Number(row.total_cost),
  receiptPhotoName: row.receipt_photo_name ?? undefined,
  exteriorWash: row.exterior_wash ?? undefined,
  repairs: row.repairs ?? undefined,
  notes: row.notes ?? undefined,
});

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function read<T>(table: string, mapper: (row: any) => T, order = "created_at") {
  const { data, error } = await requireClient().from(table).select("*").order(order, { ascending: table === "materials" });
  if (error) throw error;
  return (data ?? []).map(mapper);
}

export async function loadRemoteState(currentUserId: string): Promise<AppState> {
  const [materials, sites, services, users, transactions, tools, trucks, truckLogs, truckTasks, taskCompletions, pointsEvents, streakRows, maintenanceRequests] =
    await Promise.all([
      read("materials", materialFromRow),
      read("sites", siteFromRow),
      read("services", serviceFromRow),
      read("profiles", profileFromRow),
      read("transactions", txFromRow, "ts"),
      read("tools", toolFromRow),
      read("trucks", truckFromRow),
      read("truck_logs", truckLogFromRow, "ts"),
      read("truck_tasks", truckTaskFromRow),
      read("task_completions", completionFromRow, "completed_at"),
      read("points_events", pointsFromRow, "ts"),
      read("streaks", (row) => ({ userId: row.user_id, count: row.count, last: row.last, awardedOn: row.awarded_on })),
      read("maintenance_request", maintenanceFromRow, "requested_at"),
    ]);
  return { materials, sites, services, users, transactions, tools, trucks, truckLogs, truckTasks, taskCompletions, pointsEvents, streaks: streakRows, currentUserId, offlineQueue: [], maintenanceRequests };
}

export async function insertMaintenanceRequest(request: MaintenanceRequest) {
  const { error } = await requireClient().from("maintenance_request").insert({
    id: request.id,
    target_type: request.targetType,
    target_id: request.targetId,
    target_label: request.targetLabel,
    description: request.description,
    requested_by: request.requestedBy,
    requested_at: request.requestedAt,
    status: request.status,
    deadline_at: request.deadlineAt ?? null,
  });
  if (error) throw error;
}

export async function respondMaintenanceRequest(request: MaintenanceRequest) {
  const { error } = await requireClient().from("maintenance_request").update({
    status: request.status,
    responded_by: request.respondedBy ?? null,
    responded_at: request.respondedAt ?? null,
    response_note: request.responseNote ?? null,
  }).eq("id", request.id);
  if (error) throw error;
}

export async function loadProfile(userId: string) {
  const { data, error } = await requireClient().from("profiles").select("*").eq("id", userId).single();
  if (error) throw error;
  return profileFromRow(data);
}

export async function insertTransactions(transactions: Omit<Transaction, "id" | "ts">[]) {
  const { error } = await requireClient().from("transactions").insert(transactions.map(txToRow));
  if (error) throw error;
}

export async function upsertMaterial(material: Material, includeQty = true) {
  const { error } = await requireClient().from("materials").upsert(materialToRow(material, includeQty), { onConflict: "name" });
  if (error) throw error;
}

export async function upsertMaterialsMetadata(materials: Material[]) {
  const { error } = await requireClient().from("materials").upsert(materials.map((material) => materialToRow(material, false)), { onConflict: "name" });
  if (error) throw error;
}

export async function upsertSite(site: Site) {
  const { error } = await requireClient().from("sites").upsert({
    id: isUuid(site.id) ? site.id : undefined,
    name: site.name,
    address: site.address,
    qbo_customer_name: site.qboCustomerName ?? null,
    qbo_project_id: site.qboProjectId ?? null,
    qbo_project_name: site.qboProjectName ?? null,
    source: site.source,
  });
  if (error) throw error;
}

export async function updateTool(tool: ToolItem) {
  const { error } = await requireClient().from("tools").upsert(toolToRow(tool));
  if (error) throw error;
}

export async function persistPoints(events: PointsEvent[], _streak?: Streak) {
  const client = requireClient();
  for (const event of events) {
    const { error } = await client.functions.invoke("award-points", {
      body: {
        kind: warehouseAwardKind(event),
        crewMemberId: event.userId,
        dayKey: dayKeyFromRef(event.ref),
        ref: event.ref,
        points: event.points,
        reason: event.reason,
      },
    });
    if (error) throw error;
  }
}

function warehouseAwardKind(event: PointsEvent) {
  if (event.type === "manual_adjust" && event.points < 0 && event.reason.toLowerCase().includes("streak")) return "streak_reversal";
  return event.type;
}

function dayKeyFromRef(ref: string) {
  return ref.includes(":") ? ref.split(":").at(-1) ?? ref : ref;
}

export async function upsertCompletion(userId: string, taskId: string, periodKey: string) {
  const { error } = await requireClient().from("task_completions").upsert({
    user_id: userId,
    task_id: taskId,
    period_key: periodKey,
    completed_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function deleteCompletion(userId: string, taskId: string, periodKey: string) {
  const { error } = await requireClient()
    .from("task_completions")
    .delete()
    .eq("user_id", userId)
    .eq("task_id", taskId)
    .eq("period_key", periodKey);
  if (error) throw error;
}

export async function saveTruckLog(log: Omit<TruckLog, "id" | "ts">, autoTaskIds: string[] = [], pointsEvents: PointsEvent[] = [], streak?: Streak) {
  const { data, error } = await requireClient()
    .from("truck_logs")
    .insert({
      truck_id: log.truckId,
      km: log.km,
      driver_id: log.driverId,
      site_id: log.siteId,
      service_id: log.serviceId,
      oil_checked: log.oilChecked,
      fuel_topped: log.fuelTopped,
      gas_station: log.gasStation ?? null,
      total_cost: log.totalCost ?? null,
      receipt_photo_name: log.receiptPhotoName ?? null,
      exterior_wash: log.exteriorWash ?? false,
      repairs: log.repairs ?? null,
      notes: log.notes ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  if (autoTaskIds.length) {
    const periodKey = new Date().toISOString().slice(0, 10);
    const { error: completionError } = await requireClient().from("task_completions").upsert(autoTaskIds.map((taskId) => ({
      user_id: log.driverId,
      task_id: taskId,
      period_key: periodKey,
      completed_at: new Date().toISOString(),
    })), { onConflict: "user_id,task_id,period_key" });
    if (completionError) throw completionError;
  }
  await persistPoints(pointsEvents, streak);
  return truckLogFromRow(data);
}

export async function upsertTask(task: TruckTask) {
  const { error } = await requireClient().from("truck_tasks").upsert({
    id: isUuid(task.id) ? task.id : undefined,
    text: task.text,
    service_id: task.serviceId,
    freq: task.freq,
    time_of_day: task.timeOfDay ?? null,
    required_for_daily_points: task.requiredForDailyPoints ?? true,
  });
  if (error) throw error;
}

export async function deleteTask(taskId: string) {
  const { error } = await requireClient().from("truck_tasks").delete().eq("id", taskId);
  if (error) throw error;
}

export async function replayCommand(command: OfflineCommand) {
  if (command.type === "log_materials") await insertTransactions(command.transactions);
  if (command.type === "complete_task") {
    await upsertCompletion(command.userId, command.taskId, command.periodKey);
  }
  if (command.type === "truck_log") await saveTruckLog(command.log, command.autoTaskIds, command.pointsEvents ?? [], command.streak);
}

export async function invokeMaterialsImport(file: File) {
  const { data, error } = await requireClient().functions.invoke("materials-import", { body: await file.text() });
  if (error) throw error;
  return data as { imported: number; skipped: Array<{ row: number; reason: string }> };
}

export async function invokeQuickBooksSync() {
  const { data, error } = await requireClient().functions.invoke("quickbooks-sync");
  if (error) throw error;
  return data as { synced: number };
}

export async function invokeQuickBooksConnect() {
  const { data, error } = await requireClient().functions.invoke("quickbooks-oauth", { body: { action: "start" } });
  if (error) throw error;
  return data as { authUrl: string };
}
