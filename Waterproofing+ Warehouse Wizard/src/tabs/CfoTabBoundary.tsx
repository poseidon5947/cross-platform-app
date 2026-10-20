import { useEffect, useMemo, useState } from "react";
import { ALLOWED_MATERIAL_UNITS, canSeeEverything, companionMaterial, formatDate, formatDateTime, money, monthlyInventoryLogCsv, stockStatus, suggestReviewSplit, transactionReportLabel } from "../domain/business";
import type { ReviewSplitPiece } from "../domain/business";
import type { AppState, DailyLog, MaterialUnit, Role, Transaction } from "../types";
import { canManage, Pill, serviceName, siteName, userName } from "../App";

function printTransactionLog(state: AppState, list: Transaction[], title: string, month: string) {
  const html = `<!doctype html><html><head><title>${title}</title><style>body{font-family:Arial;padding:28px;color:#132135}.top{display:flex;justify-content:space-between;border-bottom:3px solid #0b6ea8;padding-bottom:14px}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:16px}th,td{border-bottom:1px solid #e2e8f1;padding:8px;text-align:left}</style></head><body><div class="top"><div><h1>${title}</h1><p>Waterproofing+ · ${month || "All dates"} · printed ${formatDate(new Date())}</p></div></div><table><thead><tr><th>Date &amp; time</th><th>Item</th><th>Action</th><th>Qty</th><th>Unit cost</th><th>Value</th><th>Job</th><th>Crew</th></tr></thead><tbody>${list.map((tx) => { const material = state.materials.find((item) => item.id === tx.materialId); const { item, status } = transactionReportLabel(tx, material?.name); const qtyLabel = material ? tx.qty : (tx.rawQtyText ?? ""); return `<tr><td>${formatDateTime(tx.ts)}</td><td>${item}${material ? "" : `<br><span style="color:#8a94a6">${status}</span>`}</td><td>${tx.type}</td><td>${qtyLabel} ${material?.unit ?? tx.rawUnitText ?? ""}</td><td>${material ? money(material.cost) : ""}</td><td>${material ? money(material.cost * tx.qty) : ""}</td><td>${siteName(state, tx.siteId)}</td><td>${userName(state, tx.userId)}</td></tr>`; }).join("")}</tbody></table><script>window.onload=function(){setTimeout(function(){window.print()},250)}</script></body></html>`;
  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}

function printDailyLogs(state: AppState, list: DailyLog[], month: string) {
  const html = `<!doctype html><html><head><title>Daily Logs</title><style>body{font-family:Arial;padding:28px;color:#132135}.top{border-bottom:3px solid #0b6ea8;padding-bottom:14px}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:16px}th,td{border-bottom:1px solid #e2e8f1;padding:8px;text-align:left;vertical-align:top}</style></head><body><div class="top"><h1>Daily Logs</h1><p>Waterproofing+ · ${month || "All dates"} · printed ${formatDate(new Date())}</p></div><table><thead><tr><th>Date</th><th>Job</th><th>Service</th><th>Completed by</th><th>Materials installed</th><th>Work completed</th><th>Weather</th><th>Challenges</th><th>To do next time</th></tr></thead><tbody>${list.map((log) => `<tr><td>${formatDate(log.date)}</td><td>${siteName(state, log.siteId)}</td><td>${serviceName(state, log.serviceId)}</td><td>${userName(state, log.completedByUserId)}</td><td>${log.materialsInstalled ?? ""}</td><td>${log.workCompleted}</td><td>${log.weather ?? ""}</td><td>${log.challenges ?? ""}</td><td>${log.toDoNextTime}</td></tr>`).join("")}</tbody></table><script>window.onload=function(){setTimeout(function(){window.print()},250)}</script></body></html>`;
  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}

function MonthPicker({ month, setMonth }: { month: string; setMonth: (value: string) => void }) {
  return <div className="field-stack"><label className="fld">Month</label><input className="in" type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></div>;
}

