import { useState } from "react";
import { categoryLabels } from "../data/seed";
import { stockStatus } from "../domain/business";
import type { AppState, DailyLog, Material } from "../types";
import { Pill, serviceName, siteName, userName } from "../App";

function printInventoryLog(state: AppState, list: Material[], label: string) {
  const html = `<!doctype html><html><head><title>Inventory Log</title><style>body{font-family:Arial;padding:28px;color:#132135}.top{display:flex;justify-content:space-between;border-bottom:3px solid #0b6ea8;padding-bottom:14px}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:16px}th,td{border-bottom:1px solid #e2e8f1;padding:8px;text-align:left}</style></head><body><div class="top"><div><h1>Inventory Log</h1><p>Waterproofing+ · ${label} · ${new Date().toLocaleDateString("en-CA")}</p></div></div><table><thead><tr><th>Material</th><th>Category</th><th>Bin</th><th>On hand</th><th>Unit</th><th>Reorder at</th><th>Status</th></tr></thead><tbody>${list.map((material) => `<tr><td>${material.name}</td><td>${categoryLabels[material.category]}</td><td>${material.bin}</td><td>${material.qty}</td><td>${material.unit}</td><td>${material.reorderPoint}</td><td>${stockStatus(material).label}</td></tr>`).join("")}</tbody></table><script>window.onload=function(){setTimeout(function(){window.print()},250)}</script></body></html>`;
  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}

function printDailyLogs(state: AppState, list: DailyLog[]) {
  const html = `<!doctype html><html><head><title>Daily Logs</title><style>body{font-family:Arial;padding:28px;color:#132135}.top{border-bottom:3px solid #0b6ea8;padding-bottom:14px}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:16px}th,td{border-bottom:1px solid #e2e8f1;padding:8px;text-align:left;vertical-align:top}</style></head><body><div class="top"><h1>Daily Logs</h1><p>Waterproofing+ · ${new Date().toLocaleDateString("en-CA")}</p></div><table><thead><tr><th>Date</th><th>Job</th><th>Service</th><th>Completed by</th><th>Materials installed</th><th>Work completed</th><th>Challenges</th><th>To do next time</th></tr></thead><tbody>${list.map((log) => `<tr><td>${log.date}</td><td>${siteName(state, log.siteId)}</td><td>${serviceName(state, log.serviceId)}</td><td>${userName(state, log.completedByUserId)}</td><td>${log.materialsInstalled ?? ""}</td><td>${log.workCompleted}</td><td>${log.challenges ?? ""}</td><td>${log.toDoNextTime}</td></tr>`).join("")}</tbody></table><script>window.onload=function(){setTimeout(function(){window.print()},250)}</script></body></html>`;
  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}

function Chip({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return <button className={`chip ${on ? "on" : ""}`} onClick={onClick}>{children}</button>;
}

export default function CfoTabBoundary({ state }: { state: AppState }) {
  const [section, setSection] = useState<"inventory" | "tremco" | "log">("inventory");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const inventoryList = state.materials.filter((material) => !material.isTremco && (category === "all" || category === material.category) && (!query || material.name.toLowerCase().includes(query.toLowerCase())));
  const tremcoList = state.materials.filter((material) => material.isTremco && (!query || material.name.toLowerCase().includes(query.toLowerCase())));
  const dailyLogs = state.dailyLogs;

  return <>
    <div className="seg inv-segments">
      <button className={section === "inventory" ? "on" : ""} onClick={() => setSection("inventory")}>Inventory Log</button>
      <button className={section === "tremco" ? "on" : ""} onClick={() => setSection("tremco")}>Tremco Log</button>
      <button className={section === "log" ? "on" : ""} onClick={() => setSection("log")}>Daily Log</button>
    </div>

    {section === "inventory" && <>
      <div className="search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search material or bin" /></div>
      <div className="chips"><Chip on={category === "all"} onClick={() => setCategory("all")}>All {state.materials.filter((m) => !m.isTremco).length}</Chip>{Object.entries(categoryLabels).map(([key, label]) => <Chip key={key} on={category === key} onClick={() => setCategory(key)}>{label}</Chip>)}</div>
      <section className="card">{inventoryList.map((material) => { const status = stockStatus(material); return <div className="line-item" key={material.id}><div className="mid"><b>{material.name}</b><div className="tiny muted">{material.bin} · {material.unit}</div></div><div><span>{material.qty}</span><Pill tone={status.key}>{status.label}</Pill></div></div>; })}</section>
      <button className="btn line block" onClick={() => printInventoryLog(state, inventoryList, "All materials")}>Export Inventory Log</button>
    </>}

    {section === "tremco" && <>
      <div className="search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Tremco item" /></div>
      <section className="card">{tremcoList.length ? tremcoList.map((material) => { const status = stockStatus(material); return <div className="line-item" key={material.id}><div className="mid"><b>{material.name}</b><div className="tiny muted">{material.bin} · {material.unit}</div></div><div><span>{material.qty}</span><Pill tone={status.key}>{status.label}</Pill></div></div>; }) : <p className="tiny muted">No Tremco items flagged yet.</p>}</section>
      {tremcoList.length > 0 && <button className="btn line block" onClick={() => printInventoryLog(state, tremcoList, "Tremco")}>Export Tremco Log</button>}
    </>}

    {section === "log" && <>
      <section className="card">{dailyLogs.length ? dailyLogs.map((log) => <div className="line-item" key={log.id}><div className="mid"><b>{siteName(state, log.siteId)}</b><div className="tiny muted">{log.date} · {serviceName(state, log.serviceId)} · {userName(state, log.completedByUserId)}</div><div className="tiny muted">{log.workCompleted}</div></div></div>) : <p className="tiny muted">No daily logs yet.</p>}</section>
      {dailyLogs.length > 0 && <button className="btn line block" onClick={() => printDailyLogs(state, dailyLogs)}>Export Daily Log</button>}
    </>}
  </>;
}
