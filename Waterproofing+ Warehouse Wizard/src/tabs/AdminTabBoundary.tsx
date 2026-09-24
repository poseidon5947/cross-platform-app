import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { validateMaterialsCsv } from "../data/csvImport";
import { invokeMaterialsImport, invokeQuickBooksConnect, invokeQuickBooksSync } from "../data/repo";
import { money, priceChangeMaterials, reorderEstimate } from "../domain/business";
import type { Theme } from "../themes";
import type { AppState, Material, Role } from "../types";
import { canAdmin, canManage, Pill } from "../App";
import PeopleTabBoundary from "./PeopleTabBoundary";

type AdminSection = "crew" | "csv" | "po" | "quickbooks" | "settings";

export default function AdminTabBoundary({ state, role, notify, remoteMode, saveMaterial, currentTheme, onThemeChange, openThemeEditor, setState, openSheet, focusTarget, onFocusHandled }: {
  state: AppState;
  role: Role;
  notify: (message: string) => void;
  remoteMode: boolean;
  saveMaterial: (material: Material, includeQty?: boolean) => void;
  currentTheme: Theme;
  onThemeChange: (theme: Theme) => void;
  openThemeEditor: () => void;
  setState: (state: AppState | ((current: AppState) => AppState)) => void;
  openSheet: (sheet: { title: string; content: React.ReactNode }) => void;
  focusTarget?: string | null;
  onFocusHandled?: () => void;
}) {
  return <Admin state={state} role={role} notify={notify} remoteMode={remoteMode} saveMaterial={saveMaterial} currentTheme={currentTheme} onThemeChange={onThemeChange} openThemeEditor={openThemeEditor} setState={setState} openSheet={openSheet} focusTarget={focusTarget} onFocusHandled={onFocusHandled} />;
}

function buildPoText(state: AppState) {
  const estimate = reorderEstimate(state.materials);
  return estimate.lines.map((line) => {
    const material = state.materials.find((item) => item.id === line.materialId);
    return `${material?.name}: ${line.suggestedQty} ${material?.unit} (${line.pallets || "case/loose"} pallets) - ${money(line.lineCost)}`;
  }).concat([`Subtotal ${money(estimate.subtotal)}`, `GST ${money(estimate.gst)}`, `Freight ${money(estimate.freight)}`, `Total ${money(estimate.total)}`]).join("\n");
}