/**
 * Picking the product out of 166 of them.
 *
 * This was a plain dropdown, alphabetical, with no way to type. Jordan asked
 * for search, and he is right: the names are long, near-identical in places
 * ("Dymonic 100 (Black)" against "Dymoic 100 grey ssg"), and scrolling a list
 * that size on a phone is how the wrong one gets picked.
 */
function MaterialPicker({ state, value, onChange }: { state: AppState; value: string; onChange: (materialId: string) => void }) {
  const [query, setQuery] = useState("");
  const sorted = useMemo(() => [...state.materials].sort((a, b) => a.name.localeCompare(b.name)), [state.materials]);
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sorted;
    return sorted.filter((material) => material.name.toLowerCase().includes(needle));
  }, [sorted, query]);
  const chosen = state.materials.find((material) => material.id === value);
  // A filtered list that no longer holds the selection would silently clear it,
  // so the chosen product stays on the list whatever the search says.
  const options = chosen && !matches.some((material) => material.id === chosen.id) ? [chosen, ...matches] : matches;
  return <div className="field-stack">
    <input className="in" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search product names" aria-label="Search product names" />
    <select className="in" value={value} onChange={(event) => onChange(event.target.value)} size={query.trim() ? Math.min(6, Math.max(2, options.length)) : undefined}>
      <option value="">Pick the real item&hellip;</option>
      {options.map((material) => <option key={material.id} value={material.id}>{material.name}</option>)}
    </select>
    {query.trim() && <p className="tiny muted">{matches.length} of {sorted.length} products match &ldquo;{query.trim()}&rdquo;.</p>}
  </div>;
}

/**
 * One log line that names several products.
 *
 * The crew write the day's materials as a sentence - "42 360 38 950" is 42
 * pails of Vulkem 360 and 38 of Vulkem 950 - and resolving took a single
 * product, so everything after the first was dropped. The separators are
 * guessed and then edited: nothing splits until the pieces are confirmed.
 */
function SplitEditor({ tx, onSplit, onCancel }: { tx: Transaction; onSplit: (pieces: ReviewSplitPiece[]) => void; onCancel: () => void }) {
  const suggestion = useMemo(() => {
    const guess = suggestReviewSplit(tx.rawItemText ?? "", tx.rawQtyText);
    return guess.length >= 2 ? guess : [
      { rawItemText: tx.rawItemText ?? "", rawQtyText: tx.rawQtyText },
      { rawItemText: "" },
    ];
  }, [tx.rawItemText, tx.rawQtyText]);
  const [pieces, setPieces] = useState<ReviewSplitPiece[]>(suggestion);
  const set = (index: number, patch: Partial<ReviewSplitPiece>) =>
    setPieces((current) => current.map((piece, i) => (i === index ? { ...piece, ...patch } : piece)));
  const filled = pieces.filter((piece) => piece.rawItemText.trim());
  return <div className="split-editor">
    <p className="tiny muted">One row per product. Each keeps this line&rsquo;s date, job and crew member, and you name the real item on each afterwards.</p>
    {pieces.map((piece, index) => <div className="needs-review-qty-row" key={index}>
      <input className="in" value={piece.rawItemText} placeholder={`Product ${index + 1} as written`} aria-label={`Product ${index + 1} as written`}
        onChange={(event) => set(index, { rawItemText: event.target.value })} />
      <input className="in" value={piece.rawQtyText ?? ""} placeholder="Qty" aria-label={`Quantity for product ${index + 1}`}
        onChange={(event) => set(index, { rawQtyText: event.target.value })} />
      <button className="btn line sm" aria-label={`Remove product ${index + 1}`} disabled={pieces.length <= 2}
        onClick={() => setPieces((current) => current.filter((_, i) => i !== index))}>Remove</button>
    </div>)}
    <button className="btn line block" onClick={() => setPieces((current) => [...current, { rawItemText: "" }])}>Add another product</button>
    <div className="row-action">
      <button className="btn primary sm" disabled={filled.length < 2} onClick={() => onSplit(filled)}>Split into {filled.length || 2} rows</button>
      <button className="btn line sm" onClick={onCancel}>Cancel</button>
    </div>
    {filled.length < 2 && <p className="tiny muted">Name at least two products to split.</p>}
  </div>;
}

