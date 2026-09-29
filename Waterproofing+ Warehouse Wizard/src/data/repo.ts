import { supabase } from "../integrations/supabase";
import { todayKey } from "../domain/business";
import type { AppState, DailyLog, DailyLogMedia, MaintenanceRequest, ProjectLoadIn, ProjectLoadInItem, ProjectLoadInMedia, Material, OfflineCommand, PointsEvent, Service, Site, Streak, TaskCompletion, ToolItem, Transaction, Truck, TruckLog, TruckTask, User } from "../types";

function requireClient() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

// Scope "local" ends this app's session only. The default "global" revokes the
// person's Crew+ and SOP+ sessions as well - each app keeps its own session on
// its own origin - and a sibling app then runs on a JWT that PostgREST accepts
// for up to an hour while edge functions, which ask GoTrue whether the session
// still exists, answer 401. That is how a replayed daily log saved its row and
// had its points refused.
export async function signOut() {
  const { error } = await requireClient().auth.signOut({ scope: "local" });
  if (error) throw error;
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
  isTremco: row.is_tremco ?? false,
  serviceIds: Array.isArray(row.service_ids) && row.service_ids.length ? row.service_ids : undefined,
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
  is_tremco: material.isTremco ?? false,
  service_ids: material.serviceIds?.length ? material.serviceIds : null,
});

const txFromRow = (row: any): Transaction => ({
  id: row.id,
  materialId: row.material_id ?? undefined,
  qty: Number(row.qty),
  type: row.type,
  siteId: row.site_id ?? undefined,
  serviceId: row.service_id ?? undefined,
  userId: row.user_id,
  note: row.note ?? undefined,
  ts: row.ts,
  needsReview: row.needs_review ?? false,
  rawItemText: row.raw_item_text ?? undefined,
  rawQtyText: row.raw_qty_text ?? undefined,
  rawUnitText: row.raw_unit_text ?? undefined,
  reviewDismissedAt: row.review_dismissed_at ?? undefined,
});

const txToRow = (tx: Omit<Transaction, "id" | "ts">) => ({
  material_id: tx.materialId ?? null,
  qty: tx.qty,
  type: tx.type,
  site_id: tx.siteId,
  service_id: tx.serviceId,
  user_id: tx.userId,
  note: tx.note ?? null,
  needs_review: tx.needsReview ?? false,
  raw_item_text: tx.rawItemText ?? null,
  raw_qty_text: tx.rawQtyText ?? null,
  raw_unit_text: tx.rawUnitText ?? null,
});

const profileFromRow = (row: any): User => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  orgRole: row.org_role ?? undefined,
  color: row.color,
  points: Number(row.points ?? 0),
  status: row.employment_status ?? undefined,
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
  driveFolderUrl: row.drive_folder_url ?? undefined,
  company: row.company ?? undefined,
  siteContactName: row.site_contact_name ?? undefined,
  siteContactPhone: row.site_contact_phone ?? undefined,
  siteContactEmail: row.site_contact_email ?? undefined,
  startDate: row.start_date ?? undefined,
  endDate: row.end_date ?? undefined,
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
  section: row.section ?? "trucks",
  category: row.category ?? undefined,
  personResponsible: row.person_responsible ?? undefined,
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

/** A uuid column will not take a local id like "u_7" - send null instead. */
const uuidOrNull = (value: string | undefined | null) => (value && isUuid(value) ? value : null);

const dailyLogFromRow = (row: any): DailyLog => ({
  id: row.id,
  siteId: row.site_id,
  serviceId: row.service_id,
  date: row.date,
  materialsInstalled: row.materials_installed ?? undefined,
  weather: row.weather ?? undefined,
  workCompleted: row.work_completed,
  challenges: row.challenges ?? undefined,
  toDoNextTime: row.to_do_next_time,
  completedByUserId: row.completed_by_user_id,
  submittedByUserId: row.submitted_by_user_id,
  createdAt: row.created_at,
});

// A daily log written with no signal is queued with a UUID id and replayed until
// the server takes it. Upserting on that id, ignoring duplicates, means a retry
// after a half-finished attempt does not fail on the primary key and does not
// leave a second copy either.
/**
 * True when the database simply does not have this column or table yet.
 *
 * The app deploys the moment a commit lands, but a migration is run by hand
 * afterwards, so there is always a window where the code knows about a column
 * the database has not got. Writing weather into that window must not throw
 * away the whole daily log.
 */
