import { useEffect, useMemo, useState } from "react";
import { ALLOWED_MATERIAL_UNITS, money, monthlyInventoryLogCsv, stockStatus } from "../domain/business";
import type { AppState, DailyLog, MaterialUnit, Transaction } from "../types";
import { Pill, serviceName, siteName, userName } from "../App";

function printTransactionLog(state: AppState, list: Transaction[], title: string, month: string) {
  const html = `<!doctype html><html><head><title>${title}</title><style>body{font-family:Arial;padding:28px;color:#132135}.top{display:flex;justify-content:space-between;border-bottom:3px solid #0b6ea8;padding-bottom:14px}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:16px}th,td{border-bottom:1px solid #e2e8f1;padding:8px;text-align:left}</style></head><body><div class="top"><div><h1>${title}</h1><p>Waterproofing+ · ${month || "All dates"} · printed ${new Date().toLocaleDateString("en-CA")}</p></div></div><table><thead><tr><th>Date</th><th>Item</th><th>Action</th><th>Qty</th><th>Unit cost</th><th>Value</th><th>Job</th><th>Crew</th></tr></thead><tbody>${list.map((tx) => { const material = state.materials.find((item) => item.id === tx.materialId); const label = tx.needsReview ? `${tx.rawItemText ?? "Unresolved item"} (needs review)` : material?.name ?? ""; const qtyLabel = tx.needsReview ? (tx.rawQtyText ?? "") : tx.qty; return `<tr><td>${tx.ts.slice(0, 10)}</td><td>${label}</td><td>${tx.type}</td><td>${qtyLabel} ${material?.unit ?? tx.rawUnitText ?? ""}</td><td>${material ? money(material.cost) : ""}</td><td>${material ? money(material.cost * tx.qty) : ""}</td><td>${siteName(state, tx.siteId)}</td><td>${userName(state, tx.userId)}</td></tr>`; }).join("")}</tbody></table><script>window.onload=function(){setTimeout(function(){window.print()},250)}</script></body></html>`;
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

function NeedsReviewRow({ tx, state, resolveTransaction }: { tx: Transaction; state: AppState; resolveTransaction: (transactionId: string, materialId: string, qty: number, unit?: MaterialUnit) => void }) {
  const [materialId, setMaterialId] = useState("");
  const [qty, setQty] = useState(tx.rawQtyText ?? "");
  const [unit, setUnit] = useState<MaterialUnit | "">("");
  return <div className="needs-review-row">
    <div className="mid">
      <b>{tx.rawItemText ?? "Unlabeled item"}</b>
      <div className="tiny muted">{new Date(tx.ts).toLocaleDateString("en-CA")} · {siteName(state, tx.siteId)} · {userName(state, tx.userId)} · raw qty: {tx.rawQtyText ?? "—"} {tx.rawUnitText ?? ""}</div>
    </div>
    <select className="in" value={materialId} onChange={(event) => setMaterialId(event.target.value)}>
      <option value="">Pick the real item…</option>
      {state.materials.map((material) => <option key={material.id} value={material.id}>{material.name}</option>)}
    </select>
    <div className="needs-review-qty-row">
      <input className="in" type="number" step="any" value={qty} onChange={(event) => setQty(event.target.value)} placeholder="Qty" />
      <select className="in" value={unit} onChange={(event) => setUnit(event.target.value as MaterialUnit)}>
        <option value="">Unit (optional note)</option>
        {ALLOWED_MATERIAL_UNITS.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </div>
    <button className="btn primary block" disabled={!materialId || !qty || Number(qty) <= 0} onClick={() => resolveTransaction(tx.id, materialId, Number(qty), unit || undefined)}>Resolve</button>
  </div>;
}

function transactionsCsv(state: AppState) {
  const head = "Date,Material,Action,Site,Service,Crew,Qty,Unit,UnitCost,Value";
  const rows = state.transactions.map((tx) => {
    const material = state.materials.find((item) => item.id === tx.materialId);
    return [tx.ts, material?.name, tx.type, siteName(state, tx.siteId), serviceName(state, tx.serviceId), userName(state, tx.userId), tx.qty, material?.unit, material?.cost ?? 0, (material?.cost ?? 0) * tx.qty].map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",");
  });
  return [head, ...rows].join("\n");
}

function printReport(state: AppState) {
  const rows = state.transactions;
  const used = rows.filter((tx) => ["use", "deliver"].includes(tx.type)).reduce((sum, tx) => sum + tx.qty * (state.materials.find((m) => m.id === tx.materialId)?.cost ?? 0), 0);
  const losses = rows.filter((tx) => tx.type === "loss").reduce((sum, tx) => sum + tx.qty * (state.materials.find((m) => m.id === tx.materialId)?.cost ?? 0), 0);
  const html = `<!doctype html><html><head><title>Materials Cost Report</title><style>body{font-family:Arial;padding:28px;color:#132135}.top{display:flex;justify-content:space-between;border-bottom:3px solid #0b6ea8;padding-bottom:14px}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:18px 0}.c{border:1px solid #e2e8f1;border-radius:12px;padding:12px}.v{font-size:22px;font-weight:800}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border-bottom:1px solid #e2e8f1;padding:8px;text-align:left}</style></head><body><div class="top"><div><h1>Materials Cost Report</h1><p>Waterproofing+ · ${new Date().toLocaleDateString("en-CA")}</p></div><p>Prepared for CFO<br>GST 5% · CAD</p></div><div class="cards"><div class="c"><div>Materials consumed</div><div class="v">${money(used)}</div></div><div class="c"><div>Losses</div><div class="v">${money(losses)}</div></div><div class="c"><div>Transactions</div><div class="v">${rows.length}</div></div></div><table><thead><tr><th>Date</th><th>Material</th><th>Action</th><th>Site</th><th>Crew</th><th>Qty</th><th>Value</th></tr></thead><tbody>${rows.map((tx) => { const material = state.materials.find((item) => item.id === tx.materialId); return `<tr><td>${new Date(tx.ts).toLocaleDateString("en-CA")}</td><td>${material?.name ?? ""}</td><td>${tx.type}</td><td>${siteName(state, tx.siteId)}</td><td>${userName(state, tx.userId)}</td><td>${tx.qty} ${material?.unit ?? ""}</td><td>${money((material?.cost ?? 0) * tx.qty)}</td></tr>`; }).join("")}</tbody></table><script>window.onload=function(){setTimeout(function(){window.print()},250)}</script></body></html>`;
  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}

export default function CfoTabBoundary({ state, resolveTransaction, focusTarget, onFocusHandled }: { state: AppState; resolveTransaction: (transactionId: string, materialId: string, qty: number, unit?: MaterialUnit) => void; focusTarget?: string | null; onFocusHandled?: () => void }) {
  const [section, setSection] = useState<"inventory" | "tremco" | "log">("inventory");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const inMonth = (dateStr: string) => !month || dateStr.slice(0, 7) === month;

  useEffect(() => {
    if (!focusTarget) return;
    const targetId = focusTarget === "needs-review" ? "wz-section-needs-review" : focusTarget === "exports" ? "wz-section-exports" : null;
    if (targetId) requestAnimationFrame(() => document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" }));
    onFocusHandled?.();
  }, [focusTarget]);

  const inventoryTx = state.transactions.filter((tx) => { const material = state.materials.find((item) => item.id === tx.materialId); return (!tx.needsReview ? !material?.isTremco : true) && inMonth(tx.ts); });
  const tremcoTx = state.transactions.filter((tx) => { const material = state.materials.find((item) => item.id === tx.materialId); return material?.isTremco && inMonth(tx.ts); });
  const monthLogs = state.dailyLogs.filter((log) => inMonth(log.date));
  const tremcoOnHand = state.materials.filter((material) => material.isTremco);

  const needsReview = state.transactions.filter((tx) => tx.needsReview);
  const csv = useMemo(() => transactionsCsv(state), [state]);
  const [exportMonth, setExportMonth] = useState(new Date().toISOString().slice(0, 7));
  const monthlyCsv = useMemo(() => monthlyInventoryLogCsv(state, exportMonth), [state, exportMonth]);

  return <>
    <div className="seg inv-segments">
      <button className={section === "inventory" ? "on" : ""} onClick={() => setSection("inventory")}>Inventory Log</button>
      <button className={section === "tremco" ? "on" : ""} onClick={() => setSection("tremco")}>Tremco Log</button>
      <button className={section === "log" ? "on" : ""} onClick={() => setSection("log")}>Daily Log</button>
    </div>
    <MonthPicker month={month} setMonth={setMonth} />

    {section === "inventory" && <>
      <section className="card">{inventoryTx.length ? inventoryTx.map((tx) => { const material = state.materials.find((item) => item.id === tx.materialId); const qtyLabel = tx.needsReview ? (tx.rawQtyText ?? "") : tx.qty; return <div className="line-item" key={tx.id}><div className="mid"><b>{tx.needsReview ? (tx.rawItemText ?? "Unresolved item") : (material?.name ?? "")}</b><div className="tiny muted">{tx.ts.slice(0, 10)} · {tx.type} · {siteName(state, tx.siteId)}</div></div><span>{qtyLabel} {material?.unit ?? tx.rawUnitText ?? ""}</span></div>; }) : <p className="tiny muted">No inventory activity for this month.</p>}</section>
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

    <section className="card wide" id="wz-section-needs-review">
      <div className="sec-h"><div><h3>Needs review</h3><p className="tiny muted">Imported or messy log entries where the item, quantity, or unit wasn't clear. Fix by the 10th of every month.</p></div><Pill tone={needsReview.length ? "warn" : "good"}>{needsReview.length}</Pill></div>
      {needsReview.length ? needsReview.map((tx) => <NeedsReviewRow key={tx.id} tx={tx} state={state} resolveTransaction={resolveTransaction} />) : <p className="tiny muted">Nothing needs review.</p>}
    </section>

    <section className="card" id="wz-section-exports">
      <h3>Exports</h3>
      <p className="tiny muted">Cost report can be printed to PDF by your browser. BuilderTrend remains a CSV/PDF export stub.</p>
      <button className="btn line block" onClick={() => printReport(state)}>Print cost report</button>
      <button className="btn line block" onClick={() => navigator.clipboard?.writeText(csv)}>Copy transactions CSV</button>
      <label className="fld">Monthly Inventory Log</label>
      <input className="in" type="month" value={exportMonth} onChange={(event) => setExportMonth(event.target.value)} />
      <button className="btn line block" onClick={() => navigator.clipboard?.writeText(monthlyCsv)}>Copy Monthly Inventory Log CSV</button>
    </section>
  </>;
}