function NeedsReviewRow({ tx, state, resolveTransaction, dismissTransaction, splitTransaction }: { tx: Transaction; state: AppState; resolveTransaction: (transactionId: string, materialId: string, qty: number, unit?: MaterialUnit, companionQty?: number) => void; dismissTransaction: (transactionId: string) => void; splitTransaction: (transactionId: string, pieces: ReviewSplitPiece[]) => void }) {
  const [materialId, setMaterialId] = useState("");
  const [qty, setQty] = useState(tx.rawQtyText ?? "");
  const [unit, setUnit] = useState<MaterialUnit | "">("");
  const [splitting, setSplitting] = useState(false);
  // Pins are driven with shot. The crew log "shot and pins" and mean both, and
  // resolving the pins on their own has already left the shot unrecorded.
  const companion = materialId ? companionMaterial(state, materialId) : undefined;
  const [pairCompanion, setPairCompanion] = useState(true);
  const [companionQty, setCompanionQty] = useState("");
  const companionAmount = companionQty.trim() ? Number(companionQty) : Number(qty);
  const sendCompanion = Boolean(companion && pairCompanion && companionAmount > 0);
  return <div className="needs-review-row">
    <div className="mid">
      <b>{tx.rawItemText ?? "Unlabeled item"}</b>
      <div className="tiny muted">{formatDateTime(tx.ts)} &middot; {siteName(state, tx.siteId)} &middot; {userName(state, tx.userId)} &middot; raw qty: {tx.rawQtyText ?? "\u2014"} {tx.rawUnitText ?? ""}</div>
      {/* Imported from a back-dated log. Naming the product fixes the record;
          the stock count it sits behind has already been taken. */}
      {tx.skipStock && <div className="tiny muted">Past log &mdash; naming the item corrects the record and leaves stock on hand alone.</div>}
    </div>
    {splitting
      ? <SplitEditor tx={tx} onCancel={() => setSplitting(false)} onSplit={(pieces) => { setSplitting(false); splitTransaction(tx.id, pieces); }} />
      : <>
        <MaterialPicker state={state} value={materialId} onChange={setMaterialId} />
        <div className="needs-review-qty-row">
          <input className="in" type="number" step="any" value={qty} onChange={(event) => setQty(event.target.value)} placeholder="Qty" />
          <select className="in" value={unit} onChange={(event) => setUnit(event.target.value as MaterialUnit)}>
            <option value="">Unit (optional note)</option>
            {ALLOWED_MATERIAL_UNITS.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        {companion && <div className="companion-pair">
          <label className="check">
            <input type="checkbox" checked={pairCompanion} onChange={(event) => setPairCompanion(event.target.checked)} />
            Also record {companion.name}
          </label>
          {pairCompanion && <input className="in" type="number" step="any" value={companionQty} placeholder={qty ? `Same as above (${qty})` : "Qty"}
            aria-label={`Quantity of ${companion.name}`} onChange={(event) => setCompanionQty(event.target.value)} />}
          <p className="tiny muted">These two are fired together, so the shot is recorded on the same job and day.</p>
        </div>}
        <button className="btn primary block" disabled={!materialId || !qty || Number(qty) <= 0}
          onClick={() => resolveTransaction(tx.id, materialId, Number(qty), unit || undefined, sendCompanion ? companionAmount : undefined)}>
          {sendCompanion ? "Resolve both" : "Resolve"}
        </button>
        <button className="btn line block" onClick={() => setSplitting(true)}>This line has more than one product</button>
        <button className="btn line block" onClick={() => dismissTransaction(tx.id)}>Not a material &mdash; remove from this list</button>
      </>}
  </div>;
}

function transactionsCsv(state: AppState) {
  // Status is the last column for the same reason the monthly log carries one:
  // a row with no product used to export as a blank line with a job on it.
  const head = "Date,Material,Action,Site,Service,Crew,Qty,Unit,UnitCost,Value,Status";
  const rows = state.transactions.map((tx) => {
    const material = state.materials.find((item) => item.id === tx.materialId);
    const { item, status } = transactionReportLabel(tx, material?.name);
    return [tx.ts, item, tx.type, siteName(state, tx.siteId), serviceName(state, tx.serviceId), userName(state, tx.userId), material ? tx.qty : (tx.rawQtyText ?? ""), material?.unit ?? tx.rawUnitText ?? "", material?.cost ?? 0, (material?.cost ?? 0) * tx.qty, status].map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",");
  });
  return [head, ...rows].join("\n");
}