function Admin({ state, role, notify, remoteMode, saveMaterial, currentTheme, onThemeChange, openThemeEditor, setState, openSheet, focusTarget, onFocusHandled }: { state: AppState; role: Role; notify: (message: string) => void; remoteMode: boolean; saveMaterial: (material: Material, includeQty?: boolean) => void; currentTheme: Theme; onThemeChange: (theme: Theme) => void; openThemeEditor: () => void; setState: (state: AppState | ((current: AppState) => AppState)) => void; openSheet: (sheet: { title: string; content: React.ReactNode }) => void; focusTarget?: string | null; onFocusHandled?: () => void }) {
  const [section, setSection] = useState<AdminSection>(() => (focusTarget === "csv" ? "csv" : "crew"));
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!focusTarget) return;
    if (focusTarget === "csv") setSection("csv");
    onFocusHandled?.();
  }, [focusTarget]);
  const estimate = reorderEstimate(state.materials);
  const priceChanges = priceChangeMaterials(state.materials);
  const [report, setReport] = useState<string>(() => priceChanges.length ? `${priceChanges.length} price change${priceChanges.length === 1 ? "" : "s"} active` : "");
  if (!canManage(role)) return <section className="card">Manager or Admin access required.</section>;
  // "0 imported; 2 skipped" and nothing else left an admin with no idea what was
  // wrong with their file - the reasons were in the response all along and were
  // being dropped. Live verification hit exactly this: both rows were missing a
  // Category column and the screen never said so.
  const describe = (imported: number, skipped: Array<{ row: number; reason: string }>) => {
    const head = `${imported} imported; ${skipped.length} skipped`;
    if (!skipped.length) return head;
    const reasons = [...new Set(skipped.map((item) => item.reason))];
    const rowsFor = (reason: string) => skipped.filter((item) => item.reason === reason).map((item) => item.row);
    const detail = reasons.slice(0, 3).map((reason) => {
      const rows = rowsFor(reason);
      const shown = rows.slice(0, 6).join(", ");
      return `${reason} (row${rows.length === 1 ? "" : "s"} ${shown}${rows.length > 6 ? ` and ${rows.length - 6} more` : ""})`;
    }).join("; ");
    return `${head} — ${detail}${reasons.length > 3 ? `; and ${reasons.length - 3} other reason(s)` : ""}`;
  };
  const upload = async (file?: File) => {
    if (!file) return;
    try {
      if (remoteMode) {
        const result = await invokeMaterialsImport(file);
        setReport(describe(result.imported, result.skipped ?? []));
        // The edge function wrote straight to the database; nothing here told the
        // app to look again, so the inventory list kept the old costs and names
        // until the next reload. Live verification saw "1 imported" and an
        // unchanged $9.50 side by side.
        void queryClient.invalidateQueries({ queryKey: ["app-state"] });
      } else {
        const result = validateMaterialsCsv(await file.text(), state.materials);
        result.materials.forEach((material) => saveMaterial(material, false));
        setReport(describe(result.imported, result.skipped ?? []));
      }
    } catch (error) {
      // An import that fails outright used to leave the previous report on screen.
      setReport(error instanceof Error ? `Import failed: ${error.message}` : "Import failed.");
    }
  };

  return <>
    <div className="seg">
      <button className={section === "crew" ? "on" : ""} onClick={() => setSection("crew")}>Crew</button>
      <button className={section === "csv" ? "on" : ""} onClick={() => setSection("csv")}>CSV Importer</button>
      <button className={section === "po" ? "on" : ""} onClick={() => setSection("po")}>PO estimate</button>
      <button className={section === "quickbooks" ? "on" : ""} onClick={() => setSection("quickbooks")}>Quickbooks</button>
      <button className={section === "settings" ? "on" : ""} onClick={() => setSection("settings")}>Settings</button>
    </div>

    {section === "crew" && <>
      <PeopleTabBoundary state={state} role={role} setState={setState} openSheet={openSheet} />
      <section className="card"><h3>Users & roles</h3>{state.users.map((user) => <div className="line-item" key={user.id}><b>{user.name}</b><span className="pill neu">{user.role}</span></div>)}</section>
      <section className="card"><h3>Crew pool</h3><p className="tiny muted">Points from departed team members, saved toward a company breakfast.</p><Pill tone="good">{state.crewPoolPoints} pts</Pill></section>
      <section className="card"><h3>PEOPLE points feed</h3><p className="tiny muted">GET /functions/v1/points-feed?since=ISO_DATE returns append-only points_events with profile fields.</p><Pill tone="good">{state.pointsEvents.length} events</Pill></section>
    </>}

    {section === "csv" && <section className="card"><h3>CSV material importer</h3><p className="tiny muted">Accepts the workbook export headers including Inventory, Category, Unit (locked), Unit Cost, Reorder At, and Warehouse Location. Quantity is never overwritten.</p><input className="in" type="file" accept=".csv,text/csv" disabled={!canAdmin(role)} onChange={(event) => upload(event.target.files?.[0]).catch((err) => setReport(err.message))} />{report && <p className="tiny muted">{report}</p>}</section>}

    {section === "po" && <section className="card"><h3>Reorder PO estimate</h3><p className="tiny muted">{estimate.lines.length} lines · subtotal {money(estimate.subtotal)} · GST {money(estimate.gst)} · total {money(estimate.total)}</p><button className="btn line block" onClick={() => navigator.clipboard?.writeText(buildPoText(state))}>Copy PO to clipboard</button></section>}

    {section === "quickbooks" && <section className="card"><h3>QuickBooks Online</h3><p className="tiny muted">OAuth stores tokens server-side. Sync upserts customer + project name only.</p><button className="btn dark block" disabled={!canAdmin(role) || !remoteMode} onClick={() => invokeQuickBooksConnect().then((r) => { window.location.href = r.authUrl; }).catch((err) => notify(err.message))}>Connect QuickBooks</button><button className="btn line block" disabled={!canAdmin(role) || !remoteMode} onClick={() => invokeQuickBooksSync().then((r) => notify(`${r.synced} jobs synced`)).catch((err) => notify(err.message))}>Sync jobs</button></section>}

    {section === "settings" && <section className="card"><h3>Theme Customization</h3><p className="tiny muted">Choose from 6 preset themes or create your own custom color scheme. Changes apply instantly.</p><div className="theme-preview"><span className="theme-name">{currentTheme.name}</span><div className="theme-colors"><span className="color-dot" style={{ background: currentTheme.colors.primary }} /><span className="color-dot" style={{ background: currentTheme.colors.amber }} /><span className="color-dot" style={{ background: currentTheme.colors.good }} /></div></div><button className="btn primary block" onClick={openThemeEditor}>Customize Theme</button></section>}
  </>;
}
