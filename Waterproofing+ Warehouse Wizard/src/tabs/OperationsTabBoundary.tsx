import { useEffect, useState } from "react";
import { categoryLabels } from "../data/seed";
import { ALLOWED_MATERIAL_UNITS, batteryState, canResolveMaintenanceRequests, dailyProgress, id, isTaskDone, money, serviceRequired, stepForMaterialUnit, stockStatus } from "../domain/business";
import type { AppState, Category, MaintenanceRequest, MaintenanceTargetType, Material, MaterialUnit, Role, ServiceId, Site, TaskFrequency, ToolCondition, ToolItem, Transaction, TruckLog, TruckTask, TxType, User } from "../types";
import { BulkToolSheet, canManage, Kpi, Pill, ProgressRing, serviceName, siteName, userName } from "../App";
import type { Tab as AppTab } from "../App";

type Tab = "inventory" | "log" | "tools" | "trucks";

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

export default function OperationsTabBoundary({ activeTab, state, role, currentUser, userId, toggleTask, openSheet, saveMaterial, setExactCount, setTab, submitTransactions, saveSite, saveTool, saveTruck, saveTask, removeTask, submitMaintenance, respondMaintenance }: {
  activeTab: Tab;
  state: AppState;
  role: Role;
  currentUser: User;
  userId: string;
  toggleTask: (taskId: string) => void;
  openSheet: (sheet: { title: string; content: React.ReactNode }) => void;
  saveMaterial: (material: Material, includeQty?: boolean) => void;
  setExactCount: (material: Material, qty: number) => void;
  setTab: (tab: AppTab) => void;
  submitTransactions: (txs: Omit<Transaction, "id" | "ts">[]) => void;
  saveSite: (site: Site) => void;
  saveTool: (tool: ToolItem, message?: string) => void;
  saveTruck: (log: Omit<TruckLog, "id" | "ts">) => void;
  saveTask: (task: TruckTask) => void;
  removeTask: (id: string) => void;
  submitMaintenance: (targetType: MaintenanceTargetType, targetId: string, targetLabel: string, description: string) => void;
  respondMaintenance: (requestId: string, note: string) => void;
}) {
  if (activeTab === "inventory") return <Inventory state={state} role={role} openSheet={openSheet} saveMaterial={saveMaterial} setExactCount={setExactCount} setTab={setTab} />;
  if (activeTab === "log") return <LogMaterials state={state} userId={userId} submitTransactions={submitTransactions} saveSite={saveSite} />;
  if (activeTab === "tools") return <Tools state={state} role={role} userId={userId} openSheet={openSheet} saveTool={saveTool} />;
  return <Trucks state={state} role={role} currentUser={currentUser} toggleTask={toggleTask} openSheet={openSheet} saveTruck={saveTruck} saveTask={saveTask} removeTask={removeTask} submitMaintenance={submitMaintenance} respondMaintenance={respondMaintenance} />;
}