function printReport(state: AppState) {
  const rows = state.transactions;
  const used = rows.filter((tx) => ["use", "deliver"].includes(tx.type)).reduce((sum, tx) => sum + tx.qty * (state.materials.find((m) => m.id === tx.materialId)?.cost ?? 0), 0);
  const losses = rows.filter((tx) => tx.type === "loss").reduce((sum, tx) => sum + tx.qty * (state.materials.find((m) => m.id === tx.materialId)?.cost ?? 0), 0);
  const html = `<!doctype html><html><head><title>Materials Cost Report</title><style>body{font-family:Arial;padding:28px;color:#132135}.top{display:flex;justify-content:space-between;border-bottom:3px solid #0b6ea8;padding-bottom:14px}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:18px 0}.c{border:1px solid #e2e8f1;border-radius:12px;padding:12px}.v{font-size:22px;font-weight:800}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border-bottom:1px solid #e2e8f1;padding:8px;text-align:left}</style></head><body><div class="top"><div><h1>Materials Cost Report</h1><p>Waterproofing+ · ${formatDate(new Date())}</p></div><p>Prepared for CFO<br>GST 5% · CAD</p></div><div class="cards"><div class="c"><div>Materials consumed</div><div class="v">${money(used)}</div></div><div class="c"><div>Losses</div><div class="v">${money(losses)}</div></div><div class="c"><div>Transactions</div><div class="v">${rows.length}</div></div></div><table><thead><tr><th>Date &amp; time</th><th>Material</th><th>Action</th><th>Site</th><th>Crew</th><th>Qty</th><th>Value</th></tr></thead><tbody>${rows.map((tx) => { const material = state.materials.find((item) => item.id === tx.materialId); return `<tr><td>${formatDateTime(tx.ts)}</td><td>${material?.name ?? ""}</td><td>${tx.type}</td><td>${siteName(state, tx.siteId)}</td><td>${userName(state, tx.userId)}</td><td>${tx.qty} ${material?.unit ?? ""}</td><td>${money((material?.cost ?? 0) * tx.qty)}</td></tr>`; }).join("")}</tbody></table><script>window.onload=function(){setTimeout(function(){window.print()},250)}</script></body></html>`;
  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}