export function schemaMissing(error: unknown) {
  const code = (error as { code?: string } | null)?.code;
  const message = (error as { message?: string } | null)?.message ?? "";
  return code === "42703" || code === "42P01" || code === "PGRST204" || code === "PGRST205"
    || /column .* does not exist|could not find the .* column|schema cache/i.test(message);
}

export async function insertDailyLog(log: DailyLog) {
  const client = requireClient().from("daily_logs");
  const row = {
    id: isUuid(log.id) ? log.id : undefined,
    site_id: log.siteId,
    service_id: log.serviceId,
    date: log.date,
    materials_installed: log.materialsInstalled ?? null,
    weather: log.weather ?? null,
    work_completed: log.workCompleted,
    challenges: log.challenges ?? null,
    to_do_next_time: log.toDoNextTime,
    completed_by_user_id: log.completedByUserId,
    submitted_by_user_id: log.submittedByUserId,
  };
  const write = (body: Record<string, unknown>) =>
    row.id ? client.upsert(body, { onConflict: "id", ignoreDuplicates: true }) : client.insert(body);

  const { error } = await write(row);
  if (!error) return;
  if (!schemaMissing(error)) throw error;

  // Weather column not added yet - save the log without it rather than lose
  // the crew's whole entry. The note itself is optional by design.
  console.warn("[warehouse] daily_logs.weather is not in the database yet - saving without it.");
  const { weather: _weather, ...withoutWeather } = row;
  const { error: retryError } = await write(withoutWeather);
  if (retryError) throw retryError;
}

/**
 * Clear a needs-review row that was never a material.
 *
 * The Sept 4 import turned free-text work descriptions into needs-review
 * transactions, and Resolve - which demands a real item and a quantity - was
 * the only action on the screen, so those rows could not be cleared at all.
 * The row is kept, not deleted, so the crew's original wording survives.
 */
export async function dismissTransactionReview(transactionId: string, userId: string) {
  try {
    await updateOneTransaction(transactionId, {
      review_dismissed_at: new Date().toISOString(),
      review_dismissed_by: isUuid(userId) ? userId : null,
    }, "Removing this from the review list");
  } catch (error) {
    if (schemaMissing(error)) {
      throw new Error("This needs the database update for dismissing review items. Send Matthew a note and it will work.");
    }
    throw error;
  }
}

async function readCrewPoolPoints() {
  const { data, error } = await requireClient().from("crew_point_pool").select("points").eq("id", "default").maybeSingle().retry(false);
  if (error) throw error;
  return Number(data?.points ?? 0);
}

