import { useMemo, useState } from "react";
import { validateMaterialsCsv } from "../data/csvImport";
import { invokeMaterialsImport, invokeQuickBooksConnect, invokeQuickBooksSync } from "../data/repo";
import { money, monthlyInventoryLogCsv, priceChangeMaterials, reorderEstimate } from "../domain/business";
import type { Theme } from "../themes";
import type { AppState, Material, Role, ServiceId } from "../types";
import { canAdmin, canManage, Pill, serviceName, siteName, userName } from "../App";

export default function AdminTabBoundary({ state, role, notify, remoteMode, saveMaterial, currentTheme, onThemeChange, openThemeEditor }: {
  state: AppState;
  role: Role;
  notify: (message: string) => void;
  remoteMode: boolean;
  saveMaterial: (material: Material, includeQty?: boolean) => void;
  currentTheme: Theme;
  onThemeChange: (theme: Theme) => void;
  openThemeEditor: () => void;
}) {
  return <Admin state={state} role={role} notify={notify} remoteMode={remoteMode} saveMaterial={saveMaterial} currentTheme={currentTheme} onThemeChange={onThemeChange} openThemeEditor={openThemeEditor} />;
}

function transactionsCsv(state: AppState) {
  const head = "Date,Material,Action,Site,Service,Crew,Qty,Unit,UnitCost,Value";
  const rows = state.transactions.map((tx) => {
    const material = state.materials.find((item) => item.id === tx.materialId);
    return [tx.ts, material?.name, tx.type, siteName(state, tx.siteId), serviceName(state, tx.serviceId), userName(state, tx.userId), tx.qty, material?.unit, material?.cost ?? 0, (material?.cost ?? 0) * tx.qty].map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",");
  });
  return [head, ...rows].join("\n");
}

function buildPoText(state: AppState) {
  const estimate = reorderEstimate(state.materials);
  return estimate.lines.map((line) => {
    const material = state.materials.find((item) => item.id === line.materialId);
    return `${material?.name}: ${line.suggestedQty} ${material?.unit} (${line.pallets || "case/loose"} pallets) - ${money(line.lineCost)}`;
  }).concat([`Subtotal ${money(estimate.subtotal)}`, `GST ${money(estimate.gst)}`, `Freight ${money(estimate.freight)}`, `Total ${money(estimate.total)}`]).join("\n");
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

function Admin({ state, role, notify, remoteMode, saveMaterial, currentTheme, onThemeChange, openThemeEditor }: { state: AppState; role: Role; notify: (message: string) => void; remoteMode: boolean; saveMaterial: (material: Material, includeQty?: boolean) => void; currentTheme: Theme; onThemeChange: (theme: Theme) => void; openThemeEditor: () => void }) {
  const estimate = reorderEstimate(state.materials);
  const csv = useMemo(() => transactionsCsv(state), [state]);
  const [exportMonth, setExportMonth] = useState(new Date().toISOString().slice(0, 7));
  const monthlyCsv = useMemo(() => monthlyInventoryLogCsv(state, exportMonth), [state, exportMonth]);
  const priceChanges = priceChangeMaterials(state.materials);
  const [report, setReport] = useState<string>(() => priceChanges.length ? `${priceChanges.length} price change${priceChanges.length === 1 ? "" : "s"} active` : "");
  if (!canManage(role)) return <section className="card">Manager or Admin access required.</section>;
  const upload = async (file?: File) => {
    if (!file) return;
    if (remoteMode) {
      const result = await invokeMaterialsImport(file);
      setReport(`${result.imported} imported; ${result.skipped.length} skipped`);
    } else {
      const result = validateMaterialsCsv(await file.text(), state.materials);
      result.materials.forEach((material) => saveMaterial(material, false));
      setReport(`${result.imported} imported; ${result.skipped.length} skipped`);
    }
  };
  return <div className="admin-grid"><section className="card"><h3>Theme Customization</h3><p className="tiny muted">Choose from 6 preset themes or create your own custom color scheme. Changes apply instantly.</p><div className="theme-preview"><span className="theme-name">{currentTheme.name}</span><div className="theme-colors"><span className="color-dot" style={{ background: currentTheme.colors.primary }} /><span className="color-dot" style={{ background: currentTheme.colors.amber }} /><span className="color-dot" style={{ background: currentTheme.colors.good }} /></div></div><button className="btn primary block" onClick={openThemeEditor}>Customize Theme</button></section><section className="card"><h3>CSV material importer</h3><p className="tiny muted">Accepts the workbook export headers including Inventory, Category, Unit (locked), Unit Cost, Reorder At, and Warehouse Location. Quantity is never overwritten.</p><input className="in" type="file" accept=".csv,text/csv" disabled={!canAdmin(role)} onChange={(event) => upload(event.target.files?.[0]).catch((err) => setReport(err.message))} />{report && <p className="tiny muted">{report}</p>}</section><section className="card"><h3>QuickBooks Online</h3><p className="tiny muted">OAuth stores tokens server-side. Sync upserts customer + project name only.</p><button className="btn dark block" disabled={!canAdmin(role) || !remoteMode} onClick={() => invokeQuickBooksConnect().then((r) => { window.location.href = r.authUrl; }).catch((err) => notify(err.message))}>Connect QuickBooks</button><button className="btn line block" disabled={!canAdmin(role) || !remoteMode} onClick={() => invokeQuickBooksSync().then((r) => notify(`${r.synced} jobs synced`)).catch((err) => notify(err.message))}>Sync jobs</button></section><section className="card"><h3>Reorder PO estimate</h3><p className="tiny muted">{estimate.lines.length} lines · subtotal {money(estimate.subtotal)} · GST {money(estimate.gst)} · total {money(estimate.total)}</p><button className="btn line block" onClick={() => navigator.clipboard?.writeText(buildPoText(state))}>Copy PO to clipboard</button></section><section className="card"><h3>Reports & exports</h3><p className="tiny muted">Cost report can be printed to PDF by your browser. BuilderTrend remains a CSV/PDF export stub.</p><button className="btn line block" onClick={() => printReport(state)}>Print cost report</button><button className="btn line block" onClick={() => navigator.clipboard?.writeText(csv)}>Copy transactions CSV</button><label className="fld">Monthly Inventory Log</label><input className="in" type="month" value={exportMonth} onChange={(event) => setExportMonth(event.target.value)} /><button className="btn line block" onClick={() => navigator.clipboard?.writeText(monthlyCsv)}>Copy Monthly Inventory Log CSV</button></section><section className="card"><h3>Users & roles</h3>{state.users.map((user) => <div className="line-item" key={user.id}><b>{user.name}</b><span className="pill neu">{user.role}</span></div>)}</section><section className="card"><h3>PEOPLE points feed</h3><p className="tiny muted">GET /functions/v1/points-feed?since=ISO_DATE returns append-only points_events with profile fields.</p><Pill tone="good">{state.pointsEvents.length} events</Pill></section></div>;
}