export default function CfoTabBoundary({ state, role, resolveTransaction, dismissTransaction, splitTransaction, focusTarget, onFocusHandled }: { state: AppState; role: Role; resolveTransaction: (transactionId: string, materialId: string, qty: number, unit?: MaterialUnit, companionQty?: number) => void; dismissTransaction: (transactionId: string) => void; splitTransaction: (transactionId: string, pieces: ReviewSplitPiece[]) => void; focusTarget?: string | null; onFocusHandled?: () => void }) {
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

  const needsReview = state.transactions.filter((tx) => tx.needsReview && !tx.reviewDismissedAt);
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
      <section className="card">{inventoryTx.length ? inventoryTx.map((tx) => { const material = state.materials.find((item) => item.id === tx.materialId); const qtyLabel = tx.needsReview ? (tx.rawQtyText ?? "") : tx.qty; return <div className="line-item" key={tx.id}><div className="mid"><b>{tx.needsReview ? (tx.rawItemText ?? "Unresolved item") : (material?.name ?? "")}</b><div className="tiny muted">{formatDateTime(tx.ts)} · {tx.type} · {siteName(state, tx.siteId)}</div></div><span>{qtyLabel} {material?.unit ?? tx.rawUnitText ?? ""}</span></div>; }) : <p className="tiny muted">No inventory activity for this month.</p>}</section>
      {inventoryTx.length > 0 && <button className="btn line block" onClick={() => printTransactionLog(state, inventoryTx, "Inventory Log", month)}>Export Inventory Log</button>}
    </>}

    {section === "tremco" && <>
      <section className="card"><h3>Current on hand</h3>{tremcoOnHand.length ? tremcoOnHand.map((material) => { const status = stockStatus(material); return <div className="line-item" key={material.id}><div className="mid"><b>{material.name}</b><div className="tiny muted">{material.bin} · {material.unit}</div></div><div><span>{material.qty}</span><Pill tone={status.key}>{status.label}</Pill></div></div>; }) : <p className="tiny muted">No Tremco items flagged yet.</p>}</section>
      <section className="card"><h3>Activity this month</h3>{tremcoTx.length ? tremcoTx.map((tx) => { const material = state.materials.find((item) => item.id === tx.materialId); return <div className="line-item" key={tx.id}><div className="mid"><b>{material?.name ?? ""}</b><div className="tiny muted">{formatDateTime(tx.ts)} · {tx.type} · {siteName(state, tx.siteId)}</div></div><span>{tx.qty} {material?.unit}</span></div>; }) : <p className="tiny muted">No Tremco activity for this month.</p>}</section>
      {tremcoTx.length > 0 && <button className="btn line block" onClick={() => printTransactionLog(state, tremcoTx, "Tremco Log", month)}>Export Tremco Log</button>}
    </>}

    {section === "log" && <>
      <section className="card">{monthLogs.length ? monthLogs.map((log) => <div className="line-item" key={log.id}><div className="mid"><b>{siteName(state, log.siteId)}</b><div className="tiny muted">{formatDate(log.date)} · {serviceName(state, log.serviceId)} · {userName(state, log.completedByUserId)}</div><div className="tiny muted">{log.workCompleted}</div></div></div>) : <p className="tiny muted">No daily logs for this month.</p>}</section>
      {monthLogs.length > 0 && <button className="btn line block" onClick={() => printDailyLogs(state, monthLogs, month)}>Export Daily Log</button>}
    </>}

    {canSeeEverything(role) && <section className="card wide" id="wz-section-needs-review">
      <div className="sec-h"><div><h3>Needs review</h3><p className="tiny muted">Imported or messy log entries where the item, quantity, or unit wasn't clear. Fix by the 10th of every month.</p></div><Pill tone={needsReview.length ? "warn" : "good"}>{needsReview.length}</Pill></div>
      {needsReview.length ? needsReview.map((tx) => <NeedsReviewRow key={tx.id} tx={tx} state={state} resolveTransaction={resolveTransaction} dismissTransaction={dismissTransaction} splitTransaction={splitTransaction} />) : <p className="tiny muted">Nothing needs review.</p>}
    </section>}

    <section className="card" id="wz-section-exports">
      <h3>Exports</h3>
      <p className="tiny muted">Cost report can be printed to PDF by your browser. The transactions CSV opens in Excel or Google Sheets.</p>
      <button className="btn line block" onClick={() => printReport(state)}>Print cost report</button>
      <button className="btn line block" onClick={() => navigator.clipboard?.writeText(csv)}>Copy transactions CSV</button>
      <label className="fld">Monthly Inventory Log</label>
      <input className="in" type="month" value={exportMonth} onChange={(event) => setExportMonth(event.target.value)} />
      <button className="btn line block" onClick={() => navigator.clipboard?.writeText(monthlyCsv)}>Copy Monthly Inventory Log CSV</button>
    </section>
  </>;
}