export async function addToCrewPool(points: number) {
  const current = await readCrewPoolPoints();
  const { error } = await requireClient().from("crew_point_pool").upsert({ id: "default", points: current + points, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// The initial load is read with the client's own retries off. postgrest-js
// retries a GET that fails on the network three times at 1/2/4 s, so with no
// signal every attempt here took 7 s before react-query even saw the failure,
// and react-query's retries then multiplied that into 35 s of "Loading" before
// the last-synced copy could be shown. react-query decides whether to retry
// this load, and it only does so when there is nothing on the device to fall
// back to. Other requests keep the library's retries: they are one-off writes
// and reads where riding out a blip is the right thing.
async function read<T>(table: string, mapper: (row: any) => T, order = "created_at") {
  const { data, error } = await requireClient().from(table).select("*").order(order, { ascending: table === "materials" }).retry(false);
  if (error) throw error;
  return (data ?? []).map(mapper);
}

export async function loadRemoteState(currentUserId: string): Promise<AppState> {
  const [materials, sites, services, users, transactions, tools, trucks, truckLogs, truckTasks, taskCompletions, pointsEvents, streakRows, maintenanceRequests, dailyLogs, dailyLogMedia, loadIns, loadInItems, loadInMedia, crewPoolPoints] =
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
      read("daily_logs", dailyLogFromRow, "date"),
      readDailyLogMedia(),
      readLoadIns(),
      readLoadInItems(),
      readLoadInMedia(),
      readCrewPoolPoints(),
    ]);
  return { materials, sites, services, users, transactions, tools, trucks, truckLogs, truckTasks, taskCompletions, pointsEvents, streaks: streakRows, currentUserId, offlineQueue: [], maintenanceRequests, dailyLogs, dailyLogMedia, loadIns, loadInItems, loadInMedia, crewPoolPoints };
}

export async function insertMaintenanceRequest(request: MaintenanceRequest) {
  const { error } = await requireClient().from("maintenance_request").insert({
    id: isUuid(request.id) ? request.id : undefined,
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

/**
 * `rowIds` makes a replay safe. Stock moves through the transactions_apply_stock
 * trigger, so inserting the same log twice deducts the same material twice. The
 * offline queue survives a restart now, which means a command can come back after
 * the server already accepted it - the app having died in between - so a queued
 * log carries ids generated when it was queued, and a second attempt collides on
 * the primary key and does nothing instead of moving stock again.
 */
export async function insertTransactions(transactions: Omit<Transaction, "id" | "ts">[], rowIds?: string[]) {
  const rows = transactions.map((tx, index) => (rowIds?.[index] ? { ...txToRow(tx), id: rowIds[index] } : txToRow(tx)));
  const { error } = rowIds?.length
    ? await requireClient().from("transactions").upsert(rows, { onConflict: "id", ignoreDuplicates: true })
    : await requireClient().from("transactions").insert(rows);
  if (error) throw error;
}

/**
 * An update that changes no rows is not success.
 *
 * transactions had RLS on with no UPDATE policy, so Postgres matched nothing
 * and PostgREST reported that as a 2xx: Resolve said "Item resolved" and wrote
 * nothing, for three weeks. Asking for the row back turns that silence into a
 * message, so the next policy gap is visible the first time instead of after
 * 140 rows pile up.
 */
async function updateOneTransaction(id: string, patch: Record<string, unknown>, action: string) {
  const { data, error } = await requireClient().from("transactions").update(patch).eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) {
    throw new Error(`${action} did not save. Your account may not have permission to change inventory records - ask an admin.`);
  }
}

export async function updateResolvedTransaction(tx: Transaction) {
  await updateOneTransaction(tx.id, {
    material_id: tx.materialId,
    qty: tx.qty,
    needs_review: false,
    raw_unit_text: tx.rawUnitText ?? null,
  }, "Resolving this item");
}

export async function upsertMaterial(material: Material, includeQty = true) {
  const row = materialToRow(material, includeQty);
  const write = (body: Record<string, unknown>) =>
    requireClient().from("materials").upsert(body, { onConflict: "name" });

  const { error } = await write(row);
  if (!error) return;
  if (!schemaMissing(error)) throw error;

  // service_ids not added yet - save everything else rather than refuse the
  // whole edit. Same deploy-order gap as daily_logs.weather.
  console.warn("[warehouse] materials.service_ids is not in the database yet - saving without it.");
  const { service_ids: _serviceIds, ...withoutServices } = row;
  const { error: retryError } = await write(withoutServices);
  if (retryError) throw retryError;
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
    drive_folder_url: site.driveFolderUrl ?? null,
    company: site.company ?? null,
    site_contact_name: site.siteContactName ?? null,
    site_contact_phone: site.siteContactPhone ?? null,
    site_contact_email: site.siteContactEmail ?? null,
    start_date: site.startDate ?? null,
    end_date: site.endDate ?? null,
  });
  if (error) throw error;
}

export async function updateTool(tool: ToolItem) {
  const { error } = await requireClient().from("tools").upsert(toolToRow(tool));
  if (error) throw error;
}

const MAX_MEDIA_BYTES = 50 * 1024 * 1024;

const dailyLogMediaFromRow = (row: any): DailyLogMedia => ({
  id: row.id,
  dailyLogId: row.daily_log_id,
  storageKey: row.storage_key,
  kind: row.kind === "video" ? "video" : "photo",
  uploadedBy: row.uploaded_by ?? undefined,
  createdAt: row.created_at,
});

/**
 * Photos and clips for the daily logs, or an empty list if the table is not
 * there yet. Same deploy-order guard as the rest of this file: the app ships
 * before the migration is run by hand.
 */
export async function readDailyLogMedia(): Promise<DailyLogMedia[]> {
  const { data, error } = await requireClient()
    .from("daily_log_media").select("*").order("created_at", { ascending: true }).retry(false);
  if (error) {
    if (schemaMissing(error)) {
      console.warn("[warehouse] daily_log_media is not in the database yet - its migration still needs running.");
      return [];
    }
    throw error;
  }
  return (data ?? []).map(dailyLogMediaFromRow);
};

export async function uploadDailyLogMedia(dailyLogId: string, file: File, userId: string): Promise<DailyLogMedia> {
  if (file.size > MAX_MEDIA_BYTES) {
    throw new Error(`${file.name} is ${(file.size / 1024 / 1024).toFixed(0)}MB. The limit is 50MB - take a shorter clip or a photo instead.`);
  }
  const kind: "photo" | "video" = file.type.startsWith("video/") ? "video" : "photo";
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const storageKey = `daily-logs/${dailyLogId}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await requireClient().storage.from("daily-log-media").upload(storageKey, file, {
    cacheControl: "31536000",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (uploadError) throw uploadError;

  const row = { daily_log_id: dailyLogId, storage_key: storageKey, kind, uploaded_by: isUuid(userId) ? userId : null };
  const { data, error } = await requireClient().from("daily_log_media").insert(row).select("*").single();
  if (error) {
    if (schemaMissing(error)) {
      throw new Error("Photos need the database update before they can be attached. The log itself saved fine.");
    }
    throw error;
  }
  return dailyLogMediaFromRow(data);
}

export async function dailyLogMediaSignedUrl(storageKey: string) {
  const { data, error } = await requireClient().storage.from("daily-log-media").createSignedUrl(storageKey, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

const loadInFromRow = (row: any): ProjectLoadIn => ({
  id: row.id,
  siteId: row.site_id,
  serviceId: row.service_id,
  loadInDate: row.load_in_date,
  notes: row.notes ?? undefined,
  assignedTo: row.assigned_to ?? undefined,
  createdBy: row.created_by ?? undefined,
  createdAt: row.created_at,
  submittedAt: row.submitted_at ?? undefined,
  completedAt: row.completed_at ?? undefined,
});

const loadInItemFromRow = (row: any): ProjectLoadInItem => ({
  id: row.id,
  loadInId: row.load_in_id,
  taskId: row.task_id ?? undefined,
  label: row.label,
  section: row.section ?? undefined,
  doneAt: row.done_at ?? undefined,
  doneBy: row.done_by ?? undefined,
});

const loadInMediaFromRow = (row: any): ProjectLoadInMedia => ({
  id: row.id,
  loadInId: row.load_in_id,
  storageKey: row.storage_key,
  kind: row.kind === "pdf" ? "pdf" : "photo",
  uploadedBy: row.uploaded_by ?? undefined,
  createdAt: row.created_at,
});

/** Reads that return an empty list until the load-in migration has been run. */
async function readLoadInTable<T>(table: string, mapper: (row: any) => T, order: string): Promise<T[]> {
  const { data, error } = await requireClient().from(table).select("*").order(order, { ascending: true }).retry(false);
  if (error) {
    if (schemaMissing(error)) {
      console.warn(`[warehouse] ${table} is not in the database yet - its migration still needs running.`);
      return [];
    }
    throw error;
  }
  return (data ?? []).map(mapper);
}

export const readLoadIns = () => readLoadInTable("project_load_in", loadInFromRow, "load_in_date");
export const readLoadInItems = () => readLoadInTable("project_load_in_item", loadInItemFromRow, "id");
export const readLoadInMedia = () => readLoadInTable("project_load_in_media", loadInMediaFromRow, "created_at");

/**
 * The load-in and its items go in together. If the items fail the parent is
 * removed again rather than leaving a crew member an empty list at 6am.
 */
export async function insertLoadIn(loadIn: ProjectLoadIn, items: Array<Pick<ProjectLoadInItem, "taskId" | "label" | "section">>) {
  const client = requireClient();
  const { data, error } = await client.from("project_load_in").insert({
    id: isUuid(loadIn.id) ? loadIn.id : undefined,
    site_id: loadIn.siteId,
    service_id: loadIn.serviceId,
    load_in_date: loadIn.loadInDate,
    notes: loadIn.notes ?? null,
    assigned_to: uuidOrNull(loadIn.assignedTo),
    created_by: uuidOrNull(loadIn.createdBy),
    submitted_at: loadIn.submittedAt ?? null,
  }).select("*").single();
  if (error) {
    if (schemaMissing(error)) throw new Error("Project load-in needs its database update before lists can be saved.");
    throw error;
  }

  if (items.length) {
    const { error: itemError } = await client.from("project_load_in_item").insert(
      items.map((item) => ({
        load_in_id: data.id,
        task_id: uuidOrNull(item.taskId),
        label: item.label,
        section: item.section ?? null,
      })),
    );
    if (itemError) {
      await client.from("project_load_in").delete().eq("id", data.id);
      throw itemError;
    }
  }
  return loadInFromRow(data);
}

export async function setLoadInItemDone(itemId: string, done: boolean, userId: string) {
  const { data, error } = await requireClient().from("project_load_in_item").update({
    done_at: done ? new Date().toISOString() : null,
    done_by: done ? uuidOrNull(userId) : null,
  }).eq("id", itemId).select("id");
  if (error) throw error;
  // Same guard as the transactions update: RLS that matches no rows reports
  // success, and a tick that silently does not save is worse than an error.
  if (!data?.length) throw new Error("That did not save - this load-in may not be assigned to you.");
}

export async function markLoadInComplete(loadInId: string) {
  const { data, error } = await requireClient().from("project_load_in")
    .update({ completed_at: new Date().toISOString() }).eq("id", loadInId).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("That did not save - this load-in may not be assigned to you.");
}

export async function uploadLoadInFile(loadInId: string, file: File, userId: string): Promise<ProjectLoadInMedia> {
  if (file.size > MAX_MEDIA_BYTES) {
    throw new Error(`${file.name} is ${(file.size / 1024 / 1024).toFixed(0)}MB. The limit is 50MB.`);
  }
  const kind: "photo" | "pdf" = file.type === "application/pdf" || /\.pdf$/i.test(file.name) ? "pdf" : "photo";
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const storageKey = `load-ins/${loadInId}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await requireClient().storage.from("project-load-in").upload(storageKey, file, {
    cacheControl: "31536000", upsert: false, contentType: file.type || undefined,
  });
  if (uploadError) throw uploadError;

  const { data, error } = await requireClient().from("project_load_in_media")
    .insert({ load_in_id: loadInId, storage_key: storageKey, kind, uploaded_by: uuidOrNull(userId) })
    .select("*").single();
  if (error) throw error;
  return loadInMediaFromRow(data);
}

export async function loadInFileSignedUrl(storageKey: string) {
  const { data, error } = await requireClient().storage.from("project-load-in").createSignedUrl(storageKey, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function uploadReceiptPhoto(truckId: string, file: File) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const storageKey = `receipts/${truckId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await requireClient().storage.from("warehouse-receipts").upload(storageKey, file, {
    cacheControl: "31536000",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return storageKey;
}

export async function receiptSignedUrl(storageKey: string) {
  const { data, error } = await requireClient().storage.from("warehouse-receipts").createSignedUrl(storageKey, 60 * 60);
  if (error) return "";
  return data.signedUrl;
}

export async function upsertTruck(truck: Truck) {
  const { error } = await requireClient().from("trucks").upsert({
    id: isUuid(truck.id) ? truck.id : undefined,
    name: truck.name,
    km: truck.km,
    last_serviced: truck.lastServiced || null,
    last_oil: truck.lastOil,
  });
  if (error) throw error;
}

/**
 * Turn a functions.invoke failure into an error that says what the server said.
 * A FunctionsHttpError carries the Response as `context`, and award-points always
 * answers with `{ error }` and a status - but the error's own message is the fixed
 * "Edge Function returned a non-2xx status code". That is what reached the toast
 * and the queue's lastError, so a command the server refused sat in "pending
 * sync" with no way to tell a 403 from a 404 from a 500. The status is kept and
 * the body is trimmed: it is the server's own message, not a stack or a token.
 */
/**
 * An edge function answering 401 means GoTrue refused the token, not that the
 * network failed - the function's own getUser() checks the session still exists,
 * which a plain PostgREST call never does. So the app can sit in a half-working
 * state: reads and inserts keep succeeding on the cached JWT while every award
 * fails, for as long as an hour, until the next refresh finally drops to login.
 * That is the state that took two verification passes to pin down.
 *
 * The session is re-checked against the server before acting, so a one-off 401
 * cannot sign anyone out by accident; only a genuinely dead session does.
 */
export async function sessionRejected(error: unknown): Promise<boolean> {
  const status = (error as { context?: { status?: number } } | null)?.context?.status;
  if (status !== 401) return false;
  const client = supabase;
  if (!client) return false;
  const { data, error: userError } = await client.auth.getUser();
  return Boolean(userError) || !data?.user;
}

export async function describeFunctionError(error: unknown): Promise<Error> {
  const context = (error as { context?: { status?: number; clone?: () => { json: () => Promise<unknown> } } } | null)?.context;
  if (context && typeof context.clone === "function") {
    try {
      const body = (await context.clone().json()) as { error?: unknown } | null;
      const message = typeof body?.error === "string" ? body.error.trim().slice(0, 200) : "";
      if (message) return new Error(`award-points ${context.status ?? ""}: ${message}`.replace(/\s+:/, ":"));
    } catch {
      // Not JSON: fall through to the generic message.
    }
  }
  return error instanceof Error ? error : new Error(String(error));
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
    if (error) {
      // A dead session is worth ending cleanly rather than letting every award
      // fail silently behind a token that still passes PostgREST.
      if (await sessionRejected(error)) {
        await signOut().catch(() => undefined);
        throw new Error("Your session ended. Sign in again to save this.");
      }
      throw await describeFunctionError(error);
    }
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
  // Without an explicit conflict target PostgREST resolves against the primary
  // key, and `id` is not in this payload - so the row is inserted fresh and hits
  // the unique(user_id, task_id, period_key) constraint instead of merging. That
  // surfaced as "Task saved locally, it will sync when connection returns" plus a
  // phantom offline-queue entry on a task that was already complete server-side.
  const { error } = await requireClient().from("task_completions").upsert({
    user_id: userId,
    task_id: taskId,
    period_key: periodKey,
    completed_at: new Date().toISOString(),
  }, { onConflict: "user_id,task_id,period_key" });
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

// `rowId` does for a truck log what it does for a material log: the offline queue
// outlives a restart, so a replay of a log the server already stored would
// otherwise file the mileage and fuel cost a second time.
export async function saveTruckLog(log: Omit<TruckLog, "id" | "ts">, autoTaskIds: string[] = [], pointsEvents: PointsEvent[] = [], streak?: Streak, rowId?: string) {
  const { data, error } = await requireClient()
    .from("truck_logs")
    .upsert({
      ...(rowId ? { id: rowId } : {}),
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
    }, { onConflict: "id" })
    .select("*")
    .single();
  if (error) throw error;
  if (autoTaskIds.length) {
    // Everything else keys a daily period off todayKey(), which is Vancouver time.
    // This was the UTC date, and UTC rolls over at 5pm Pacific - which is exactly
    // when a truck log gets submitted - so the tasks it auto-completes were filed
    // under tomorrow, the UI still showed them outstanding, and the 100%-complete
    // points never fired.
    const periodKey = todayKey();
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
    section: task.section,
    category: task.category ?? null,
    person_responsible: task.personResponsible ?? null,
  });
  if (error) throw error;
}

export async function deleteTask(taskId: string) {
  const { error } = await requireClient().from("truck_tasks").delete().eq("id", taskId);
  if (error) throw error;
}

export async function replayCommand(command: OfflineCommand) {
  if (command.type === "log_materials") await insertTransactions(command.transactions, command.rowIds);
  if (command.type === "complete_task") {
    await upsertCompletion(command.userId, command.taskId, command.periodKey);
  }
  if (command.type === "truck_log") await saveTruckLog(command.log, command.autoTaskIds, command.pointsEvents ?? [], command.streak, command.rowId);
  if (command.type === "daily_log") {
    await insertDailyLog(command.log);
    if (command.poolDelta > 0) await addToCrewPool(command.poolDelta);
    else if (command.event) await persistPoints([command.event]);
  }
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
