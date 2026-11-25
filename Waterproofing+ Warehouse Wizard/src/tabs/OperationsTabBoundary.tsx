import { useEffect, useRef, useState } from "react";
import { categoryLabels, services as seedServices } from "../data/seed";
import { dailyLogMediaSignedUrl, receiptSignedUrl, toolPhotoSignedUrl, truckFileSignedUrl, uploadReceiptPhoto, uploadToolPhoto, uploadTruckFile } from "../data/repo";
import { isSupabaseConfigured } from "../integrations/supabase";
import { ALLOWED_MATERIAL_UNITS, batteryState, vehicleServiceDue, canResolveMaintenanceRequests, canSeeEverything, canSeePrices, countedInWarehouse, dailyProgress, formatDate, jobChoices, materialsForService, materialsUsedOnLog, stockedMaterials, inServiceTools, retiredOnly, id, isKmEntryTask, isTaskDone, money, onFleet, roundStep, serviceRequired, stepForMaterialUnit, stockStatus, todayKey, unarchivedJobs } from "../domain/business";
import type { AppState, Category, DailyLog, DailyLogMedia, MaintenanceRequest, MaintenanceTargetType, Material, MaterialUnit, Role, ServiceId, Site, TaskFrequency, TaskSection, ToolCondition, ToolItem, Transaction, Truck, TruckLog, TruckTask, TxType, User, TruckFile } from "../types";
import { BulkToolSheet, canAdmin, canManage, Kpi, Pill, ProgressRing, serviceName, siteName, userName } from "../App";
import type { Tab as AppTab } from "../App";

type Tab = "inventory" | "tremco" | "log" | "tools" | "trucks" | "tasks";

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true" || !isSupabaseConfigured();

function DailyLogMediaLinks({ media }: { media: DailyLogMedia[] }) {
  const [busyId, setBusyId] = useState("");
  const [failedId, setFailedId] = useState("");
  if (!media.length) return null;
  const open = async (item: DailyLogMedia) => {
    setBusyId(item.id);
    setFailedId("");
    try {
      const url = await dailyLogMediaSignedUrl(item.storageKey);
      window.open(url, "_blank", "noopener");
    } catch {
      setFailedId(item.id);
    } finally {
      setBusyId("");
    }
  };
  return <div className="row-action">{media.map((item, index) => (
    <button key={item.id} className="link" disabled={busyId === item.id} onClick={() => open(item)}>
      {busyId === item.id ? "Opening\u2026" : failedId === item.id ? "Could not open" : `${item.kind === "video" ? "Video" : "Photo"} ${index + 1}`}
    </button>
  ))}</div>;
}

/**
 * Booking in a delivery.
 *
 * "receive" already existed as a movement type and already adds to stock, but
 * the only way to pick it was inside the daily log form - which will not
 * submit without a job site, work completed and what to do next time. None of
 * those mean anything for a pallet arriving at the warehouse, so deliveries
 * were not being recorded and the counts drifted upward-blind.
 *
 * The timestamp is the moment it is booked in, so the inventory log shows the
 * date and the time it landed.
 */
function ReceiveStockSheet({ state, userId, submitTransactions, close }: { state: AppState; userId: string; submitTransactions: (txs: Omit<Transaction, "id" | "ts">[], chosenDate?: string) => void; close: () => void }) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [supplier, setSupplier] = useState("");
  const [query, setQuery] = useState("");
  // Receiving stock is a picker too: a retired product must not be orderable
  // back onto the shelf.
  const list = stockedMaterials(state.materials).filter((material) => !query || material.name.toLowerCase().includes(query.toLowerCase()));
  const lines = Object.entries(cart).filter(([, qty]) => qty > 0);
  const totalUnits = lines.reduce((sum, [, qty]) => sum + qty, 0);
  const add = (material: Material, sign = 1) =>
    setCart((current) => ({ ...current, [material.id]: Math.max(0, (current[material.id] ?? 0) + sign * material.step) }));
  const submit = () => {
    if (!lines.length) return;
    submitTransactions(lines.map(([materialId, qty]) => ({
      materialId,
      qty,
      type: "receive" as TxType,
      userId,
      note: supplier.trim() ? `Received from ${supplier.trim()}` : "Received",
    })));
    close();
  };
  return <div>
    <label className="fld">Supplier or PO number</label>
    <input className="in" value={supplier} onChange={(event) => setSupplier(event.target.value)} placeholder="Optional \u2014 e.g. Tremco PO 4412" />
    <div className="search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search what arrived" /></div>
    <section className="card">{list.map((material) => <div className="line-item" key={material.id}>
      <div className="mid"><b>{material.name}</b><div className="tiny muted">{material.qty} {material.unit} on hand</div></div>
      <div className="qtybox">
        <button onClick={() => add(material, -1)}>-</button>
        <input type="number" inputMode="decimal" min="0" step={material.step} value={cart[material.id] ?? 0}
          onChange={(event) => { const next = Number(event.target.value); setCart((current) => ({ ...current, [material.id]: Number.isFinite(next) && next > 0 ? next : 0 })); }}
          aria-label={`Quantity of ${material.name}`} />
        <button onClick={() => add(material, 1)}>+</button>
      </div>
    </div>)}</section>
    <button className="btn good block" disabled={!lines.length} onClick={submit}>
      Book in {totalUnits} {totalUnits === 1 ? "unit" : "units"}
    </button>
    <p className="tiny muted">Recorded against today&rsquo;s date and the current time, and added to the on-hand count.</p>
  </div>;
}

function InventorySegments({ activeTab, setTab }: { activeTab: Tab; setTab: (tab: AppTab) => void }) {
  return <div className="seg inv-segments">
    <button className={activeTab === "log" ? "on" : ""} onClick={() => setTab("log")}>Daily Log</button>
    <button className={activeTab === "inventory" ? "on" : ""} onClick={() => setTab("inventory")}>Materials</button>
    <button className={activeTab === "tremco" ? "on" : ""} onClick={() => setTab("tremco")}>Tremco</button>
  </div>;
}

function ImageFilePicker({ accept, value, onChange }: { accept?: string; value?: string; onChange: (file: File | null) => void }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(file && file.type.startsWith("image/") ? URL.createObjectURL(file) : null);
    onChange(file);
  };
  return <div className="file-picker">
    <input className="in" type="file" accept={accept} onChange={handleChange} />
    {previewUrl ? <img src={previewUrl} alt="Selected file preview" className="file-preview-thumb" /> : value ? <p className="tiny muted">Receipt: {value}</p> : null}
  </div>;
}

export default function OperationsTabBoundary({ activeTab, state, role, currentUser, userId, toggleTask, openSheet, saveMaterial, setExactCount, setTab, submitTransactions, submitDailyLog, saveSite, saveTool, saveTruck, saveTruckRecord, setTruckInventory, addTruckFile, removeTruckFile, saveTask, removeTask, submitMaintenance, respondMaintenance, editMaintenance, editDailyLog, removeDailyLog, retireRecord, focusTarget, onFocusHandled }: {
  activeTab: Tab;
  state: AppState;
  role: Role;
  currentUser: User;
  userId: string;
  toggleTask: (taskId: string) => void;
  openSheet: (sheet: { title: string; content: React.ReactNode } | null) => void;
  saveMaterial: (material: Material, includeQty?: boolean) => void;
  setExactCount: (material: Material, qty: number) => void;
  setTab: (tab: AppTab) => void;
  submitTransactions: (txs: Omit<Transaction, "id" | "ts">[], chosenDate?: string) => void;
  submitDailyLog: (input: Omit<DailyLog, "id" | "createdAt">, files?: File[]) => void;
  saveSite: (site: Site) => void;
  saveTool: (tool: ToolItem, message?: string) => void;
  saveTruck: (log: Omit<TruckLog, "id" | "ts">, chosenDate?: string) => void;
  addTruckFile: (file: TruckFile) => void;
  removeTruckFile: (id: string) => void;
  setTruckInventory: (truckId: string, materialId: string, qty: number) => void;
  saveTruckRecord: (truck: Truck, message?: string) => void;
  saveTask: (task: TruckTask) => void;
  removeTask: (id: string) => void;
  submitMaintenance: (targetType: MaintenanceTargetType, targetId: string, targetLabel: string, description: string, deadlineAt?: string, chosenDate?: string) => void;
  respondMaintenance: (requestId: string, note: string) => void; editMaintenance: (id: string, description: string, deadlineAt?: string) => void;
  editDailyLog: (log: DailyLog) => void;
  removeDailyLog: (logId: string) => void;
  /**
   * Put a product, tool or vehicle away, or bring it back. Left out and the
   * Archive button is simply not offered - the shape the Jobs tab already uses.
   */
  retireRecord?: RetireRecord;
  focusTarget?: string | null;
  onFocusHandled: () => void;
}) {
  if (activeTab === "inventory") return <Inventory state={state} role={role} userId={userId} submitTransactions={submitTransactions} openSheet={openSheet} saveMaterial={saveMaterial} setExactCount={setExactCount} setTab={setTab} retireRecord={retireRecord} focusTarget={focusTarget} onFocusHandled={onFocusHandled} />;
  if (activeTab === "tremco") return <Tremco state={state} role={role} userId={userId} openSheet={openSheet} saveMaterial={saveMaterial} setExactCount={setExactCount} setTab={setTab} submitTransactions={submitTransactions} retireRecord={retireRecord} />;
  if (activeTab === "log") return <LogMaterials state={state} role={role} userId={userId} submitTransactions={submitTransactions} submitDailyLog={submitDailyLog} saveSite={saveSite} setTab={setTab} openSheet={openSheet} editDailyLog={editDailyLog} removeDailyLog={removeDailyLog} />;
  if (activeTab === "tools") return <Tools state={state} role={role} userId={userId} openSheet={openSheet} saveTool={saveTool} retireRecord={retireRecord} />;
  if (activeTab === "trucks") return <FleetSection state={state} role={role} currentUser={currentUser} openSheet={openSheet} saveTruck={saveTruck} saveTruckRecord={saveTruckRecord} setTruckInventory={setTruckInventory} addTruckFile={addTruckFile} removeTruckFile={removeTruckFile} submitMaintenance={submitMaintenance} respondMaintenance={respondMaintenance} editMaintenance={editMaintenance} retireRecord={retireRecord} focusTarget={focusTarget} onFocusHandled={onFocusHandled} />;
  return <Tasks state={state} role={role} currentUser={currentUser} toggleTask={toggleTask} openSheet={openSheet} saveTruck={saveTruck} saveTask={saveTask} removeTask={removeTask} focusTarget={focusTarget} onFocusHandled={onFocusHandled} />;
}

