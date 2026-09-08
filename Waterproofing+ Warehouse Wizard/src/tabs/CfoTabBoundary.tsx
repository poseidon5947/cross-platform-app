import { useState } from "react";
import { money, stockStatus } from "../domain/business";
import type { AppState, DailyLog, Transaction } from "../types";
import { Pill, serviceName, siteName, userName } from "../App";

function printTransactionLog(state: AppState, list: Transaction[], title: string, month: string) {
  const html = `<!doctype html><html><head><title>${title}</title><style>body{font-family:Arial;padding:28px;color:#132135}.top{display:flex;justify-content:space-between;border-bottom:3px solid #0b6ea8;padding-bottom:14px}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:16px}th,td{border-bottom:1px solid #e2e8f1;padding:8px;text-align:left}</style></head><body><div class="top"><div><h1>${title}</h1><p>Waterproofing+ · ${month || "All dates"} · printed ${new Date().toLocaleDateString("en-CA")}</p></div></div><table><thead><tr><th>Date</th><th>Item</th><th>Action</th><th>Qty</th><th>Unit cost</th><th>Value</th><th>Job</th><th>Crew</th></tr></thead><tbody>${list.map((tx) => { const material = state.materials.find((item) => item.id === tx.materialId); const label = tx.needsReview ? `${tx.rawItemText ?? "Unresolved item"} (needs review)` : material?.name ?? ""; return `<tr><td>${tx.ts.slice(0, 10)}</td><td>${label}</td><td>${tx.type}</td><td>${tx.qty || tx.rawQtyText || ""} ${material?.unit ?? tx.rawUnitText ?? ""}</td><td>${material ? money(material.cost) : ""}</td><td>${material ? money(material.cost * tx.qty) : ""}</td><td>${siteName(state, tx.siteId)}</td><td>${userName(state, tx.userId)}</td></tr>`; }).join("")}</tbody></table><script>window.onload=function(){setTimeout(function(){window.print()},250)}</script></body></html>`;
  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}

function printDailyLogs(state: AppState, list: DailyLog[], month: string) {
  const html = `<!doctype html><html><head><title>Daily Logs</title><style>body{font-family:Arial;padding:28px;color:#132135}.top{border-bottom:3px solid #0b6ea8;padding-bottom:14px}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:16px}th,td{border-bottom:1px solid #e2e8f1;padding:8px;text-align:left;vertical-align:top}</style></head><body><div class="top"><h1>Daily Logs</h1><p>Waterproofing+ · ${month || "All dates"} · printed ${new Date().toLocaleDateString("en-CA")}</p></div><table><thead><tr><th>Date</th><th>Job</th><th>Service</th><th>Completed by</th><th>Materials installed</th><th>Work completed</th><th>Challenges</th><th>To do next time</th></tr></thead><tbody>${list.map((log) => `<tr><td>${log.date}</td><td>${siteName(state, log.siteId)}</td><td>${serviceName(state, log.serviceId)}</td><td>${userName(state, log.completedByUserId)}</td><td>${log.materialsInstalled ?? ""}</td><td>${log.workCompleted}</td><td>${log.challenges ?? ""}</td><td>${log.toDoNextTime}</td></tr>`).join("")}</tbody></table><script>window.onload=function(){setTimeout(function(){window.print()},250)}</script></body></html>`;
  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}

function MonthPicker({ month, setMonth }: { month: string; setMonth: (value: string) => void }) {
  return <div className="field-stack"><label className="fld">Month</label><input className="in" type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></div>;
}

export default function CfoTabBoundary({ state }: { state: AppState }) {
  const [section, setSection] = useState<"inventory" | "tremco" | "log">("inventory");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const inMonth = (dateStr: string) => !month || dateStr.slice(0, 7) === month;

  const inventoryTx = state.transactions.filter((tx) => { const material = state.materials.find((item) => item.id === tx.materialId); return (!tx.needsReview ? !material?.isTremco : true) && inMonth(tx.ts); });
  const tremcoTx = state.transactions.filter((tx) => { const material = state.materials.find((item) => item.id === tx.materialId); return material?.isTremco && inMonth(tx.ts); });
  const monthLogs = state.dailyLogs.filter((log) => inMonth(log.date));
  const tremcoOnHand = state.materials.filter((material) => material.isTremco);

  return <>
    <div className="seg inv-segments">
      <button className={section === "inventory" ? "on" : ""} onClick={() => setSection("inventory")}>Inventory Log</button>
      <button className={section === "tremco" ? "on" : ""} onClick={() => setSection("tremco")}>Tremco Log</button>
      <button className={section === "log" ? "on" : ""} onClick={() => setSection("log")}>Daily Log</button>
    </div>
    <MonthPicker month={month} setMonth={setMonth} />

    {section === "inventory" && <>
      <section className="card">{inventoryTx.length ? inventoryTx.map((tx) => { const material = state.materials.find((item) => item.id === tx.materialId); return <div className="line-item" key={tx.id}><div className="mid"><b>{tx.needsReview ? (tx.rawItemText ?? "Unresolved item") : (material?.name ?? "")}</b><div className="tiny muted">{tx.ts.slice(0, 10)} · {tx.type} · {siteName(state, tx.siteId)}</div></div><span>{tx.qty || tx.rawQtyText || ""} {material?.unit ?? tx.rawUnitText ?? ""}</span></div>; }) : <p className="tiny muted">No inventory activity for this month.</p>}</section>
      {inventoryTx.length > 0 && <button className="btn line block" onClick={() => printTransactionLog(state, inventoryTx, "Inventory Log", month)}>Export Inventory Log</button>}
    </>}

    {section === "tremco" && <>
      <section className="card"><h3>Current on hand</h3>{tremcoOnHand.length ? tremcoOnHand.map((material) => { const status = stockStatus(material); return <div className="line-item" key={material.id}><div className="mid"><b>{material.name}</b><div className="tiny muted">{material.bin} · {material.unit}</div></div><div><span>{material.qty}</span><Pill tone={status.key}>{status.label}</Pill></div></div>; }) : <p className="tiny muted">No Tremco items flagged yet.</p>}</section>
      <section className="card"><h3>Activity this month</h3>{tremcoTx.length ? tremcoTx.map((tx) => { const material = state.materials.find((item) => item.id === tx.materialId); return <div className="line-item" key={tx.id}><div className="mid"><b>{material?.name ?? ""}</b><div className="tiny muted">{tx.ts.slice(0, 10)} · {tx.type} · {siteName(state, tx.siteId)}</div></div><span>{tx.qty} {material?.unit}</span></div>; }) : <p className="tiny muted">No Tremco activity for this month.</p>}</section>
      {tremcoTx.length > 0 && <button className="btn line block" onClick={() => printTransactionLog(state, tremcoTx, "Tremco Log", month)}>Export Tremco Log</button>}
    </>}

    {section === "log" && <>
      <section className="card">{monthLogs.length ? monthLogs.map((log) => <div className="line-item" key={log.id}><div className="mid"><b>{siteName(state, log.siteId)}</b><div className="tiny muted">{log.date} · {serviceName(state, log.serviceId)} · {userName(state, log.completedByUserId)}</div><div className="tiny muted">{log.workCompleted}</div></div></div>) : <p className="tiny muted">No daily logs for this month.</p>}</section>
      {monthLogs.length > 0 && <button className="btn line block" onClick={() => printDailyLogs(state, monthLogs, month)}>Export Daily Log</button>}
    </>}
  </>;
}