function Chip({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return <button className={`chip ${on ? "on" : ""}`} onClick={onClick}>{children}</button>;
}

function MaterialRow({ material, onClick }: { material: Material; onClick?: () => void }) {
  const status = stockStatus(material);
  const pct = Math.max(6, Math.min(100, (material.qty / Math.max(material.reorderPoint * 1.6, 1)) * 100));
  return <div className="inv" onClick={onClick}><div className="ic">{categoryLabels[material.category].slice(0, 2).toUpperCase()}</div><div className="mid"><div className="nm">{material.name}</div><div className="meta">{material.bin} · reorder {material.reorderPoint} · {money(material.cost)}/{material.unit} · {material.pack}</div><div className="bar"><i style={{ width: `${pct}%` }} className={status.key} /></div></div><div className="qtywrap"><div className="qty">{material.qty}</div><Pill tone={status.key}>{status.label}</Pill></div></div>;
}

function TaskRow({ task, done, toggleTask }: { task: { id: string; text: string }; done: boolean; toggleTask: (taskId: string) => void }) {
  return <div className={`task ${done ? "done" : ""}`} onClick={() => toggleTask(task.id)}><span className="cbx"><svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6" fill="none" stroke="currentColor" strokeWidth="3" /></svg></span><span className="tk-txt">{task.text}</span></div>;
}

function NumberField({ label, value, setValue, step = 1 }: { label: string; value: number; setValue: (value: number) => void; step?: number }) {
  return <div><label className="fld">{label}</label><input className="in" type="number" step={step} value={value} onChange={(event) => setValue(Number(event.target.value))} /></div>;
}

function Inventory({ state, role, openSheet, saveMaterial, setExactCount, setTab }: { state: AppState; role: Role; openSheet: (sheet: { title: string; content: React.ReactNode }) => void; saveMaterial: (material: Material, includeQty?: boolean) => void; setExactCount: (material: Material, qty: number) => void; setTab: (tab: AppTab) => void }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const list = state.materials.filter((material) => (category === "all" || category === material.category || (category === "low" && stockStatus(material).key !== "good")) && (!query || `${material.name} ${material.bin}`.toLowerCase().includes(query.toLowerCase())));
  return <><button className="btn dark block" onClick={() => setTab("log")}>Log materials used / delivered</button><div className="search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search material or bin" /></div><div className="chips"><Chip on={category === "all"} onClick={() => setCategory("all")}>All {state.materials.length}</Chip><Chip on={category === "low"} onClick={() => setCategory("low")}>Reorder</Chip>{Object.entries(categoryLabels).map(([key, label]) => <Chip key={key} on={category === key} onClick={() => setCategory(key)}>{label}</Chip>)}</div><section className="card inv-card">{list.map((material) => <MaterialRow key={material.id} material={material} onClick={() => openSheet({ title: material.name, content: <MaterialDetail material={material} role={role} setExactCount={setExactCount} saveMaterial={saveMaterial} /> })} />)}</section>{canManage(role) && <button className="btn line block" onClick={() => openSheet({ title: "New material", content: <MaterialForm saveMaterial={saveMaterial} /> })}>Add new material</button>}</>;
}

function LogMaterials({ state, userId, submitTransactions, saveSite }: { state: AppState; userId: string; submitTransactions: (txs: Omit<Transaction, "id" | "ts">[]) => void; saveSite: (site: Site) => void }) {
  const [siteId, setSiteId] = useState(state.sites[0]?.id);
  const [serviceId, setServiceId] = useState<ServiceId>("wp");
  const [type, setType] = useState<TxType>("use");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [newSite, setNewSite] = useState("");
  const materials = state.materials.filter((material) => material.strictTracking !== false && (!query || material.name.toLowerCase().includes(query.toLowerCase())));
  const total = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  const add = (material: Material, sign = 1) => setCart((current) => ({ ...current, [material.id]: Math.max(0, (current[material.id] ?? 0) + sign * material.step) }));
  const submit = () => {
    if (!serviceRequired(siteId, serviceId) || total <= 0) return;
    submitTransactions(Object.entries(cart).filter(([, qty]) => qty > 0).map(([materialId, qty]) => ({ materialId, qty, type, siteId, serviceId, userId })));
    setCart({});
  };
  const addSite = () => {
    if (!newSite.trim()) return;
    const site = { id: id("s"), name: newSite.trim(), address: "", source: "manual" as const };
    saveSite(site);
    setSiteId(site.id);
    setNewSite("");
  };
  return <><section className="card"><label className="fld">Job site</label><div className="selrow">{state.sites.map((site) => <button key={site.id} className={`sopt ${siteId === site.id ? "on" : ""}`} onClick={() => setSiteId(site.id)}>{site.name}</button>)}</div><div className="row-action"><input className="in" value={newSite} onChange={(event) => setNewSite(event.target.value)} placeholder="+ Add job site" /><button className="btn line sm" onClick={addSite}>Add</button></div><label className="fld">Service</label><div className="selrow">{state.services.map((service) => <button key={service.id} className={`sopt ${serviceId === service.id ? "on" : ""}`} onClick={() => setServiceId(service.id)}>{service.name}</button>)}</div><div className="seg">{(["use", "deliver", "return", "receive", "loss"] as TxType[]).map((item) => <button key={item} className={type === item ? "on" : ""} onClick={() => setType(item)}>{item}</button>)}</div></section><div className="search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search materials to add" /></div><section className="card">{materials.map((material) => <div className="line-item" key={material.id}><div className="mid"><b>{material.name}</b><div className="tiny muted">{material.qty} {material.unit} on hand · locked unit</div></div><div className="qtybox"><button onClick={() => add(material, -1)}>-</button><input readOnly value={cart[material.id] ?? 0} /><button onClick={() => add(material, 1)}>+</button></div>{cart[material.id] > 0 && <button className="btn line sm" onClick={() => setCart((current) => ({ ...current, [material.id]: 0 }))}>Remove</button>}</div>)}</section>
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
    <button className="btn good block" disabled={total <= 0} onClick={submit}>Submit log ({total} units)</button></>;
}

function Tools({ state, role, userId, openSheet, saveTool }: { state: AppState; role: Role; userId: string; openSheet: (sheet: { title: string; content: React.ReactNode }) => void; saveTool: (tool: ToolItem, message?: string) => void }) {
  const [filter, setFilter] = useState<ServiceId | "all" | "charge">("all");
  const list = state.tools.filter((tool) => {
    if (filter === "charge") return tool.battery && batteryState(tool.lastCharged).key === "bad";
    if (filter === "all") return true;
    return tool.serviceId === filter;
  });
  return <><div className="kpis"><Kpi label="Checked out" value={state.tools.filter((tool) => tool.status === "out").length} sub={`of ${state.tools.length}`} /><Kpi label="Repair flags" value={state.tools.filter((tool) => tool.condition !== "good").length} sub="needs manager review" /></div><button className="btn primary block" onClick={() => openSheet({ title: "Check tools for job", content: <BulkToolSheet state={state} userId={userId} saveTool={saveTool} /> })}>Check tools for job</button><div className="chips"><Chip on={filter === "all"} onClick={() => setFilter("all")}>All</Chip><Chip on={filter === "charge"} onClick={() => setFilter("charge")}>🔋 Charge due {state.tools.filter(t => t.battery && batteryState(t.lastCharged).key === "bad").length > 0 ? `(${state.tools.filter(t => t.battery && batteryState(t.lastCharged).key === "bad").length})` : ""}</Chip>{state.services.map((service) => <Chip key={service.id} on={filter === service.id} onClick={() => setFilter(service.id)}>{service.name}</Chip>)}</div><section className="card">{list.map((tool) => { const charge = tool.battery ? batteryState(tool.lastCharged) : null; return <div className="tool-row" key={tool.id} onClick={() => openSheet({ title: tool.name, content: <ToolSheet state={state} role={role} userId={userId} tool={tool} saveTool={saveTool} /> })}><div><b>{tool.name}</b><div className="tiny muted">{serviceName(state, tool.serviceId)} {tool.status === "out" ? `- out with ${userName(state, tool.outBy)} - ${siteName(state, tool.outJob)}` : "- in warehouse"}</div></div><div className="tool-actions"><Pill tone={tool.status === "out" ? "warn" : "good"}>{tool.status}</Pill><Pill tone={tool.condition === "good" ? "good" : "bad"}>{tool.condition}</Pill>{charge && <Pill tone={charge.key}>{charge.label}</Pill>}</div></div>; })}</section></>;
}

function Trucks({ state, role, currentUser, toggleTask, openSheet, saveTruck, saveTask, removeTask, submitMaintenance, respondMaintenance }: { state: AppState; role: Role; currentUser: User; toggleTask: (taskId: string) => void; openSheet: (sheet: { title: string; content: React.ReactNode }) => void; saveTruck: (log: Omit<TruckLog, "id" | "ts">) => void; saveTask: (task: TruckTask) => void; removeTask: (id: string) => void; submitMaintenance: (targetType: MaintenanceTargetType, targetId: string, targetLabel: string, description: string) => void; respondMaintenance: (requestId: string, note: string) => void }) {
  const canResolve = canResolveMaintenanceRequests(currentUser);
  const openRequests = state.maintenanceRequests.filter((item) => item.status === "open");
  const resolvedRequests = state.maintenanceRequests.filter((item) => item.status === "resolved");
  const [freq, setFreq] = useState<TaskFrequency>("daily");
  const [serviceId, setServiceId] = useState<ServiceId | "all">("all");
  const progress = dailyProgress(state.truckTasks, state.taskCompletions, state.currentUserId);
  const visibleTasks = state.truckTasks.filter((task) => task.freq === freq && (serviceId === "all" || task.serviceId === serviceId));

  const allShownDone = visibleTasks.length > 0 && visibleTasks.every((task) => isTaskDone(state.taskCompletions, state.currentUserId, task));
  const markAllShown = () => visibleTasks.filter((task) => !isTaskDone(state.taskCompletions, state.currentUserId, task)).forEach((task) => toggleTask(task.id));

  const vehicleTasks = visibleTasks.filter((task) => task.serviceId === "veh" && task.timeOfDay !== "pack_list");
  const packTasks = visibleTasks.filter((task) => task.timeOfDay === "pack_list");
  const startTasks = vehicleTasks.filter((task) => task.timeOfDay === "start");
  const endTasks = vehicleTasks.filter((task) => task.timeOfDay === "end");
  const otherVehTasks = vehicleTasks.filter((task) => !task.timeOfDay);
  const serviceTasks = visibleTasks.filter((task) => task.serviceId !== "veh");
  const currentServiceName = serviceId !== "all" ? (state.services.find(s => s.id === serviceId)?.name ?? serviceId) : "";

  return <>
    {state.trucks.length > 0 && (
      <section className="card">
        <div className="sec-h"><h2>Fleet</h2></div>
        <div className="truck-list">
          {state.trucks.map(truck => {
            const lastLog = state.truckLogs.filter(l => l.truckId === truck.id).sort((a, b) => b.ts.localeCompare(a.ts))[0];
            return (
              <div className="truck-item" key={truck.id}>
                <div className="truck-icon">🚛</div>
                <div className="mid">
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{truck.name}</div>
                  <div className="tiny muted">{truck.km.toLocaleString()} km · last service {new Date(truck.lastServiced).toLocaleDateString('en-CA')}</div>
                </div>
                {lastLog && <div className="tiny muted">{new Date(lastLog.ts).toLocaleDateString('en-CA')}</div>}
              </div>
            );
          })}
        </div>
      </section>
    )}
    <section className="card"><div className="sec-h"><h2>Maintenance requests</h2><Pill tone={openRequests.length ? "warn" : "good"}>{openRequests.length} open</Pill></div><button className="btn line block" onClick={() => openSheet({ title: "Request maintenance", content: <MaintenanceRequestForm state={state} submitMaintenance={submitMaintenance} /> })}>Request maintenance</button>{openRequests.length ? openRequests.map((item) => <MaintenanceRequestRow key={item.id} request={item} state={state} canResolve={canResolve} respondMaintenance={respondMaintenance} />) : <p className="tiny muted">No open maintenance requests.</p>}{resolvedRequests.length > 0 && <details><summary className="tiny muted">{resolvedRequests.length} resolved</summary>{resolvedRequests.map((item) => <MaintenanceRequestRow key={item.id} request={item} state={state} canResolve={false} respondMaintenance={respondMaintenance} />)}</details>}</section>
    <section className="card"><ProgressRing pct={progress.pct} /><button className="btn primary block" onClick={() => openSheet({ title: "Gas Station Check", content: <TruckLogForm state={state} saveTruck={saveTruck} /> })}>Gas Station Check</button></section>
    <div className="seg">{(["daily", "weekly", "monthly"] as TaskFrequency[]).map((item) => <button key={item} className={freq === item ? "on" : ""} onClick={() => setFreq(item)}>{item}</button>)}</div>
    <div className="chips"><Chip on={serviceId === "all"} onClick={() => setServiceId("all")}>All</Chip>{state.services.map((service) => <Chip key={service.id} on={serviceId === service.id} onClick={() => setServiceId(service.id)}>{service.name}</Chip>)}</div>
    <button className="btn line block" disabled={visibleTasks.length === 0 || allShownDone} onClick={markAllShown}>Mark all shown done</button>
    {serviceId !== "all" && serviceId !== "veh" && serviceTasks.length > 0
      ? <TaskGroup title={currentServiceName + " Tasks"} subtitle={"Service-specific checklist"} tasks={serviceTasks} state={state} toggleTask={toggleTask} />
      : <>
          <TaskGroup title="Start of Day" subtitle="Before 8am - vehicle / general" tasks={startTasks} state={state} toggleTask={toggleTask} />
          <TaskGroup title="End of Day" subtitle="Before 4pm - vehicle / general" tasks={endTasks} state={state} toggleTask={toggleTask} />
          {otherVehTasks.length > 0 && <TaskGroup title="Vehicle / General" subtitle="No time assigned" tasks={otherVehTasks} state={state} toggleTask={toggleTask} />}
          {packTasks.length > 0 && <TaskGroup title="Service packing list" subtitle="Job-specific checklist - not required for daily points" tasks={packTasks} state={state} toggleTask={toggleTask} />}
        </>
    }
    {canManage(role) && <button className="btn line block" onClick={() => openSheet({ title: "Edit task list", content: <TaskEditor state={state} saveTask={saveTask} removeTask={removeTask} /> })}>Edit task list</button>}
  </>;
}

function TaskGroup({ title, subtitle, tasks, state, toggleTask }: { title: string; subtitle: string; tasks: TruckTask[]; state: AppState; toggleTask: (taskId: string) => void }) {
  return <section className="card"><div className="sec-h"><div><h2>{title}</h2><div className="tiny muted">{subtitle}</div></div><Pill tone={tasks.length ? "neu" : "warn"}>{tasks.length}</Pill></div>{tasks.length ? tasks.map((task) => <TaskRow key={task.id} task={task} done={isTaskDone(state.taskCompletions, state.currentUserId, task)} toggleTask={toggleTask} />) : <p className="tiny muted">No tasks for this filter.</p>}</section>;
}

function MaintenanceRequestForm({ state, submitMaintenance }: { state: AppState; submitMaintenance: (targetType: MaintenanceTargetType, targetId: string, targetLabel: string, description: string) => void }) {
  const [targetType, setTargetType] = useState<MaintenanceTargetType>("truck");
  const options = targetType === "truck" ? state.trucks.map((t) => ({ id: t.id, label: t.name })) : state.tools.map((t) => ({ id: t.id, label: t.name }));
  const [targetId, setTargetId] = useState(options[0]?.id ?? "");
  const [description, setDescription] = useState("");
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
    <button className="btn primary block" disabled={!targetId || !description.trim()} onClick={() => submitMaintenance(targetType, targetId, selectedLabel, description)}>Submit request</button>
  </div>;
}

function MaintenanceRequestRow({ request, state, canResolve, respondMaintenance }: { request: MaintenanceRequest; state: AppState; canResolve: boolean; respondMaintenance: (requestId: string, note: string) => void }) {
  const [note, setNote] = useState("");
  const requester = state.users.find((item) => item.id === request.requestedBy)?.name ?? "Unknown";
  return <div className="line-item">
    <div className="mid">
      <b>{request.targetType === "truck" ? "🚛" : "🛠️"} {request.targetLabel}</b>
      <div className="tiny muted">{request.description}</div>
      <div className="tiny muted">Requested by {requester} - {new Date(request.requestedAt).toLocaleDateString("en-CA")}</div>
      {request.status === "resolved" && <div className="tiny muted">Resolved{request.responseNote ? `: ${request.responseNote}` : ""}</div>}
    </div>
    {request.status === "open" && canResolve && <div className="field-stack">
      <input className="in" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Response note (optional)" />
      <button className="btn line sm" onClick={() => respondMaintenance(request.id, note)}>Mark resolved</button>
    </div>}
  </div>;
}

function MaterialDetail({ material, role, setExactCount, saveMaterial }: { material: Material; role: Role; setExactCount: (material: Material, qty: number) => void; saveMaterial: (material: Material, includeQty?: boolean) => void }) {
  const [qty, setQty] = useState(material.qty);
  return <div><MaterialRow material={material} /><label className="fld">Exact stock count</label><input className="in" type="number" value={qty} onChange={(event) => setQty(Number(event.target.value))} disabled={!canManage(role)} /><button className="btn primary block" disabled={!canManage(role)} onClick={() => setExactCount(material, qty)}>Set exact count</button>{canManage(role) && <MaterialForm material={material} saveMaterial={saveMaterial} />}</div>;
}

function MaterialForm({ material, saveMaterial }: { material?: Material; saveMaterial: (material: Material, includeQty?: boolean) => void }) {
  const [draft, setDraft] = useState<Material>(material ?? { id: id("m"), name: "", category: "waterproofing", unit: "Unit", step: 1, pack: "", unitsPerPallet: 0, cost: 0, strictTracking: true, qty: 0, reorderPoint: 1, bin: "" });
  const set = <K extends keyof Material>(key: K, value: Material[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const setUnit = (unit: MaterialUnit) => setDraft((current) => ({ ...current, unit, step: stepForMaterialUnit(unit) }));
  return <div className="form-stack"><label className="fld">Name</label><input className="in" value={draft.name} onChange={(event) => set("name", event.target.value)} /><div className="row2"><div><label className="fld">Category</label><select className="in" value={draft.category} onChange={(event) => set("category", event.target.value as Category)}>{Object.entries(categoryLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div><div><label className="fld">Locked unit</label><select className="in" value={draft.unit} onChange={(event) => setUnit(event.target.value as MaterialUnit)}>{ALLOWED_MATERIAL_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></div></div><div className="row2"><div><label className="fld">Step</label><input className="in" readOnly value={draft.step === 0.25 ? "Quarter" : "Whole"} /></div><div><label className="fld">Bin</label><input className="in" value={draft.bin} onChange={(event) => set("bin", event.target.value)} /></div></div><label className="fld">Pack note</label><input className="in" value={draft.pack} onChange={(event) => set("pack", event.target.value)} /><div className="row2"><NumberField label="Units/pallet" value={draft.unitsPerPallet} setValue={(value) => set("unitsPerPallet", value)} /><NumberField label="Cost" value={draft.cost} setValue={(value) => set("cost", value)} step={0.01} /></div><div className="row2"><NumberField label="On hand" value={draft.qty} setValue={(value) => set("qty", value)} step={draft.step} /><NumberField label="Reorder" value={draft.reorderPoint} setValue={(value) => set("reorderPoint", value)} step={draft.step} /></div><button className="btn primary block" onClick={() => saveMaterial(draft)}>Save material</button></div>;
}

function ToolSheet({ state, role, userId, tool, saveTool }: { state: AppState; role: Role; userId: string; tool: ToolItem; saveTool: (tool: ToolItem, message?: string) => void }) {
  const [siteId, setSiteId] = useState(tool.outJob ?? state.sites[0]?.id ?? "");
  const [serviceId, setServiceId] = useState<ServiceId>(tool.outService ?? tool.serviceId);
  const [note, setNote] = useState(tool.note ?? "");
  const markCondition = (condition: ToolCondition) => saveTool({ ...tool, condition, note }, "Tool condition updated");
  const checkout = () => siteId && serviceId && saveTool({ ...tool, status: "out", outBy: userId, outJob: siteId, outService: serviceId, outTs: new Date().toISOString() }, "Checked out");
  return <div><div className="line-item"><b>Status</b><Pill tone={tool.status === "out" ? "warn" : "good"}>{tool.status}</Pill></div>{tool.battery && <div className="line-item"><b>Battery</b><Pill tone={batteryState(tool.lastCharged).key}>{batteryState(tool.lastCharged).label}</Pill></div>}<label className="fld">Job</label><select className="in" value={siteId} onChange={(event) => setSiteId(event.target.value)}>{state.sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select><label className="fld">Service</label><select className="in" value={serviceId} onChange={(event) => setServiceId(event.target.value as ServiceId)}>{state.services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select><label className="fld">Damage / repair note</label><textarea className="in" value={note} onChange={(event) => setNote(event.target.value)} /><button className="btn primary block" onClick={tool.status === "out" ? () => saveTool({ ...tool, status: "in", outBy: undefined, outJob: undefined, outService: undefined, outTs: undefined }, "Checked in") : checkout}>{tool.status === "out" ? "Check in" : "Check out"}</button>{tool.battery && <button className="btn line block" onClick={() => saveTool({ ...tool, lastCharged: new Date().toISOString() }, "Marked charged")}>Mark charged</button>}{canManage(role) && <div className="row-action"><button className="btn line sm" onClick={() => markCondition("damaged")}>Report damage</button><button className="btn line sm" onClick={() => markCondition("repair")}>Send to repair</button><button className="btn line sm" onClick={() => markCondition("good")}>Back in service</button></div>}</div>;
}

function TruckLogForm({ state, saveTruck }: { state: AppState; saveTruck: (log: Omit<TruckLog, "id" | "ts">) => void }) {
  const [truckId, setTruckId] = useState(state.trucks[0]?.id ?? "");
  const truck = state.trucks.find((item) => item.id === truckId);
  const [km, setKm] = useState(truck?.km ?? 0);
  const [siteId, setSiteId] = useState(state.sites[0]?.id ?? "");
  const [serviceId, setServiceId] = useState<ServiceId>("veh");
  const [fuelTopped, setFuelTopped] = useState(false);
  const [oilChecked, setOilChecked] = useState(false);
  const [exteriorWash, setExteriorWash] = useState(false);
  const [gasStation, setGasStation] = useState("");
  const [totalCost, setTotalCost] = useState(0);
  const [receiptPhotoName, setReceiptPhotoName] = useState("");
  const [repairs, setRepairs] = useState("");
  const [notes, setNotes] = useState("");
  return <div><label className="fld">Truck</label><select className="in" value={truckId} onChange={(event) => { setTruckId(event.target.value); setKm(state.trucks.find((item) => item.id === event.target.value)?.km ?? 0); }}>{state.trucks.map((item) => <option key={item.id} value={item.id}>{item.name} - {item.km} km</option>)}</select><NumberField label="Odometer KM" value={km} setValue={setKm} /><label className="fld">Job</label><select className="in" value={siteId} onChange={(event) => setSiteId(event.target.value)}>{state.sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select><label className="fld">Service</label><select className="in" value={serviceId} onChange={(event) => setServiceId(event.target.value as ServiceId)}>{state.services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select><label className="fld">Gas station</label><input className="in" value={gasStation} onChange={(event) => setGasStation(event.target.value)} placeholder="Station name" /><NumberField label="Total cost with GST" value={totalCost} setValue={setTotalCost} step={0.01} /><label className="fld">Receipt photo</label><ImageFilePicker accept="image/*" value={receiptPhotoName} onChange={(file) => setReceiptPhotoName(file?.name ?? "")} /><label className="check"><input type="checkbox" checked={fuelTopped} onChange={(event) => setFuelTopped(event.target.checked)} /> Fuel topped</label><label className="check"><input type="checkbox" checked={oilChecked} onChange={(event) => setOilChecked(event.target.checked)} /> Oil checked</label><label className="check"><input type="checkbox" checked={exteriorWash} onChange={(event) => setExteriorWash(event.target.checked)} /> Exterior wash</label><label className="fld">Repairs / issues</label><textarea className="in" value={repairs} onChange={(event) => setRepairs(event.target.value)} /><label className="fld">Notes</label><textarea className="in" value={notes} onChange={(event) => setNotes(event.target.value)} /><button className="btn primary block" disabled={!truckId || !siteId || !gasStation.trim() || totalCost <= 0} onClick={() => saveTruck({ truckId, km, driverId: state.currentUserId, siteId, serviceId, oilChecked, fuelTopped, gasStation: gasStation.trim(), totalCost, receiptPhotoName, exteriorWash, repairs, notes })}>Save Gas Station Check</button></div>;
}

function TaskEditor({ state, saveTask, removeTask }: { state: AppState; saveTask: (task: TruckTask) => void; removeTask: (id: string) => void }) {
  const [draft, setDraft] = useState<TruckTask>({ id: id("k"), text: "", serviceId: "veh", freq: "daily", timeOfDay: "start", requiredForDailyPoints: true });
  return <div><section className="card">{state.truckTasks.map((task) => <div className="line-item" key={task.id}><span>{task.text}</span><span className="tiny muted">{taskTimeLabel(task)}</span><button className="btn line sm" onClick={() => setDraft(task)}>Edit</button><button className="btn line sm" onClick={() => removeTask(task.id)}>Delete</button></div>)}</section><label className="fld">Task</label><input className="in" value={draft.text} onChange={(event) => setDraft((current) => ({ ...current, text: event.target.value }))} /><div className="row2"><select className="in" value={draft.serviceId} onChange={(event) => setDraft((current) => ({ ...current, serviceId: event.target.value as ServiceId }))}>{state.services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select><select className="in" value={draft.freq} onChange={(event) => setDraft((current) => ({ ...current, freq: event.target.value as TaskFrequency }))}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></div><div className="row2"><select className="in" value={draft.timeOfDay ?? ""} onChange={(event) => setDraft((current) => ({ ...current, timeOfDay: (event.target.value || undefined) as TruckTask["timeOfDay"] }))}><option value="">No time</option><option value="start">Start of Day</option><option value="end">End of Day</option><option value="pack_list">Service packing list</option><option value="job_start">Job start</option><option value="job_completion">Job completion</option></select><label className="check"><input type="checkbox" checked={draft.requiredForDailyPoints !== false} onChange={(event) => setDraft((current) => ({ ...current, requiredForDailyPoints: event.target.checked }))} /> Counts for daily points</label></div><button className="btn primary block" onClick={() => saveTask(draft)}>Save task</button></div>;
}

function taskTimeLabel(task: TruckTask) {
  if (task.timeOfDay === "start") return "Start of Day";
  if (task.timeOfDay === "end") return "End of Day";
  if (task.timeOfDay === "pack_list") return "Packing list";
  if (task.timeOfDay === "job_start") return "Job start";
  if (task.timeOfDay === "job_completion") return "Job completion";
  return "No time";
}