function Chip({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return <button className={`chip ${on ? "on" : ""}`} onClick={onClick}>{children}</button>;
}

function MaterialRow({ material, showPrice = true, onClick }: { material: Material; showPrice?: boolean; onClick?: () => void }) {
  const status = stockStatus(material);
  const pct = Math.max(6, Math.min(100, (material.qty / Math.max(material.reorderPoint * 1.6, 1)) * 100));
  return <div className="inv" onClick={onClick}><div className="ic">{categoryLabels[material.category].slice(0, 2).toUpperCase()}</div><div className="mid"><div className="nm">{material.name}</div><div className="meta">{material.bin} · reorder {material.reorderPoint}{showPrice ? ` · ${money(material.cost)}/${material.unit}` : ` · ${material.unit}`} · {material.pack}</div><div className="bar"><i style={{ width: `${pct}%` }} className={status.key} /></div></div><div className="qtywrap"><div className="qty">{material.qty}</div><Pill tone={status.key}>{status.label}</Pill></div></div>;
}

function TaskRow({ task, done, toggleTask, meta }: { task: { id: string; text: string }; done: boolean; toggleTask: (taskId: string) => void; meta?: string }) {
  return <div className={`task ${done ? "done" : ""}`} onClick={() => toggleTask(task.id)}><span className="cbx"><svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6" fill="none" stroke="currentColor" strokeWidth="3" /></svg></span><span className="tk-txt">{task.text}{meta && <span className="tiny muted"> · {meta}</span>}</span></div>;
}

function NumberField({ label, value, setValue, step = 1 }: { label: string; value: number; setValue: (value: number) => void; step?: number }) {
  return <div><label className="fld">{label}</label><input className="in" type="number" step={step} value={value} onChange={(event) => setValue(Number(event.target.value))} /></div>;
}

function printInventoryLog(state: AppState, list: Material[], label: string) {
  const html = `<!doctype html><html><head><title>Inventory Log</title><style>body{font-family:Arial;padding:28px;color:#132135}.top{display:flex;justify-content:space-between;border-bottom:3px solid #0b6ea8;padding-bottom:14px}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:16px}th,td{border-bottom:1px solid #e2e8f1;padding:8px;text-align:left}</style></head><body><div class="top"><div><h1>Inventory Log</h1><p>Waterproofing+ · ${label} · ${formatDate(new Date())}</p></div></div><table><thead><tr><th>Material</th><th>Category</th><th>Bin</th><th>On hand</th><th>Unit</th><th>Reorder at</th><th>Status</th></tr></thead><tbody>${list.map((material) => `<tr><td>${material.name}</td><td>${categoryLabels[material.category]}</td><td>${material.bin}</td><td>${material.qty}</td><td>${material.unit}</td><td>${material.reorderPoint}</td><td>${stockStatus(material).label}</td></tr>`).join("")}</tbody></table><script>window.onload=function(){setTimeout(function(){window.print()},250)}</script></body></html>`;
  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}

export type RetireRecord = (table: "materials" | "tools" | "trucks", id: string, active: boolean, labels?: { on: string; off: string }) => void;

/**
 * Archive, everywhere it appears. Deleting is deliberately not offered for a
 * product, tool or vehicle: anything with history has to stay on the reports
 * that already counted it, so the only safe answer is to take it out of the
 * lists people pick from. The guide the PM reads says exactly this.
 */
function ArchiveButton({ retired, onToggle, noun }: { retired: boolean; onToggle: () => void; noun: string }) {
  return <div className="archive-action">
    <button className="btn line block" onClick={onToggle}>{retired ? `Bring this ${noun} back` : `Archive this ${noun}`}</button>
    <p className="tiny muted">{retired
      ? "Puts it back on every list people pick from. Nothing in the past changes."
      : "Takes it off every list people pick from and out of the counts. It stays on every past log and report, so nothing already signed off moves. You can bring it back at any time."}</p>
  </div>;
}

function Inventory({ state, role, userId, openSheet, saveMaterial, setExactCount, setTab, submitTransactions, retireRecord, focusTarget, onFocusHandled }: { state: AppState; role: Role; userId: string; submitTransactions: (txs: Omit<Transaction, "id" | "ts">[], chosenDate?: string) => void; openSheet: (sheet: { title: string; content: React.ReactNode } | null) => void; saveMaterial: (material: Material, includeQty?: boolean) => void; setExactCount: (material: Material, qty: number) => void; setTab: (tab: AppTab) => void; retireRecord?: RetireRecord; focusTarget?: string | null; onFocusHandled?: () => void }) {
  const [query, setQuery] = useState("");
  // 168 products is a lot of scrolling; show a screenful until asked.
  const [showAllRows, setShowAllRows] = useState(false);
  const [category, setCategory] = useState<string>(() => (focusTarget === "low-stock" ? "low" : "all"));
  useEffect(() => {
    if (focusTarget === "low-stock") {
      setCategory("low");
      onFocusHandled?.();
    }
  }, [focusTarget]);
  // The Archived chip is the one view that deliberately shows retired rows:
  // without it a product put away could never be found and brought back.
  const pool = category === "archived" ? retiredOnly(state.materials) : stockedMaterials(state.materials);
  const list = pool.filter((material) => !material.isTremco && countedInWarehouse(material) && (category === "all" || category === "archived" || category === material.category || (category === "low" && stockStatus(material).key !== "good")) && (!query || `${material.name} ${material.bin}`.toLowerCase().includes(query.toLowerCase())));
  const archivedCount = retiredOnly(state.materials).filter((material) => !material.isTremco).length;
  const categoryLabel = category === "all" ? "All materials" : category === "low" ? "Reorder list" : category === "archived" ? "Archived products" : categoryLabels[category as Category];
  return <><InventorySegments activeTab="inventory" setTab={setTab} /><div className="inv-actions"><button className="btn line block" onClick={() => printInventoryLog(state, list, categoryLabel)}>Print inventory log</button>{canManage(role) && <button className="btn primary block" onClick={() => openSheet({ title: "Receive stock", content: <ReceiveStockSheet state={state} userId={userId} submitTransactions={submitTransactions} close={() => openSheet(null)} /> })}>Receive stock</button>}{canManage(role) && <button className="btn line block" onClick={() => openSheet({ title: "New material", content: <MaterialForm saveMaterial={saveMaterial} /> })}>Add new material</button>}</div><div className="search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search material or bin" /></div><div className="chips"><Chip on={category === "all"} onClick={() => setCategory("all")}>All {stockedMaterials(state.materials).filter((material) => !material.isTremco).length}</Chip><Chip on={category === "low"} onClick={() => setCategory("low")}>Reorder</Chip>{Object.entries(categoryLabels).map(([key, label]) => <Chip key={key} on={category === key} onClick={() => setCategory(key)}>{label}</Chip>)}{archivedCount > 0 && <Chip on={category === "archived"} onClick={() => setCategory("archived")}>Archived {archivedCount}</Chip>}</div><section className="card inv-card">{(showAllRows ? list : list.slice(0, 25)).map((material) => <MaterialRow key={material.id} material={material} showPrice={canSeePrices(role)} onClick={() => openSheet({ title: material.name, content: <MaterialDetail material={material} role={role} setExactCount={setExactCount} saveMaterial={saveMaterial} retireRecord={retireRecord} /> })} />)}</section>{list.length > 25 && <button className="btn line block" onClick={() => setShowAllRows((value) => !value)}>{showAllRows ? `Show fewer — ${list.length} products` : `Show all ${list.length} products`}</button>}</>;
}

function Tremco({ state, role, userId, openSheet, saveMaterial, setExactCount, setTab, submitTransactions, retireRecord }: { state: AppState; role: Role; userId: string; submitTransactions: (txs: Omit<Transaction, "id" | "ts">[], chosenDate?: string) => void; openSheet: (sheet: { title: string; content: React.ReactNode } | null) => void; saveMaterial: (material: Material, includeQty?: boolean) => void; setExactCount: (material: Material, qty: number) => void; setTab: (tab: AppTab) => void; retireRecord?: RetireRecord }) {
  const [query, setQuery] = useState("");
  const list = stockedMaterials(state.materials).filter((material) => material.isTremco && (!query || `${material.name} ${material.bin}`.toLowerCase().includes(query.toLowerCase())));
  return <><InventorySegments activeTab="tremco" setTab={setTab} /><div className="inv-actions">{canManage(role) && <button className="btn primary block" onClick={() => openSheet({ title: "Receive Tremco stock", content: <ReceiveStockSheet state={state} userId={userId} submitTransactions={submitTransactions} close={() => openSheet(null)} /> })}>Receive stock</button>}{list.length > 0 && <button className="btn line block" onClick={() => printInventoryLog(state, list, "Tremco")}>Export Tremco log for CFO</button>}{canManage(role) && <button className="btn line block" onClick={() => openSheet({ title: "New Tremco item", content: <MaterialForm material={{ id: crypto.randomUUID(), name: "", category: "waterproofing", unit: "Unit", step: 0.25, pack: "", unitsPerPallet: 0, cost: 0, strictTracking: true, qty: 0, reorderPoint: 1, bin: "", isTremco: true }} saveMaterial={saveMaterial} /> })}>Add Tremco item</button>}</div><p className="tiny muted">Highest-value items, billed back to projects. Counted on the 1st of each month; on-hand quantities come from the warehouse count, not the office cross-reference sheet.</p><div className="search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Tremco item or bin" /></div><section className="card inv-card">{list.length ? list.map((material) => <MaterialRow key={material.id} material={material} showPrice={canSeePrices(role)} onClick={() => openSheet({ title: material.name, content: <MaterialDetail material={material} role={role} setExactCount={setExactCount} saveMaterial={saveMaterial} retireRecord={retireRecord} /> })} />) : <p className="tiny muted">No Tremco items flagged yet.</p>}</section></>;
}

function printDailyLogs(state: AppState, list: DailyLog[]) {
  const html = `<!doctype html><html><head><title>Daily Logs</title><style>body{font-family:Arial;padding:28px;color:#132135}.top{border-bottom:3px solid #0b6ea8;padding-bottom:14px}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:16px}th,td{border-bottom:1px solid #e2e8f1;padding:8px;text-align:left;vertical-align:top}</style></head><body><div class="top"><h1>Daily Logs</h1><p>Waterproofing+ · ${formatDate(new Date())}</p></div><table><thead><tr><th>Date</th><th>Job</th><th>Service</th><th>Completed by</th><th>Materials installed</th><th>Work completed</th><th>Weather</th><th>Challenges</th><th>To do next time</th></tr></thead><tbody>${list.map((log) => `<tr><td>${formatDate(log.date)}</td><td>${siteName(state, log.siteId)}</td><td>${serviceName(state, log.serviceId)}</td><td>${userName(state, log.completedByUserId)}</td><td>${log.materialsInstalled ?? ""}</td><td>${log.workCompleted}</td><td>${log.weather ?? ""}</td><td>${log.challenges ?? ""}</td><td>${log.toDoNextTime}</td></tr>`).join("")}</tbody></table><script>window.onload=function(){setTimeout(function(){window.print()},250)}</script></body></html>`;
  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}

/**
 * Every photo and clip from every daily log, in one list.
 *
 * Asked for on 20 November: "is there a way that we can access all pictures
 * that have been submitted through the daily logs in one folder? without
 * having to go through each individual daily log to track down?"
 *
 * Each row names the job and the date it came from, because a wall of photos
 * with no labels is harder to search than the logs were.
 */
export function AllDailyLogPhotos({ state }: { state: AppState }) {
  const byLog = new Map(state.dailyLogs.map((log) => [log.id, log]));
  // Newest first, and a photo whose log has been deleted is not shown rather
  // than rendered as a mystery with no job and no date.
  const items = state.dailyLogMedia
    .filter((item) => byLog.has(item.dailyLogId))
    .sort((a, b) => {
      const left = byLog.get(a.dailyLogId)!;
      const right = byLog.get(b.dailyLogId)!;
      return right.date.localeCompare(left.date);
    });
  if (!items.length) return <p className="tiny muted">No photos have been attached to a daily log yet.</p>;
  return <>
    <p className="tiny muted">{items.length} {items.length === 1 ? "file" : "files"} across {new Set(items.map((item) => item.dailyLogId)).size} logs. Newest first.</p>
    {items.map((item) => {
      const log = byLog.get(item.dailyLogId)!;
      return <div className="line-item" key={item.id}>
        <div className="mid">
          <b>{siteName(state, log.siteId)}</b>
          <div className="tiny muted">{formatDate(log.date)} · {serviceName(state, log.serviceId)} · {userName(state, log.completedByUserId)}</div>
          <DailyLogMediaLinks media={[item]} />
        </div>
      </div>;
    })}
  </>;
}

/** Correcting a log that was filed wrong - fields only, never the points. */
export function DailyLogEditForm({ state, log, editDailyLog, close }: { state: AppState; log: DailyLog; editDailyLog: (log: DailyLog) => void; close: () => void }) {
  const [draft, setDraft] = useState<DailyLog>(log);
  const set = <K extends keyof DailyLog>(key: K, value: DailyLog[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const canSave = Boolean(draft.siteId && draft.workCompleted.trim() && draft.toDoNextTime.trim() && draft.completedByUserId);
  const activeUsers = state.users.filter((item) => item.status !== "Inactive");
  return <>
    {/* Date, job and service are shown but not editable, and that is on
        purpose. The material lines have no foreign key to this log - they are
        found by job, service and date (materialsUsedOnLog) - so changing any
        of the three silently orphans them, and 81 of the 129 logs in
        production have lines attached. The log would then read "no material
        lines were recorded", which is the very complaint this screen was
        built to answer. Moving the lines too is an inventory change and needs
        doing deliberately, not as a side effect of fixing a typo. */}
    <label className="fld">Date, job and service</label>
    <p style={{ margin: "0 0 4px" }}>{formatDate(draft.date)} · {siteName(state, draft.siteId)} · {serviceName(state, draft.serviceId)}</p>
    <p className="tiny muted">These stay fixed. The materials recorded on this log are found by job, service and date, so changing one here would lose them. To move a log to another job or day, delete it and enter it again.</p>
    <label className="fld">Completed by</label>
    <select className="in" value={draft.completedByUserId} onChange={(event) => set("completedByUserId", event.target.value)}>
      {activeUsers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
    <label className="fld">Quantity of materials installed</label>
    <textarea className="in" value={draft.materialsInstalled ?? ""} onChange={(event) => set("materialsInstalled", event.target.value)} />
    <label className="fld">Work completed*</label>
    <textarea className="in" value={draft.workCompleted} onChange={(event) => set("workCompleted", event.target.value)} />
    <label className="fld">Challenges</label>
    <textarea className="in" value={draft.challenges ?? ""} onChange={(event) => set("challenges", event.target.value)} />
    <label className="fld">Weather</label>
    <input className="in" value={draft.weather ?? ""} onChange={(event) => set("weather", event.target.value)} />
    <label className="fld">To do next time*</label>
    <textarea className="in" value={draft.toDoNextTime} onChange={(event) => set("toDoNextTime", event.target.value)} />
    {/* Said out loud because re-tagging the person here does NOT move the 5
        points the original submission awarded. */}
    {draft.completedByUserId !== log.completedByUserId && <p className="tiny muted">Changing who completed this does not move the 5 points the original entry earned. Those stay with {userName(state, log.completedByUserId)}.</p>}
    <button className="btn primary block" disabled={!canSave} onClick={() => { editDailyLog(draft); close(); }}>Save changes</button>
  </>;
}

/**
 * One submitted daily log, in full.
 *
 * The client could see on 20 November that a log existed but not what was in
 * it: the list showed the job, the date, who did it and one line of "work
 * completed", and nothing else - not the materials, not "to do next time",
 * which the crew are required to fill in.
 *
 * Every field the form asks for is shown here, and a field the crew left
 * blank says so rather than disappearing. That distinction is the whole
 * complaint: she could not tell whether he had not written it or the app was
 * not showing it.
 */
export function DailyLogDetail({ state, log, role, editDailyLog, removeDailyLog, openSheet }: { state: AppState; log: DailyLog; role: Role; editDailyLog?: (log: DailyLog) => void; removeDailyLog?: (logId: string) => void; openSheet?: (sheet: { title: string; content: React.ReactNode } | null) => void }) {
  const [confirming, setConfirming] = useState(false);
  const media = state.dailyLogMedia.filter((item) => item.dailyLogId === log.id);
  const lines = materialsUsedOnLog(state.transactions, log);
  const field = (label: string, value?: string) => (
    <div key={label}>
      <label className="fld">{label}</label>
      {value?.trim()
        ? <p style={{ whiteSpace: "pre-wrap", margin: "0 0 4px" }}>{value}</p>
        : <p className="tiny muted" style={{ margin: "0 0 4px" }}>Not entered</p>}
    </div>
  );
  return <>
    <section className="card">
      <div className="tiny muted">{formatDate(log.date)} · {serviceName(state, log.serviceId)}</div>
      <div className="tiny muted">Completed by {userName(state, log.completedByUserId)}{log.submittedByUserId !== log.completedByUserId ? `, submitted by ${userName(state, log.submittedByUserId)}` : ""}</div>
    </section>
    <section className="card">
      <div className="sec-h"><h3>Materials recorded</h3><Pill tone={lines.length ? "neu" : "warn"}>{lines.length}</Pill></div>
      {lines.length
        ? lines.map((tx) => {
            const material = state.materials.find((item) => item.id === tx.materialId);
            return <div className="line-item" key={tx.id}><div className="mid"><b>{material?.name ?? tx.rawItemText ?? "Unnamed item"}</b><div className="tiny muted">{tx.type}{material ? ` · ${material.unit}` : ""}</div></div><div className="qty">{tx.qty}</div></div>;
          })
        : <p className="tiny muted">No material lines were recorded against this log.</p>}
      {canSeeEverything(role) && <p className="tiny muted">Matched to this log by job, service and date.</p>}
    </section>
    <section className="card">
      {field("Quantity of materials installed", log.materialsInstalled)}
      {field("Work completed", log.workCompleted)}
      {field("Challenges", log.challenges)}
      {field("Weather", log.weather)}
      {field("To do next time", log.toDoNextTime)}
    </section>
    <section className="card">
      <div className="sec-h"><h3>Photos &amp; video</h3><Pill tone={media.length ? "neu" : "warn"}>{media.length}</Pill></div>
      {media.length ? <DailyLogMediaLinks media={media} /> : <p className="tiny muted">Nothing attached to this log.</p>}
    </section>
    {canManage(role) && (editDailyLog || (removeDailyLog && canAdmin(role))) && <section className="card">
      {editDailyLog && openSheet && <button className="btn line block" onClick={() => openSheet({ title: `Edit — ${siteName(state, log.siteId)}`, content: <DailyLogEditForm state={state} log={log} editDailyLog={editDailyLog} close={() => openSheet(null)} /> })}>Edit this log</button>}
      {removeDailyLog && canAdmin(role) && !confirming && <button className="btn line block" onClick={() => setConfirming(true)}>Delete this log</button>}
      {/* The photo count is spelled out because deleting the row takes its
          media with it - daily_log_media cascades - and that is not obvious
          from a button that only says Delete. */}
      {removeDailyLog && canAdmin(role) && confirming && <>
        <p className="tiny muted">Deleting removes the entry and takes back the 5 points it earned{media.length ? `, and deletes ${media.length} ${media.length === 1 ? "photo" : "photos"} attached to it` : ""}. This cannot be undone.</p>
        <button className="btn line block" onClick={() => { removeDailyLog(log.id); openSheet?.(null); }}>Yes, delete this log</button>
        <button className="btn line block" onClick={() => setConfirming(false)}>Keep it</button>
      </>}
    </section>}
  </>;
}

function LogMaterials({ state, role, userId, submitTransactions, submitDailyLog, saveSite, setTab, openSheet, editDailyLog, removeDailyLog }: { state: AppState; role: Role; userId: string; openSheet: (sheet: { title: string; content: React.ReactNode } | null) => void; editDailyLog: (log: DailyLog) => void; removeDailyLog: (logId: string) => void; submitTransactions: (txs: Omit<Transaction, "id" | "ts">[], chosenDate?: string) => void; submitDailyLog: (input: Omit<DailyLog, "id" | "createdAt">, files?: File[]) => void; saveSite: (site: Site) => void; setTab: (tab: AppTab) => void }) {
  const [siteId, setSiteId] = useState(unarchivedJobs(state.sites)[0]?.id);
  const [serviceId, setServiceId] = useState<ServiceId>("wp");
  const [type, setType] = useState<TxType>("use");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [newSite, setNewSite] = useState("");
  const [logDate, setLogDate] = useState(todayKey());
  const activeUsers = state.users.filter((item) => item.status !== "Inactive");
  const [completedByUserId, setCompletedByUserId] = useState(userId);
  const [materialsInstalled, setMaterialsInstalled] = useState("");
  const [workCompleted, setWorkCompleted] = useState("");
  const [challenges, setChallenges] = useState("");
  const [weather, setWeather] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [toDoNextTime, setToDoNextTime] = useState("");
  const [showAllMaterials, setShowAllMaterials] = useState(false);
  // Alphabetical, because this list is 121 items long and the order the
  // database hands back is meaningless to someone hunting for one tube.
  const trackedMaterials = stockedMaterials(state.materials)
    .filter(countedInWarehouse)
    .sort((a, b) => a.name.localeCompare(b.name));
  // Narrowed to the service they picked, so a waterproofing crew is not
  // scrolling past insulation and traffic coatings to find their own items.
  const forService = materialsForService(trackedMaterials, serviceId);
  const hiddenByService = trackedMaterials.length - forService.length;
  const visibleMaterials = showAllMaterials ? trackedMaterials : forService;
  const materials = visibleMaterials.filter((material) => !query || material.name.toLowerCase().includes(query.toLowerCase()));
  const total = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  const [logMonth, setLogMonth] = useState("");
  const sortedLogs = [...state.dailyLogs].sort((a, b) => b.date.localeCompare(a.date));
  const recentLogs = canManage(role)
    ? sortedLogs.filter((log) => !logMonth || log.date.slice(0, 7) === logMonth).slice(0, 50)
    : sortedLogs.filter((log) => log.submittedByUserId === userId).slice(0, 5);
  const selectedSite = state.sites.find((item) => item.id === siteId);
  const sortedSites = jobChoices(state.sites, siteId).sort((a, b) => a.name.localeCompare(b.name));
  const canSubmit = serviceRequired(siteId, serviceId) && total > 0 && workCompleted.trim() && toDoNextTime.trim() && completedByUserId;
  // A disabled Submit says nothing on a phone - there is no cursor to go
  // not-allowed - so name what is still missing rather than leaving the crew
  // tapping a button that never responds.
  const missingForSubmit = [
    !serviceRequired(siteId, serviceId) && "a service",
    total <= 0 && "at least one material",
    !workCompleted.trim() && "Work completed",
    !toDoNextTime.trim() && "To do next time",
    !completedByUserId && "who completed it",
  ].filter((item): item is string => Boolean(item));
  const add = (material: Material, sign = 1) => setCart((current) => ({ ...current, [material.id]: Math.max(0, (current[material.id] ?? 0) + sign * material.step) }));
  const submit = () => {
    if (!canSubmit || !siteId) return;
    submitTransactions(Object.entries(cart).filter(([, qty]) => qty > 0).map(([materialId, qty]) => ({ materialId, qty, type, siteId, serviceId, userId })), logDate);
    submitDailyLog({ siteId, serviceId, date: logDate, materialsInstalled: materialsInstalled.trim() || undefined, workCompleted: workCompleted.trim(), challenges: challenges.trim() || undefined, weather: weather.trim() || undefined, toDoNextTime: toDoNextTime.trim(), completedByUserId, submittedByUserId: userId }, photos);
    setCart({});
    setMaterialsInstalled("");
    setWorkCompleted("");
    setChallenges("");
    setWeather("");
    setPhotos([]);
    setToDoNextTime("");
  };
  const addSite = () => {
    if (!newSite.trim()) return;
    const site = { id: crypto.randomUUID(), name: newSite.trim(), address: "", source: "manual" as const };
    saveSite(site);
    setSiteId(site.id);
    setNewSite("");
  };
  const historySection = <section className="card" id="wz-daily-log-history"><div className="sec-h"><h3>{canManage(role) ? "All daily logs" : "Your recent daily logs"}</h3><div className="row-action">{state.dailyLogMedia.length > 0 && <button className="link" onClick={() => openSheet({ title: "All daily log photos", content: <AllDailyLogPhotos state={state} /> })}>All photos ({state.dailyLogMedia.length})</button>}{recentLogs.length > 0 && <button className="link" onClick={() => printDailyLogs(state, recentLogs)}>Export</button>}</div></div>{canManage(role) && <><label className="fld">{logMonth ? "Month" : "Month (showing all)"}</label><input className="in" type="month" value={logMonth} onChange={(event) => setLogMonth(event.target.value)} /></>}{recentLogs.length ? recentLogs.map((log) => <div className="line-item" key={log.id} style={{ cursor: "pointer" }} onClick={() => openSheet({ title: siteName(state, log.siteId), content: <DailyLogDetail state={state} log={log} role={role} editDailyLog={editDailyLog} removeDailyLog={removeDailyLog} openSheet={openSheet} /> })}><div className="mid"><b>{siteName(state, log.siteId)}</b><div className="tiny muted">{formatDate(log.date)} · {serviceName(state, log.serviceId)} · {userName(state, log.completedByUserId)}</div><div className="tiny muted">{log.workCompleted}</div><DailyLogMediaLinks media={state.dailyLogMedia.filter((item) => item.dailyLogId === log.id)} /></div><button className="btn line sm" onClick={(event) => { event.stopPropagation(); openSheet({ title: siteName(state, log.siteId), content: <DailyLogDetail state={state} log={log} role={role} editDailyLog={editDailyLog} removeDailyLog={removeDailyLog} openSheet={openSheet} /> }); }}>Open</button></div>) : <p className="tiny muted">{logMonth ? "Nothing logged for this month." : "No daily logs yet."}</p>}</section>;
  const entryForm = <>
    <section className="card"><label className="fld">Date</label><input className="in" type="date" value={logDate} max={todayKey()} onChange={(event) => setLogDate(event.target.value)} /><label className="fld">Job site</label><select className="in" value={siteId ?? ""} onChange={(event) => setSiteId(event.target.value)}>{!siteId && <option value="">Choose a job site</option>}{sortedSites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select><div className="row-action"><input className="in" value={newSite} onChange={(event) => setNewSite(event.target.value)} placeholder="+ Add job site" /><button className="btn line sm" onClick={addSite}>Add</button></div>{selectedSite?.driveFolderUrl && <a className="tiny" href={selectedSite.driveFolderUrl} target="_blank" rel="noreferrer">Job details / site plans →</a>}<label className="fld">Service</label><div className="selrow">{[...state.services].sort((a, b) => a.name.localeCompare(b.name)).map((service) => <button key={service.id} className={`sopt ${serviceId === service.id ? "on" : ""}`} onClick={() => setServiceId(service.id)}>{service.name}</button>)}</div></section>
    <section className="card"><h3>Daily log</h3><label className="fld">Quantity of materials installed</label><textarea className="in" value={materialsInstalled} onChange={(event) => setMaterialsInstalled(event.target.value)} placeholder="Square feet / linear feet, optional" /><label className="fld">Work completed*</label><textarea className="in" value={workCompleted} onChange={(event) => setWorkCompleted(event.target.value)} /><label className="fld">Challenges</label><textarea className="in" value={challenges} onChange={(event) => setChallenges(event.target.value)} placeholder="Optional" /><label className="fld">Weather</label><input className="in" value={weather} onChange={(event) => setWeather(event.target.value)} placeholder="Optional — e.g. rain all afternoon" /><label className="fld">To do next time*</label><textarea className="in" value={toDoNextTime} onChange={(event) => setToDoNextTime(event.target.value)} /><label className="fld">Completed by</label><select className="in" value={completedByUserId} onChange={(event) => setCompletedByUserId(event.target.value)}>{activeUsers.map((item) => <option key={item.id} value={item.id}>{item.name}{item.orgRole ? ` — ${item.orgRole}` : ""}</option>)}</select><label className="fld">Photos &amp; video</label><div className="file-picker"><input className="in" type="file" accept="image/*,video/*" multiple onChange={(event) => { setPhotos((current) => [...current, ...Array.from(event.target.files ?? [])]); event.target.value = ""; }} /><p className="tiny muted">Optional. Add as many as you like, up to 50MB each. They upload after you submit — stay on this screen until the banner at the top clears, or they will not be attached.</p>{photos.map((file, index) => <div className="line-item" key={`${file.name}-${index}`}><div className="mid"><b>{file.name}</b><div className="tiny muted">{(file.size / 1024 / 1024).toFixed(1)} MB</div></div><button className="btn line sm" onClick={() => setPhotos((current) => current.filter((_, i) => i !== index))}>Remove</button></div>)}</div></section>
    <div className="seg">{(["use", "deliver", "return", "receive", "loss"] as TxType[]).map((item) => <button key={item} className={type === item ? "on" : ""} onClick={() => setType(item)}>{item}</button>)}</div>
    <div className="search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search materials to add" /></div>
    {hiddenByService > 0 && <p className="tiny muted">{showAllMaterials
      ? <>Showing all {trackedMaterials.length} materials. <button type="button" className="link" onClick={() => setShowAllMaterials(false)}>Just {serviceName(state, serviceId)}</button></>
      : <>Showing the {forService.length} used for {serviceName(state, serviceId)}. <button type="button" className="link" onClick={() => setShowAllMaterials(true)}>Show all {trackedMaterials.length}</button></>}</p>}<section className="card">{materials.map((material) => <div className="line-item" key={material.id}><div className="mid"><b>{material.name}</b><div className="tiny muted">{material.qty} {material.unit} on hand · locked unit</div></div><div className="qtybox"><button onClick={() => add(material, -1)}>-</button><input type="number" inputMode="decimal" min="0" step={material.step} value={cart[material.id] ?? 0} onChange={(event) => { const next = Number(event.target.value); setCart((current) => ({ ...current, [material.id]: Number.isFinite(next) && next > 0 ? next : 0 })); }} aria-label={`Quantity of ${material.name}`} /><button onClick={() => add(material, 1)}>+</button></div>{cart[material.id] > 0 && <button className="btn line sm" onClick={() => setCart((current) => ({ ...current, [material.id]: 0 }))}>Remove</button>}</div>)}</section>
    {total > 0 && (
      <div className="cart-summary">
        <div className="cart-summary-info">
          <span className="cart-summary-count">{Object.values(cart).filter(q => q > 0).length} items</span>
          <span className="cart-summary-sep">·</span>
          <span className="cart-summary-units">{total} units</span>
          <span className="cart-summary-sep">·</span>
          <span className="cart-summary-type">{type}</span>
        </div>
        <button className="cart-clear-btn" onClick={() => setCart({})}>Clear</button>
      </div>
    )}
    <button className="btn good block" disabled={!canSubmit} onClick={submit}>Submit daily log ({total} {total === 1 ? "unit" : "units"})</button>
    {!canSubmit && missingForSubmit.length > 0 && <p className="tiny muted">Still needed: {missingForSubmit.join(", ")}.</p>}
  </>;
  return <><InventorySegments activeTab="log" setTab={setTab} />{canManage(role) && <a className="tiny muted" href="#wz-daily-log-history">Jump to all daily logs ↓</a>}{entryForm}{historySection}</>;
}

function Tools({ state, role, userId, openSheet, saveTool, retireRecord }: { state: AppState; role: Role; userId: string; openSheet: (sheet: { title: string; content: React.ReactNode } | null) => void; saveTool: (tool: ToolItem, message?: string) => void; retireRecord?: RetireRecord }) {
  const [filter, setFilter] = useState<ServiceId | "all" | "charge" | "archived">("all");
  // `ToolItem.active` was on the row and nothing read it, so a tool sold or
  // written off stayed on the list people check out from. Same shape as jobs,
  // trucks and products before it.
  const onHand = inServiceTools(state.tools);
  const archivedTools = retiredOnly(state.tools);
  const list = (filter === "archived" ? archivedTools : onHand).filter((tool) => {
    if (filter === "charge") return tool.battery && batteryState(tool.lastCharged).key === "bad";
    if (filter === "all" || filter === "archived") return true;
    return tool.serviceId === filter;
  });
  return <><div className="kpis"><Kpi label="Checked out" value={onHand.filter((tool) => tool.status === "out").length} sub={`of ${onHand.length}`} /><Kpi label="Repair flags" value={onHand.filter((tool) => tool.condition !== "good").length} sub="needs manager review" /></div><button className="btn primary block" onClick={() => openSheet({ title: "Check tools for job", content: <BulkToolSheet state={state} userId={userId} saveTool={saveTool} /> })}>Check out tools</button><div className="chips"><Chip on={filter === "all"} onClick={() => setFilter("all")}>All</Chip><Chip on={filter === "charge"} onClick={() => setFilter("charge")}>🔋 Charge due {onHand.filter(t => t.battery && batteryState(t.lastCharged).key === "bad").length > 0 ? `(${onHand.filter(t => t.battery && batteryState(t.lastCharged).key === "bad").length})` : ""}</Chip>{state.services.map((service) => <Chip key={service.id} on={filter === service.id} onClick={() => setFilter(service.id)}>{service.name}</Chip>)}{archivedTools.length > 0 && <Chip on={filter === "archived"} onClick={() => setFilter("archived")}>Archived {archivedTools.length}</Chip>}</div><section className="card">{list.map((tool) => { const charge = tool.battery ? batteryState(tool.lastCharged) : null; return <div className="tool-row" key={tool.id} onClick={() => openSheet({ title: tool.name, content: <ToolSheet state={state} role={role} userId={userId} tool={tool} saveTool={saveTool} retireRecord={retireRecord} /> })}><div><b>{tool.name}</b><div className="tiny muted">{serviceName(state, tool.serviceId)} {tool.status === "out" ? `- out with ${userName(state, tool.outBy)} - ${siteName(state, tool.outJob)}` : "- in warehouse"}</div></div><div className="tool-actions"><Pill tone={tool.status === "out" ? "warn" : "good"}>{tool.status}</Pill><Pill tone={tool.condition === "good" ? "good" : "bad"}>{tool.condition}</Pill>{charge && <Pill tone={charge.key}>{charge.label}</Pill>}</div></div>; })}</section>{canManage(role) && <button className="btn line block" onClick={() => openSheet({ title: "New tool", content: <ToolForm state={state} saveTool={saveTool} /> })}>Add new tool</button>}</>;
}

/**
 * A tool photo already uploaded, fetched through a signed URL.
 *
 * The bucket is private, so there is no permanent address to put in an <img>;
 * the link is minted on view and expires. A failure shows the slot as empty
 * rather than a broken image, because a broken image looks like a bug in the
 * tool rather than a photo that would not load.
 */
function ToolPhotoPreview({ storageKey, alt }: { storageKey: string; alt: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let live = true;
    toolPhotoSignedUrl(storageKey).then((signed) => { if (live) setUrl(signed); }).catch(() => undefined);
    return () => { live = false; };
  }, [storageKey]);
  return url ? <img src={url} alt={alt} className="file-preview-thumb" /> : <p className="tiny muted">Photo on file.</p>;
}

/**
 * Two photos per tool: the tool, and where it lives.
 *
 * Uploading happens on pick rather than on save, so a slow photo over site
 * wifi does not hold up the rest of the form, and a failed upload says so
 * instead of silently dropping the picture.
 */
function ToolPhotoFields({ tool, onChange }: { tool: ToolItem; onChange: (patch: Partial<ToolItem>) => void }) {
  const [busy, setBusy] = useState<"" | "photoKey" | "locationPhotoKey">("");
  const [failed, setFailed] = useState("");
  const pick = async (field: "photoKey" | "locationPhotoKey", file: File | null) => {
    if (!file) return onChange({ [field]: undefined });
    if (DEMO_MODE) return onChange({ [field]: file.name });
    setBusy(field);
    setFailed("");
    try {
      onChange({ [field]: await uploadToolPhoto(tool.id, file) });
    } catch (error) {
      setFailed(error instanceof Error ? error.message : "That photo did not upload.");
    } finally {
      setBusy("");
    }
  };
  const slot = (field: "photoKey" | "locationPhotoKey", label: string, hint: string) => <>
    <label className="fld">{label}</label>
    <p className="tiny muted">{hint}</p>
    <ImageFilePicker accept="image/*" onChange={(file) => void pick(field, file)} />
    {busy === field && <p className="tiny muted">Uploading&hellip;</p>}
    {tool[field] && busy !== field && <ToolPhotoPreview storageKey={tool[field] as string} alt={label} />}
    {tool[field] && <button className="btn line sm" onClick={() => onChange({ [field]: undefined })}>Remove photo</button>}
  </>;
  return <>
    {slot("photoKey", "Photo of the tool", "A close-up, so it is recognisable on the shelf.")}
    {slot("locationPhotoKey", "Warehouse location", "A wider shot showing where it lives, so someone can go and find it.")}
    {failed && <p className="tiny error">{failed}</p>}
  </>;
}

function ToolForm({ state, tool, saveTool }: { state: AppState; tool?: ToolItem; saveTool: (tool: ToolItem, message?: string) => void }) {
  const [draft, setDraft] = useState<ToolItem>(tool ?? { id: crypto.randomUUID(), name: "", serviceId: "veh", battery: false, status: "in", condition: "good" });
  const set = <K extends keyof ToolItem>(key: K, value: ToolItem[K]) => setDraft((current) => ({ ...current, [key]: value }));
  return <div className="form-stack">
    <label className="fld">Tool name</label>
    <input className="in" value={draft.name} onChange={(event) => set("name", event.target.value)} />
    <label className="fld">Service</label>
    <select className="in" value={draft.serviceId} onChange={(event) => set("serviceId", event.target.value as ServiceId)}>{state.services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select>
    <label className="check"><input type="checkbox" checked={draft.extraPowerBox ?? false} onChange={(event) => set("extraPowerBox", event.target.checked)} /> Has an extra power box</label><p className="tiny muted">Every tool is cordless, so charge is tracked on all of them. Tick this only if a spare battery pack travels with it.</p>
    <ToolPhotoFields tool={draft} onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))} />
    <button className="btn primary block" disabled={!draft.name.trim()} onClick={() => saveTool(draft, tool ? "Tool updated" : "Tool added")}>Save tool</button>
  </div>;
}

/**
 * The checklists: truck, warehouse and job-site. The fleet used to live under
 * here too and now has its own tab - see FleetSection for why.
 */
function Tasks({ state, role, currentUser, toggleTask, openSheet, saveTruck, saveTask, removeTask, focusTarget, onFocusHandled }: { state: AppState; role: Role; currentUser: User; toggleTask: (taskId: string) => void; openSheet: (sheet: { title: string; content: React.ReactNode } | null) => void; saveTruck: (log: Omit<TruckLog, "id" | "ts">, chosenDate?: string) => void; saveTask: (task: TruckTask) => void; removeTask: (id: string) => void; focusTarget?: string | null; onFocusHandled?: () => void }) {
  const [section, setSection] = useState<TaskSection>("trucks");
  return <>
    <div className="seg inv-segments">
      <button className={section === "trucks" ? "on" : ""} onClick={() => setSection("trucks")}>Trucks</button>
      <button className={section === "warehouse" ? "on" : ""} onClick={() => setSection("warehouse")}>Warehouse</button>
      <button className={section === "services" ? "on" : ""} onClick={() => setSection("services")}>Services</button>
    </div>
    {section === "trucks" && <TruckTasksSection state={state} role={role} currentUser={currentUser} toggleTask={toggleTask} openSheet={openSheet} saveTruck={saveTruck} saveTask={saveTask} removeTask={removeTask} focusTarget={focusTarget} onFocusHandled={onFocusHandled} />}
    {section === "warehouse" && <WarehouseTasksSection state={state} role={role} toggleTask={toggleTask} openSheet={openSheet} saveTask={saveTask} removeTask={removeTask} />}
    {section === "services" && <ServicesTasksSection state={state} role={role} toggleTask={toggleTask} openSheet={openSheet} saveTask={saveTask} removeTask={removeTask} />}
  </>;
}

/**
 * The vehicles, on their own tab. The client asked for "a separate section
 * just for trucks" twice, and reported on 19 November that Trucks was missing
 * from the admin login altogether.
 *
 * It was not missing and it was not a permission: the fleet rendered at the
 * bottom of the tab labelled "Tasks", below a progress ring, a six-way
 * frequency switcher, a "mark all done" button and up to 32 task checkboxes.
 * On a phone nobody scrolls that far looking for a truck. The checklists kept
 * the Tasks tab; the fleet, its on-board inventory, the gas-station check and
 * maintenance live here, where someone looking for a truck will find them.
 */
function FleetSection({ state, role, currentUser, openSheet, saveTruck, saveTruckRecord, setTruckInventory, addTruckFile, removeTruckFile, submitMaintenance, respondMaintenance, editMaintenance, retireRecord, focusTarget, onFocusHandled }: { state: AppState; role: Role; currentUser: User; openSheet: (sheet: { title: string; content: React.ReactNode } | null) => void; saveTruck: (log: Omit<TruckLog, "id" | "ts">, chosenDate?: string) => void; addTruckFile: (file: TruckFile) => void;
  removeTruckFile: (id: string) => void;
  setTruckInventory: (truckId: string, materialId: string, qty: number) => void;
  saveTruckRecord: (truck: Truck, message?: string) => void; submitMaintenance: (targetType: MaintenanceTargetType, targetId: string, targetLabel: string, description: string, deadlineAt?: string, chosenDate?: string) => void; respondMaintenance: (requestId: string, note: string) => void; editMaintenance: (id: string, description: string, deadlineAt?: string) => void; retireRecord?: RetireRecord; focusTarget?: string | null; onFocusHandled?: () => void }) {
  const canResolve = canResolveMaintenanceRequests(currentUser);
  const openRequests = state.maintenanceRequests.filter((item) => item.status === "open");
  const resolvedRequests = state.maintenanceRequests.filter((item) => item.status === "resolved");
  // The company car is on the fleet sheet but marked "show to crew: N", so it
  // stays out of the list the crew books trucks from.
  // A retired vehicle is off the list too - see onFleet.
  const current = onFleet(state.trucks);
  const fleet = canSeeEverything(role) ? current : current.filter((truck) => truck.showToCrew !== false);

  useEffect(() => {
    if (focusTarget !== "maintenance") return;
    requestAnimationFrame(() => document.getElementById("wz-section-maintenance")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    onFocusHandled?.();
  }, [focusTarget]);

  return <>
    <section className="card"><button className="btn primary block" onClick={() => openSheet({ title: "Gas Station Check", content: <TruckLogForm state={state} saveTruck={saveTruck} /> })}>Gas Station Check</button></section>
    {fleet.length > 0 ? (
      <section className="card">
        <div className="sec-h"><h2>Fleet</h2>{canManage(role) && <button className="link" onClick={() => openSheet({ title: "Add truck", content: <TruckForm state={state} saveTruckRecord={saveTruckRecord} /> })}>Add truck</button>}</div>
        <div className="truck-list">
          {fleet.map(truck => {
            const lastLog = state.truckLogs.filter(l => l.truckId === truck.id).sort((a, b) => b.ts.localeCompare(a.ts))[0];
            /* Managers edit the vehicle; Finance opens the same card read-only;
               the crew taps through to nothing, because the registration and
               insurance numbers are not theirs to carry around. */
            const open = canManage(role)
              ? () => openSheet({ title: truck.name, content: <><TruckForm state={state} truck={truck} saveTruckRecord={saveTruckRecord} /><TruckFiles state={state} role={role} truck={truck} userId={currentUser.id} onUploaded={addTruckFile} onDeleted={removeTruckFile} /></> })
              : canSeeEverything(role)
                ? () => openSheet({ title: truck.name, content: <VehicleDetails truck={truck} /> })
                : undefined;
            return (
              <div className="truck-item" key={truck.id} onClick={open} style={open ? { cursor: "pointer" } : undefined}>
                <div className="truck-icon">🚛</div>
                <div className="mid">
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{truck.name}</div>
                  <div className="tiny muted">{truck.km ? `${truck.km.toLocaleString()} km` : "No mileage yet"} · last service {formatServiceDate(truck.lastServiced)}</div>
                  {vehicleServiceDue(truck).due && <div className="tiny" style={{ color: "#A82727", fontWeight: 600 }}>{vehicleServiceDue(truck).reasons.join(" · ")}</div>}
                </div>
                {lastLog && <div className="tiny muted">{formatDate(lastLog.ts)}</div>}
                {/* Every vehicle carries its own list; the crew check the truck
                    against it before leaving the yard. */}
                <button className="btn line sm" onClick={(event) => { event.stopPropagation(); openSheet({ title: `${truck.name} — on board`, content: <TruckInventorySheet state={state} role={role} truck={truck} setTruckInventory={setTruckInventory} /> }); }}>
                  Inventory ({state.truckInventory.filter((line) => line.truckId === truck.id).length})
                </button>
                {canManage(role) && retireRecord && <button className="btn line sm" onClick={(event) => { event.stopPropagation(); retireRecord("trucks", truck.id, false, { on: "Vehicle brought back", off: "Vehicle archived" }); }}>Archive</button>}
              </div>
            );
          })}
        </div>
      </section>
    ) : (
      <section className="card"><div className="sec-h"><h2>Fleet</h2>{canManage(role) && <button className="link" onClick={() => openSheet({ title: "Add truck", content: <TruckForm state={state} saveTruckRecord={saveTruckRecord} /> })}>Add truck</button>}</div><p className="tiny muted">No vehicles on the fleet list yet.</p></section>
    )}
    {/* An archived vehicle leaves the fleet list, so this is the only place it
        can be found and brought back. Managers only: the crew have no use for
        a vehicle that is gone. */}
    {canManage(role) && retireRecord && retiredOnly(state.trucks).length > 0 && (
      <section className="card">
        <div className="sec-h"><h2>Archived vehicles</h2><span className="tiny muted">{retiredOnly(state.trucks).length}</span></div>
        <p className="tiny muted">Off the fleet list and out of the checklists. Still on every past gas check and log.</p>
        {retiredOnly(state.trucks).map((truck) => (
          <div className="line-item" key={truck.id}>
            <div className="mid"><b>{truck.name}</b><div className="tiny muted">{truck.km ? `${truck.km.toLocaleString()} km` : "No mileage recorded"}</div></div>
            <button className="btn line sm" onClick={() => retireRecord("trucks", truck.id, true, { on: "Vehicle brought back", off: "Vehicle archived" })}>Bring back</button>
          </div>
        ))}
      </section>
    )}
    <section className="card" id="wz-section-maintenance"><div className="sec-h"><h2>Maintenance requests</h2><Pill tone={openRequests.length ? "warn" : "good"}>{openRequests.length} open</Pill></div><button className="btn line block" onClick={() => openSheet({ title: "Request maintenance", content: <MaintenanceRequestForm state={state} submitMaintenance={submitMaintenance} /> })}>Request maintenance</button>{openRequests.length ? openRequests.map((item) => <MaintenanceRequestRow key={item.id} request={item} state={state} canResolve={canResolve} respondMaintenance={respondMaintenance} editMaintenance={editMaintenance} />) : <p className="tiny muted">No open maintenance requests.</p>}{resolvedRequests.length > 0 && <details><summary className="tiny muted">{resolvedRequests.length} resolved</summary>{resolvedRequests.map((item) => <MaintenanceRequestRow key={item.id} request={item} state={state} canResolve={false} respondMaintenance={respondMaintenance} editMaintenance={editMaintenance} />)}</details>}</section>
  </>;
}

/** The truck checklist, one of the three sections on the Tasks tab. */
function TruckTasksSection({ state, role, currentUser, toggleTask, openSheet, saveTruck, saveTask, removeTask, focusTarget, onFocusHandled }: { state: AppState; role: Role; currentUser: User; toggleTask: (taskId: string) => void; openSheet: (sheet: { title: string; content: React.ReactNode } | null) => void; saveTruck: (log: Omit<TruckLog, "id" | "ts">, chosenDate?: string) => void; saveTask: (task: TruckTask) => void; removeTask: (id: string) => void; focusTarget?: string | null; onFocusHandled?: () => void }) {
  const [freq, setFreq] = useState<TaskFrequency>("daily");
  const progress = dailyProgress(state.truckTasks, state.taskCompletions, state.currentUserId);
  const visibleTasks = state.truckTasks.filter((task) => task.section === "trucks" && task.freq === freq);

  useEffect(() => {
    if (focusTarget !== "tasks") return;
    requestAnimationFrame(() => document.getElementById("wz-section-tasks")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    onFocusHandled?.();
  }, [focusTarget]);

  const allShownDone = visibleTasks.length > 0 && visibleTasks.every((task) => isTaskDone(state.taskCompletions, state.currentUserId, task));
  const markAllShown = () => visibleTasks.filter((task) => !isTaskDone(state.taskCompletions, state.currentUserId, task)).forEach((task) => toggleTask(task.id));

  const startTasks = visibleTasks.filter((task) => task.timeOfDay === "start");
  const endTasks = visibleTasks.filter((task) => task.timeOfDay === "end");
  const otherTasks = visibleTasks.filter((task) => !task.timeOfDay);

  return <>
    <section className="card"><ProgressRing pct={progress.pct} /></section>
    <div className="seg">{(["daily", "weekly", "monthly", "quarterly", "yearly", "as_needed"] as TaskFrequency[]).map((item) => <button key={item} className={freq === item ? "on" : ""} onClick={() => setFreq(item)}>{item}</button>)}</div>
    <button className="btn line block" disabled={visibleTasks.length === 0 || allShownDone} onClick={markAllShown}>Mark all shown done</button>
    <div id="wz-section-tasks">
      <TaskGroup title="Start of Day" subtitle="Before 8am - vehicle / general" tasks={startTasks} state={state} toggleTask={toggleTask} currentUser={currentUser} saveTruck={saveTruck} />
      <TaskGroup title="End of Day" subtitle="Before 4pm - vehicle / general" tasks={endTasks} state={state} toggleTask={toggleTask} currentUser={currentUser} saveTruck={saveTruck} />
      {otherTasks.length > 0 && <TaskGroup title="Vehicle / General" subtitle="No time assigned" tasks={otherTasks} state={state} toggleTask={toggleTask} currentUser={currentUser} saveTruck={saveTruck} />}
    </div>
    {canManage(role) && <button className="btn line block" onClick={() => openSheet({ title: "Edit Trucks tasks", content: <TaskEditor state={state} section="trucks" saveTask={saveTask} removeTask={removeTask} /> })}>Edit task list</button>}
  </>;
}

function freqLabel(freq: TaskFrequency) {
  return freq === "as_needed" ? "As needed" : freq[0].toUpperCase() + freq.slice(1);
}

function WarehouseTasksSection({ state, role, toggleTask, openSheet, saveTask, removeTask }: { state: AppState; role: Role; toggleTask: (taskId: string) => void; openSheet: (sheet: { title: string; content: React.ReactNode } | null) => void; saveTask: (task: TruckTask) => void; removeTask: (id: string) => void }) {
  const [freq, setFreq] = useState<TaskFrequency>("daily");
  const [category, setCategory] = useState<string>("all");
  const warehouseTasks = state.truckTasks.filter((task) => task.section === "warehouse");
  const categories = Array.from(new Set(warehouseTasks.map((task) => task.category).filter((item): item is string => Boolean(item))));
  const visibleTasks = warehouseTasks.filter((task) => task.freq === freq && (category === "all" || task.category === category));
  const allShownDone = visibleTasks.length > 0 && visibleTasks.every((task) => isTaskDone(state.taskCompletions, state.currentUserId, task));
  const markAllShown = () => visibleTasks.filter((task) => !isTaskDone(state.taskCompletions, state.currentUserId, task)).forEach((task) => toggleTask(task.id));

  return <>
    <div className="seg">{(["daily", "weekly", "monthly", "quarterly", "yearly", "as_needed"] as TaskFrequency[]).map((item) => <button key={item} className={freq === item ? "on" : ""} onClick={() => setFreq(item)}>{freqLabel(item)}</button>)}</div>
    <div className="chips"><Chip on={category === "all"} onClick={() => setCategory("all")}>All</Chip>{categories.map((item) => <Chip key={item} on={category === item} onClick={() => setCategory(item)}>{item}</Chip>)}</div>
    <button className="btn line block" disabled={visibleTasks.length === 0 || allShownDone} onClick={markAllShown}>Mark all shown done</button>
    <section className="card">{visibleTasks.length ? visibleTasks.map((task) => <TaskRow key={task.id} task={task} done={isTaskDone(state.taskCompletions, state.currentUserId, task)} toggleTask={toggleTask} meta={task.personResponsible} />) : <p className="tiny muted">No tasks for this filter.</p>}</section>
    {canManage(role) && <button className="btn line block" onClick={() => openSheet({ title: "Edit Warehouse tasks", content: <TaskEditor state={state} section="warehouse" saveTask={saveTask} removeTask={removeTask} /> })}>Edit task list</button>}
  </>;
}

function ServicesTasksSection({ state, role, toggleTask, openSheet, saveTask, removeTask }: { state: AppState; role: Role; toggleTask: (taskId: string) => void; openSheet: (sheet: { title: string; content: React.ReactNode } | null) => void; saveTask: (task: TruckTask) => void; removeTask: (id: string) => void }) {
  const [serviceId, setServiceId] = useState<ServiceId | "all">("all");
  const serviceTasks = state.truckTasks.filter((task) => task.section === "services");
  const availableServices = state.services.filter((service) => serviceTasks.some((task) => task.serviceId === service.id));
  const visibleTasks = serviceTasks.filter((task) => serviceId === "all" || task.serviceId === serviceId);
  const allShownDone = visibleTasks.length > 0 && visibleTasks.every((task) => isTaskDone(state.taskCompletions, state.currentUserId, task));
  const markAllShown = () => visibleTasks.filter((task) => !isTaskDone(state.taskCompletions, state.currentUserId, task)).forEach((task) => toggleTask(task.id));

  return <>
    <p className="tiny muted">Job-site prep checklist by service - not required for daily points.</p>
    <div className="chips"><Chip on={serviceId === "all"} onClick={() => setServiceId("all")}>All</Chip>{availableServices.map((service) => <Chip key={service.id} on={serviceId === service.id} onClick={() => setServiceId(service.id)}>{service.name}</Chip>)}</div>
    <button className="btn line block" disabled={visibleTasks.length === 0 || allShownDone} onClick={markAllShown}>Mark all shown done</button>
    <section className="card">{visibleTasks.length ? visibleTasks.map((task) => <TaskRow key={task.id} task={task} done={isTaskDone(state.taskCompletions, state.currentUserId, task)} toggleTask={toggleTask} />) : <p className="tiny muted">No tasks for this filter.</p>}</section>
    {canManage(role) && <button className="btn line block" onClick={() => openSheet({ title: "Edit Services tasks", content: <TaskEditor state={state} section="services" saveTask={saveTask} removeTask={removeTask} /> })}>Edit task list</button>}
  </>;
}

function formatServiceDate(value?: string) {
  if (!value) return "not recorded";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "not recorded" : formatDate(parsed);
}

// Receipts live in a private bucket, so they open through a short-lived signed
// URL rather than a direct link.
function ReceiptLink({ storageKey }: { storageKey: string }) {
  const [status, setStatus] = useState<"" | "opening" | "failed">("");
  // Logs from before uploads worked hold a bare filename, not a storage key.
  if (DEMO_MODE || !storageKey.includes("/")) return <span className="tiny muted">{storageKey} (not stored)</span>;
  const open = async () => {
    setStatus("opening");
    const url = await receiptSignedUrl(storageKey);
    setStatus(url ? "" : "failed");
    if (url) window.open(url, "_blank", "noopener");
  };
  return <button className="link" onClick={open} disabled={status === "opening"}>
    {status === "opening" ? "Opening..." : status === "failed" ? "Could not open" : "View receipt"}
  </button>;
}

function TruckReceipts({ state, truckId }: { state: AppState; truckId: string }) {
  const logs = state.truckLogs
    .filter((log) => log.truckId === truckId && log.receiptPhotoName)
    .sort((a, b) => b.ts.localeCompare(a.ts))
    .slice(0, 10);
  if (!logs.length) return null;
  return <div className="receipt-history">
    <label className="fld">Gas station receipts</label>
    {logs.map((log) => <div className="receipt-history-row" key={log.id}>
      <span className="tiny muted">{formatDate(log.ts)}{log.gasStation ? ` · ${log.gasStation}` : ""}{log.totalCost ? ` · ${money(log.totalCost)}` : ""}</span>
      <ReceiptLink storageKey={log.receiptPhotoName as string} />
    </div>)}
  </div>;
}

function TruckForm({ state, truck, saveTruckRecord }: { state: AppState; truck?: Truck; saveTruckRecord: (truck: Truck, message?: string) => void }) {
  const [draft, setDraft] = useState<Truck>(truck ?? { id: crypto.randomUUID(), name: "", km: 0, lastServiced: "", lastOil: 0 });
  const set = <K extends keyof Truck>(key: K, value: Truck[K]) => setDraft((current) => ({ ...current, [key]: value }));
  return <div className="form-stack">
    <label className="fld">Truck name</label>
    <input className="in" value={draft.name} onChange={(event) => set("name", event.target.value)} placeholder="Make, model (year) - plate" />
    <NumberField label="Current mileage (km)" value={draft.km} setValue={(value) => set("km", value)} />
    <label className="fld">Last serviced</label>
    <input className="in" type="date" value={draft.lastServiced ?? ""} onChange={(event) => set("lastServiced", event.target.value)} />
    <NumberField label="Last oil change (km)" value={draft.lastOil} setValue={(value) => set("lastOil", value)} />
    <h3 className="form-section-head">Vehicle details</h3>
    <label className="fld">Make</label>
    <input className="in" value={draft.make ?? ""} onChange={(event) => set("make", event.target.value)} />
    <label className="fld">Model</label>
    <input className="in" value={draft.model ?? ""} onChange={(event) => set("model", event.target.value)} />
    <label className="fld">Model year</label>
    <input className="in" value={draft.modelYear ?? ""} onChange={(event) => set("modelYear", event.target.value)} />
    <label className="fld">VIN</label>
    <input className="in" value={draft.vin ?? ""} onChange={(event) => set("vin", event.target.value)} />
    <label className="fld">Registration number</label>
    <input className="in" value={draft.registration ?? ""} onChange={(event) => set("registration", event.target.value)} />
    <label className="fld">Licence plate</label>
    <input className="in" value={draft.licensePlate ?? ""} onChange={(event) => set("licensePlate", event.target.value)} />
    <label className="fld">Insurance policy number</label>
    <input className="in" value={draft.insurancePolicy ?? ""} onChange={(event) => set("insurancePolicy", event.target.value)} />
    <label className="check"><input type="checkbox" checked={draft.showToCrew ?? true} onChange={(event) => set("showToCrew", event.target.checked)} /> Show this vehicle to the crew</label>
    <div className="row2"><div><label className="fld">Fleet number</label><input className="in" value={draft.fleetNumber ?? ""} onChange={(event) => set("fleetNumber", event.target.value || undefined)} /></div><div><label className="fld">Flag oil change at (km)</label><input className="in" type="number" min="0" value={draft.oilChangeDueKm ?? ""} onChange={(event) => set("oilChangeDueKm", event.target.value ? Number(event.target.value) : undefined)} /></div></div><label className="fld">Next service due</label><input className="in" type="date" value={draft.nextServiceDate ?? ""} onChange={(event) => set("nextServiceDate", event.target.value || undefined)} /><p className="tiny muted">The oil reading flags the vehicle once the odometer passes it. The date is a reminder for the next check.</p><button className="btn primary block" disabled={!draft.name.trim()} onClick={() => saveTruckRecord(draft, truck ? "Truck updated" : "Truck added")}>Save truck</button>
    {truck && <TruckReceipts state={state} truckId={truck.id} />}
  </div>;
}

/**
 * What Finance and anyone else who may look at a vehicle but not change it
 * sees: the paperwork, in the order you get asked for it on the phone.
 */
function VehicleDetails({ truck }: { truck: Truck }) {
  const rows: [string, string | undefined][] = [
    ["Make", truck.make],
    ["Model", truck.model],
    ["Model year", truck.modelYear],
    ["VIN", truck.vin],
    ["Registration number", truck.registration],
    ["Licence plate", truck.licensePlate],
    ["Insurance policy number", truck.insurancePolicy],
  ];
  const known = rows.filter(([, value]) => value);
  return <div className="form-stack">
    <div className="line-item"><div className="mid"><b>{truck.name}</b><div className="tiny muted">{truck.km ? `${truck.km.toLocaleString()} km` : "No mileage yet"} \u00b7 last service {formatServiceDate(truck.lastServiced)}</div></div></div>
    {known.length
      ? <dl className="vehicle-details">{known.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      : <p className="tiny muted">No registration details recorded for this vehicle yet.</p>}
  </div>;
}

function TaskGroup({ title, subtitle, tasks, state, toggleTask, currentUser, saveTruck }: { title: string; subtitle: string; tasks: TruckTask[]; state: AppState; toggleTask: (taskId: string) => void; currentUser: User; saveTruck: (log: Omit<TruckLog, "id" | "ts">, chosenDate?: string) => void }) {
  return <section className="card"><div className="sec-h"><div><h2>{title}</h2><div className="tiny muted">{subtitle}</div></div><Pill tone={tasks.length ? "neu" : "warn"}>{tasks.length}</Pill></div>{tasks.length ? tasks.map((task) => isKmEntryTask(task)
    ? <KmEntryRow key={task.id} task={task} state={state} currentUser={currentUser} saveTruck={saveTruck} done={isTaskDone(state.taskCompletions, state.currentUserId, task)} />
    : <TaskRow key={task.id} task={task} done={isTaskDone(state.taskCompletions, state.currentUserId, task)} toggleTask={toggleTask} meta={task.assignedTo ? userName(state, task.assignedTo) : undefined} />) : <p className="tiny muted">No tasks for this filter.</p>}</section>;
}

function KmEntryRow({ task, state, currentUser, saveTruck, done }: { task: { id: string; text: string }; state: AppState; currentUser: User; saveTruck: (log: Omit<TruckLog, "id" | "ts">, chosenDate?: string) => void; done: boolean }) {
  const [truckId, setTruckId] = useState(state.trucks[0]?.id ?? "");
  const [km, setKm] = useState<string>("");
  const save = () => {
    const value = Number(km);
    if (!truckId || !km || value <= 0) return;
    saveTruck({ truckId, km: value, driverId: currentUser.id, siteId: state.sites[0]?.id ?? "", serviceId: "veh", oilChecked: false, fuelTopped: false });
    setKm("");
  };
  return <div className={`task km-entry ${done ? "done" : ""}`}>
    <span className="tk-txt">{task.text}</span>
    <div className="km-entry-fields">
      {state.trucks.length > 1 && <select className="in" value={truckId} onChange={(event) => setTruckId(event.target.value)}>{state.trucks.map((truck) => <option key={truck.id} value={truck.id}>{truck.name}</option>)}</select>}
      <input className="in" type="number" placeholder="KM" value={km} onChange={(event) => setKm(event.target.value)} />
      <button className="btn line sm" disabled={!km || Number(km) <= 0} onClick={save}>{done ? "Update" : "Save"}</button>
    </div>
  </div>;
}

function MaintenanceRequestForm({ state, submitMaintenance }: { state: AppState; submitMaintenance: (targetType: MaintenanceTargetType, targetId: string, targetLabel: string, description: string, deadlineAt?: string, chosenDate?: string) => void }) {
  const [targetType, setTargetType] = useState<MaintenanceTargetType>("truck");
  const options = targetType === "truck" ? state.trucks.map((t) => ({ id: t.id, label: t.name })) : state.tools.map((t) => ({ id: t.id, label: t.name }));
  const [targetId, setTargetId] = useState(options[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [submittedDate, setSubmittedDate] = useState(todayKey());
  const [deadline, setDeadline] = useState("");
  const currentOptions = targetType === "truck" ? state.trucks.map((t) => ({ id: t.id, label: t.name })) : state.tools.map((t) => ({ id: t.id, label: t.name }));
  const selectedLabel = currentOptions.find((item) => item.id === targetId)?.label ?? currentOptions[0]?.label ?? "";
  return <div className="field-stack">
    <label className="fld">Type</label>
    <div className="seg">
      <button className={targetType === "truck" ? "on" : ""} onClick={() => { setTargetType("truck"); setTargetId(state.trucks[0]?.id ?? ""); }}>Truck</button>
      <button className={targetType === "tool" ? "on" : ""} onClick={() => { setTargetType("tool"); setTargetId(state.tools[0]?.id ?? ""); }}>Tool</button>
    </div>
    <label className="fld">{targetType === "truck" ? "Truck" : "Tool"}</label>
    <select className="in" value={targetId} onChange={(event) => setTargetId(event.target.value)}>
      {currentOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
    </select>
    <label className="fld">What's wrong?</label>
    <textarea className="in" rows={5} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the issue..." />
    <label className="fld">Submitted date</label>
    <input className="in" type="date" value={submittedDate} max={todayKey()} onChange={(event) => setSubmittedDate(event.target.value)} />
    <label className="fld">Needed by (optional)</label>
    <input className="in" type="date" value={deadline} min={todayKey()} onChange={(event) => setDeadline(event.target.value)} />
    <button className="btn primary block" disabled={!targetId || !description.trim()} onClick={() => submitMaintenance(targetType, targetId, selectedLabel, description, deadline || undefined, submittedDate)}>Submit request</button>
  </div>;
}

function MaintenanceRequestRow({ request, state, canResolve, respondMaintenance, editMaintenance }: { request: MaintenanceRequest; state: AppState; canResolve: boolean; editMaintenance: (id: string, description: string, deadlineAt?: string) => void; respondMaintenance: (requestId: string, note: string) => void }) {
  const [note, setNote] = useState("");
  const requester = state.users.find((item) => item.id === request.requestedBy)?.name ?? "Unknown";
  return <div className="line-item">
    <div className="mid">
      <b>{request.targetType === "truck" ? "🚛" : "🛠️"} {request.targetLabel}</b>
      <div className="tiny muted">{request.description}</div>
      <div className="tiny muted">Requested by {requester} - {formatDate(request.requestedAt)}</div>
      {request.deadlineAt && request.status === "open" && <div className="tiny muted">Needed by {formatDate(request.deadlineAt)}</div>}
      {request.status === "resolved" && <div className="tiny muted">Resolved{request.responseNote ? `: ${request.responseNote}` : ""}</div>}
    </div>
    {request.status === "open" && canResolve && <div className="field-stack">
      <input className="in" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Response note (optional)" />
      <button className="btn line sm" onClick={() => respondMaintenance(request.id, note)}>Mark resolved</button>
      <button className="btn line sm" onClick={() => {
        const next = window.prompt("Change the request", request.description);
        if (next && next.trim() && next.trim() !== request.description) editMaintenance(request.id, next.trim(), request.deadlineAt);
      }}>Edit</button>
    </div>}
  </div>;
}

function MaterialDetail({ material, role, setExactCount, saveMaterial, retireRecord }: { material: Material; role: Role; setExactCount: (material: Material, qty: number) => void; saveMaterial: (material: Material, includeQty?: boolean) => void; retireRecord?: RetireRecord }) {
  const [qty, setQty] = useState(material.qty);
  return <div><MaterialRow material={material} showPrice={canSeePrices(role)} /><label className="fld">Exact stock count</label>{/* No step meant the browser defaulted to whole numbers and refused 0.5 outright, so a half-full drum could not be counted. */}<input className="in" type="number" step={material.step} min="0" value={qty} onChange={(event) => setQty(Number(event.target.value))} disabled={!canManage(role)} /><p className="tiny muted">Counts in steps of {material.step} {material.unit.toLowerCase()}.</p><button className="btn primary block" disabled={!canManage(role)} onClick={() => setExactCount(material, qty)}>Set exact count</button>{canManage(role) && <MaterialForm material={material} saveMaterial={saveMaterial} />}{canManage(role) && retireRecord && <ArchiveButton noun="product" retired={material.active === false} onToggle={() => retireRecord("materials", material.id, material.active === false, { on: "Product brought back", off: "Product archived" })} />}</div>;
}

function MaterialForm({ material, saveMaterial }: { material?: Material; saveMaterial: (material: Material, includeQty?: boolean) => void }) {
  const [draft, setDraft] = useState<Material>(material ?? { id: crypto.randomUUID(), name: "", category: "waterproofing", unit: "Unit", step: 0.25, pack: "", unitsPerPallet: 0, cost: 0, strictTracking: true, qty: 0, reorderPoint: 1, bin: "" });
  const set = <K extends keyof Material>(key: K, value: Material[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const setUnit = (unit: MaterialUnit) => setDraft((current) => ({ ...current, unit, step: stepForMaterialUnit(unit) }));
  return <div className="form-stack"><label className="fld">Name</label><input className="in" value={draft.name} onChange={(event) => set("name", event.target.value)} /><div className="row2"><div><label className="fld">Category</label><select className="in" value={draft.category} onChange={(event) => set("category", event.target.value as Category)}>{Object.entries(categoryLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div><div><label className="fld">Used on which services</label><div className="chips">{seedServices.map((service) => <Chip key={service.id} on={draft.serviceIds?.includes(service.id) ?? false} onClick={() => set("serviceIds", draft.serviceIds?.includes(service.id) ? draft.serviceIds.filter((item) => item !== service.id) : [...(draft.serviceIds ?? []), service.id])}>{service.name}</Chip>)}</div><p className="tiny muted">Leave all unticked and it shows on every service&rsquo;s daily log.</p></div><div><label className="fld">Locked unit</label><select className="in" value={draft.unit} onChange={(event) => setUnit(event.target.value as MaterialUnit)}>{ALLOWED_MATERIAL_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></div></div><div className="row2"><div><label className="fld">Counts in steps of</label><select className="in" value={String(draft.step)} onChange={(event) => set("step", Number(event.target.value))}>{[0.25, 0.5, 1, 5, 10, 25, 50, 100].map((option) => <option key={option} value={String(option)}>{option}</option>)}</select><p className="tiny muted">How much one tap of + or &minus; moves. Tens suit shot and pins; quarters suit drums and rolls.</p></div><div><label className="fld">Bin</label><input className="in" value={draft.bin} onChange={(event) => set("bin", event.target.value)} /></div></div><label className="fld">Pack note</label><input className="in" value={draft.pack} onChange={(event) => set("pack", event.target.value)} /><div className="row2"><NumberField label="Units/pallet" value={draft.unitsPerPallet} setValue={(value) => set("unitsPerPallet", value)} /><NumberField label="Cost" value={draft.cost} setValue={(value) => set("cost", value)} step={0.01} /></div><div className="row2"><NumberField label="On hand" value={draft.qty} setValue={(value) => set("qty", value)} step={draft.step} /><NumberField label="Reorder" value={draft.reorderPoint} setValue={(value) => set("reorderPoint", value)} step={draft.step} /></div><button className="btn primary block" onClick={() => saveMaterial(draft)}>Save material</button></div>;
}

function ToolSheet({ state, role, userId, tool, saveTool, retireRecord }: { state: AppState; role: Role; userId: string; tool: ToolItem; saveTool: (tool: ToolItem, message?: string) => void; retireRecord?: RetireRecord }) {
  const [siteId, setSiteId] = useState(tool.outJob ?? unarchivedJobs(state.sites)[0]?.id ?? "");
  const [serviceId, setServiceId] = useState<ServiceId>(tool.outService ?? tool.serviceId);
  const [note, setNote] = useState(tool.note ?? "");
  // Opening a tool showed everything about it except its name, which is the one
  // thing you open a tool to correct after a typo.
  const [name, setName] = useState(tool.name);
  const renameOnBlur = () => {
    const next = name.trim();
    if (next && next !== tool.name) saveTool({ ...tool, name: next }, "Tool renamed");
  };
  const markCondition = (condition: ToolCondition) => saveTool({ ...tool, condition, note }, "Tool condition updated");
  const checkout = () => siteId && serviceId && saveTool({ ...tool, status: "out", outBy: userId, outJob: siteId, outService: serviceId, outTs: new Date().toISOString() }, "Checked out");
  // Status and battery were read-only pills. They are not decoration: a tool
  // can come back without anyone pressing Check in, and a tool charged last
  // Friday reads as "never charged" because lastCharged was never set. Both
  // are editable here now, which is what Jordan asked for.
  const setStatus = (next: string) => next === "out"
    ? checkout()
    : saveTool({ ...tool, status: "in", outBy: undefined, outJob: undefined, outService: undefined, outTs: undefined }, "Checked in");
  const chargedOn = tool.lastCharged ? tool.lastCharged.slice(0, 10) : "";
  return <div><label className="fld">Tool name</label><input className="in" value={name} onChange={(event) => setName(event.target.value)} onBlur={renameOnBlur} aria-label="Tool name" /><div className="line-item"><b>Status</b><select className="in tool-state" value={tool.status} onChange={(event) => setStatus(event.target.value)} aria-label="Tool status"><option value="in">in warehouse</option><option value="out">out on a job</option></select></div>{tool.battery && <div className="line-item"><b>Battery</b><div className="tool-battery"><Pill tone={batteryState(tool.lastCharged).key}>{batteryState(tool.lastCharged).label}</Pill><input className="in tool-state" type="date" max={todayKey()} value={chargedOn} aria-label="Last charged" onChange={(event) => saveTool({ ...tool, lastCharged: event.target.value ? new Date(`${event.target.value}T12:00:00`).toISOString() : undefined }, "Charge date updated")} /></div></div>}<p className="tiny muted">Switching to &ldquo;out on a job&rdquo; uses the job and service picked below.</p><label className="fld">Job</label><select className="in" value={siteId} onChange={(event) => setSiteId(event.target.value)}>{jobChoices(state.sites, siteId).map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select><label className="fld">Service</label><select className="in" value={serviceId} onChange={(event) => setServiceId(event.target.value as ServiceId)}>{state.services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select><ToolPhotoFields tool={tool} onChange={(patch) => saveTool({ ...tool, ...patch }, "Tool photo saved")} /><label className="fld">Damage / repair note</label><textarea className="in" value={note} onChange={(event) => setNote(event.target.value)} /><button className="btn primary block" onClick={tool.status === "out" ? () => saveTool({ ...tool, status: "in", outBy: undefined, outJob: undefined, outService: undefined, outTs: undefined }, "Checked in") : checkout}>{tool.status === "out" ? "Check in" : "Check out"}</button>{tool.battery && <button className="btn line block" onClick={() => saveTool({ ...tool, lastCharged: new Date().toISOString() }, "Marked charged")}>Mark charged</button>}{canManage(role) && <div className="row-action"><button className="btn line sm" onClick={() => markCondition("damaged")}>Report damage</button><button className="btn line sm" onClick={() => markCondition("repair")}>Send to repair</button><button className="btn line sm" onClick={() => markCondition("good")}>Back in service</button></div>}{canManage(role) && retireRecord && <ArchiveButton noun="tool" retired={tool.active === false} onToggle={() => retireRecord("tools", tool.id, tool.active === false, { on: "Tool brought back", off: "Tool archived" })} />}</div>;
}

/**
 * What a vehicle is meant to carry.
 *
 * The crew check the truck against this before leaving the yard, so it lists
 * only what is assigned and lets a manager set the counts. Setting a line to
 * zero takes it off the truck rather than recording a zero.
 */
/**
 * The paper trail for a vehicle. Mechanic invoices, inspection reports and
 * photos of whatever failed, kept against the truck so the history travels
 * with it rather than living in somebody's inbox.
 */
function TruckFiles({ state, role, truck, userId, onUploaded, onDeleted }: { state: AppState; role: Role; truck: Truck; userId: string; onUploaded: (file: TruckFile) => void; onDeleted: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState("");
  const [openingId, setOpeningId] = useState("");
  const files = state.truckFiles.filter((file) => file.truckId === truck.id);
  const add = async (picked: FileList | null) => {
    if (!picked?.length) return;
    setBusy(true); setFailed("");
    try {
      for (const file of Array.from(picked)) onUploaded(await uploadTruckFile(truck.id, file, userId));
    } catch (error) {
      setFailed(error instanceof Error ? error.message : "That upload did not work.");
    } finally { setBusy(false); }
  };
  const open = async (file: TruckFile) => {
    setOpeningId(file.id);
    try { window.open(await truckFileSignedUrl(file.storageKey), "_blank", "noopener"); }
    catch { setFailed("Could not open that file."); }
    finally { setOpeningId(""); }
  };
  return <div>
    <label className="fld">Repair documents and photos</label>
    <p className="tiny muted">Invoices, inspection reports, photos of the problem. Kept against this vehicle.</p>
    {canManage(role) && <div className="file-picker"><input className="in" type="file" multiple accept="image/*,application/pdf" onChange={(event) => { void add(event.target.files); event.target.value = ""; }} /></div>}
    {busy && <p className="tiny muted">Uploading&hellip;</p>}
    {failed && <p className="tiny error">{failed}</p>}
    {files.length ? <section className="card">{files.map((file) => <div className="line-item" key={file.id}>
      <div className="mid"><b>{file.label ?? file.kind}</b><div className="tiny muted">{file.kind} &middot; {formatDate(file.createdAt)}</div></div>
      <button className="btn line sm" disabled={openingId === file.id} onClick={() => void open(file)}>{openingId === file.id ? "Opening\u2026" : "Open"}</button>
      {canManage(role) && <button className="btn line sm" onClick={() => onDeleted(file.id)}>Remove</button>}
    </div>)}</section> : <p className="tiny muted">Nothing filed against this vehicle yet.</p>}
  </div>;
}

export function TruckInventorySheet({ state, role, truck, setTruckInventory }: { state: AppState; role: Role; truck: Truck; setTruckInventory: (truckId: string, materialId: string, qty: number) => void }) {
  const [query, setQuery] = useState("");
  // openSheet is handed an already-rendered element, so the state prop below is
  // frozen at the moment the sheet opened and never refreshes while it is up.
  // Reading the counts straight off it meant every quantity displayed as its
  // opening value and every "+" added a step to that same stale number: tapping
  // five times still saved one step. The sheet keeps its own copy of the counts
  // and is the one that moves; the save still goes through to the server.
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(state.truckInventory.filter((line) => line.truckId === truck.id).map((line) => [line.materialId, line.qty])));
  const applyCount = (materialId: string, step: number, next: number) => {
    // Steps of 0.25 accumulate float noise (0.1 + 0.2), so land on the step.
    const qty = Math.max(0, roundStep(next, step));
    setCounts((current) => ({ ...current, [materialId]: qty }));
    setTruckInventory(truck.id, materialId, qty);
  };
  const byMaterial = new Map(Object.entries(counts).filter(([, qty]) => qty > 0));
  const stocked = stockedMaterials(state.materials);
  const needle = query.trim().toLowerCase();
  const candidates = needle
    ? stocked.filter((material) => material.name.toLowerCase().includes(needle))
    : stocked.filter((material) => byMaterial.has(material.id));
  const sorted = [...candidates].sort((a, b) => a.name.localeCompare(b.name));
  return <div>
    <p className="tiny muted">What this vehicle should be carrying. Search to add something; set a count to zero to take it off.</p>
    {canManage(role) && <div className="search"><input className="in" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a product to add" /></div>}
    <section className="card">
      {sorted.length ? sorted.map((material) => {
        const qty = counts[material.id] ?? 0;
        return <div className="line-item" key={material.id}>
          <div className="mid"><b>{material.name}</b><div className="tiny muted">{material.unit} · steps of {material.step}</div></div>
          {canManage(role)
            ? <div className="qtybox">
                <button onClick={() => applyCount(material.id, material.step, qty - material.step)}>-</button>
                <input type="number" inputMode="decimal" min="0" step={material.step} value={qty}
                  aria-label={`Quantity of ${material.name} on ${truck.name}`}
                  onChange={(event) => applyCount(material.id, material.step, Number(event.target.value) || 0)} />
                <button onClick={() => applyCount(material.id, material.step, qty + material.step)}>+</button>
              </div>
            : <span>{qty} {material.unit}</span>}
        </div>;
      }) : <p className="tiny muted">{needle ? "Nothing matches that search." : "Nothing assigned to this vehicle yet."}</p>}
    </section>
  </div>;
}

function TruckLogForm({ state, saveTruck }: { state: AppState; saveTruck: (log: Omit<TruckLog, "id" | "ts">, chosenDate?: string) => void }) {
  const [truckId, setTruckId] = useState(state.trucks[0]?.id ?? "");
  const truck = state.trucks.find((item) => item.id === truckId);
  const [km, setKm] = useState(truck?.km ?? 0);
  const [logDate, setLogDate] = useState(todayKey());
  const [siteId, setSiteId] = useState(unarchivedJobs(state.sites)[0]?.id ?? "");
  const [serviceId, setServiceId] = useState<ServiceId>("veh");
  const [fuelTopped, setFuelTopped] = useState(false);
  const [oilChecked, setOilChecked] = useState(false);
  const [exteriorWash, setExteriorWash] = useState(false);
  const [gasStation, setGasStation] = useState("");
  const [totalCost, setTotalCost] = useState(0);
  const [receiptPhotoName, setReceiptPhotoName] = useState("");
  const [receiptStatus, setReceiptStatus] = useState<"" | "uploading" | "done" | "failed">("");
  const handleReceipt = async (file: File | null) => {
    if (!file) { setReceiptPhotoName(""); setReceiptStatus(""); return; }
    if (DEMO_MODE) { setReceiptPhotoName(file.name); setReceiptStatus("done"); return; }
    setReceiptStatus("uploading");
    try {
      setReceiptPhotoName(await uploadReceiptPhoto(truckId || "unassigned", file));
      setReceiptStatus("done");
    } catch {
      setReceiptPhotoName("");
      setReceiptStatus("failed");
    }
  };
  const [repairs, setRepairs] = useState("");
  const [notes, setNotes] = useState("");
  return <div><label className="fld">Truck</label><select className="in" value={truckId} onChange={(event) => { setTruckId(event.target.value); setKm(state.trucks.find((item) => item.id === event.target.value)?.km ?? 0); }}>{onFleet(state.trucks, truckId).map((item) => <option key={item.id} value={item.id}>{item.name} - {item.km} km</option>)}</select><label className="fld">Date</label><input className="in" type="date" value={logDate} max={todayKey()} onChange={(event) => setLogDate(event.target.value)} /><NumberField label="Odometer KM" value={km} setValue={setKm} /><label className="fld">Job</label><select className="in" value={siteId} onChange={(event) => setSiteId(event.target.value)}>{jobChoices(state.sites, siteId).map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select><label className="fld">Service</label><select className="in" value={serviceId} onChange={(event) => setServiceId(event.target.value as ServiceId)}>{state.services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select><label className="fld">Gas station</label><input className="in" value={gasStation} onChange={(event) => setGasStation(event.target.value)} placeholder="Station name" /><NumberField label="Total cost with GST" value={totalCost} setValue={setTotalCost} step={0.01} /><label className="fld">Receipt photo</label><ImageFilePicker accept="image/*" onChange={handleReceipt} />{receiptStatus === "uploading" && <p className="tiny muted">Uploading receipt…</p>}{receiptStatus === "done" && <p className="tiny muted">Receipt attached.</p>}{receiptStatus === "failed" && <p className="tiny error">Receipt upload failed — you can still save the check without it.</p>}<label className="check"><input type="checkbox" checked={fuelTopped} onChange={(event) => setFuelTopped(event.target.checked)} /> Fuel topped</label><label className="check"><input type="checkbox" checked={oilChecked} onChange={(event) => setOilChecked(event.target.checked)} /> Oil checked</label><label className="check"><input type="checkbox" checked={exteriorWash} onChange={(event) => setExteriorWash(event.target.checked)} /> Exterior wash</label><label className="fld">Repairs / issues</label><textarea className="in" value={repairs} onChange={(event) => setRepairs(event.target.value)} /><label className="fld">Notes</label><textarea className="in" value={notes} onChange={(event) => setNotes(event.target.value)} /><button className="btn primary block" disabled={!truckId || !siteId || !gasStation.trim() || totalCost <= 0 || receiptStatus === "uploading"} onClick={() => saveTruck({ truckId, km, driverId: state.currentUserId, siteId, serviceId, oilChecked, fuelTopped, gasStation: gasStation.trim(), totalCost, receiptPhotoName, exteriorWash, repairs, notes }, logDate)}>Save Gas Station Check</button></div>;
}

function TaskEditor({ state, section, saveTask, removeTask }: { state: AppState; section: TaskSection; saveTask: (task: TruckTask) => void; removeTask: (id: string) => void }) {
  // "Edit button does not work" - it did, but it filled a form sitting below
  // every task in the section, so nothing visibly happened. Bring the form to
  // the operator instead of expecting them to find it.
  const formRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<TruckTask>({ id: crypto.randomUUID(), text: "", serviceId: "veh", freq: "daily", timeOfDay: "start", requiredForDailyPoints: section === "trucks", section });
  const sectionTasks = state.truckTasks.filter((task) => task.section === section);
  return <div><section className="card">{sectionTasks.map((task) => <div className="line-item" key={task.id}><span>{task.text}</span><span className="tiny muted">{taskTimeLabel(task)}</span><button className="btn line sm" onClick={() => { setDraft(task); requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })); }}>Edit</button><button className="btn line sm" onClick={() => removeTask(task.id)}>Delete</button></div>)}</section><div ref={formRef}><p className="fld">{state.truckTasks.some((task) => task.id === draft.id) ? `Editing: ${draft.text || "this task"}` : "New task"}</p><label className="fld">Task</label><input className="in" value={draft.text} onChange={(event) => setDraft((current) => ({ ...current, text: event.target.value }))} /><div className="row2">{section !== "warehouse" && <select className="in" value={draft.serviceId} onChange={(event) => setDraft((current) => ({ ...current, serviceId: event.target.value as ServiceId }))}>{state.services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select>}<select className="in" value={draft.freq} onChange={(event) => setDraft((current) => ({ ...current, freq: event.target.value as TaskFrequency }))}>{(["daily", "weekly", "monthly", "quarterly", "yearly", "as_needed"] as TaskFrequency[]).map((item) => <option key={item} value={item}>{freqLabel(item)}</option>)}</select></div>{section === "warehouse" && <><label className="fld">Category</label><input className="in" value={draft.category ?? ""} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value || undefined }))} /><label className="fld">Person responsible (optional)</label><input className="in" value={draft.personResponsible ?? ""} onChange={(event) => setDraft((current) => ({ ...current, personResponsible: event.target.value || undefined }))} /></>}<div className="row2"><select className="in" value={draft.timeOfDay ?? ""} onChange={(event) => setDraft((current) => ({ ...current, timeOfDay: (event.target.value || undefined) as TruckTask["timeOfDay"] }))}><option value="">No time</option><option value="start">Start of Day</option><option value="end">End of Day</option><option value="pack_list">Service packing list</option><option value="job_start">Job start</option><option value="job_completion">Job completion</option></select><div><label className="fld">Assigned to</label><select className="in" value={draft.assignedTo ?? ""} onChange={(event) => setDraft((current) => ({ ...current, assignedTo: event.target.value || undefined }))}><option value="">Anyone on shift</option>{state.users.filter((user) => user.status !== "Inactive").map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select><p className="tiny muted">Leave as Anyone and the task stays a shared checklist.</p></div><label className="check"><input type="checkbox" checked={draft.requiredForDailyPoints !== false} onChange={(event) => setDraft((current) => ({ ...current, requiredForDailyPoints: event.target.checked }))} /> Counts for daily points</label></div><button className="btn primary block" onClick={() => saveTask(draft)}>Save task</button></div></div>;
}

function taskTimeLabel(task: TruckTask) {
  if (task.timeOfDay === "start") return "Start of Day";
  if (task.timeOfDay === "end") return "End of Day";
  if (task.timeOfDay === "pack_list") return "Packing list";
  if (task.timeOfDay === "job_start") return "Job start";
  if (task.timeOfDay === "job_completion") return "Job completion";
  return "No time";
}
