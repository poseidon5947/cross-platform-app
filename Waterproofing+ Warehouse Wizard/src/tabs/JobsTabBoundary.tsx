import { useState } from "react";
import { todayKey } from "../domain/business";
import type { AppState, Role, Site } from "../types";
import { canManage } from "../App";

function Chip({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return <button className={on ? "chip on" : "chip"} onClick={onClick}>{children}</button>;
}

export default function JobsTabBoundary({ state, role, saveSite, openSheet }: {
  state: AppState;
  role: Role;
  saveSite: (site: Site) => void;
  openSheet: (sheet: { title: string; content: React.ReactNode } | null) => void;
}) {
  // Vancouver time, not UTC: a job ending today used to drop into Past from 5pm
  // Pacific onward, while the crew were still on it.
  const today = todayKey();
  const [sort, setSort] = useState<"az" | "newest" | "oldest">("az");
  // The list arrived in whatever order the database returned, which is neither
  // alphabetical nor by age. Newest first uses the start date where a job has
  // one, falling back to when it was added.
  const started = (site: Site) => site.startDate ?? site.createdAt ?? "";
  const order = (list: Site[]) => [...list].sort((a, b) =>
    sort === "az" ? a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
    : sort === "newest" ? started(b).localeCompare(started(a)) || a.name.localeCompare(b.name)
    : started(a).localeCompare(started(b)) || a.name.localeCompare(b.name));
  const active = order(state.sites.filter((site) => !site.endDate || site.endDate >= today));
  const past = order(state.sites.filter((site) => site.endDate && site.endDate < today));
  const canEdit = canManage(role);

  return <>
    {canEdit && <button className="btn primary block" onClick={() => openSheet({ title: "New job", content: <JobForm saveSite={saveSite} /> })}>Add new job</button>}
    <section className="card">
      <div className="sec-h"><h2>Active jobs</h2><span className="tiny muted">{active.length}</span></div>
      <div className="chips">
        <Chip on={sort === "az"} onClick={() => setSort("az")}>A\u2013Z</Chip>
        <Chip on={sort === "newest"} onClick={() => setSort("newest")}>Newest first</Chip>
        <Chip on={sort === "oldest"} onClick={() => setSort("oldest")}>Oldest first</Chip>
      </div>
      {active.length ? active.map((site) => <JobRow key={site.id} site={site} canEdit={canEdit} onOpen={() => openSheet({ title: site.name, content: <JobForm site={site} saveSite={saveSite} /> })} onCopy={canEdit ? () => openSheet({ title: `Copy of ${site.name}`, content: <JobForm site={{ ...site, id: crypto.randomUUID(), name: `${site.name} (copy)`, startDate: undefined, endDate: undefined }} saveSite={saveSite} /> }) : undefined} />) : <p className="tiny muted">No active jobs.</p>}
    </section>
    {past.length > 0 && <section className="card">
      <details>
        <summary className="tiny muted">{past.length} past job{past.length === 1 ? "" : "s"}</summary>
        {past.map((site) => <JobRow key={site.id} site={site} canEdit={canEdit} onOpen={() => openSheet({ title: site.name, content: <JobForm site={site} saveSite={saveSite} /> })} onCopy={canEdit ? () => openSheet({ title: `Copy of ${site.name}`, content: <JobForm site={{ ...site, id: crypto.randomUUID(), name: `${site.name} (copy)`, startDate: undefined, endDate: undefined }} saveSite={saveSite} /> }) : undefined} />)}
      </details>
    </section>}
  </>;
}

function JobRow({ site, canEdit, onOpen, onCopy }: { site: Site; canEdit: boolean; onOpen: () => void; onCopy?: () => void }) {
  const dateRange = site.startDate || site.endDate ? `${site.startDate ?? "—"} → ${site.endDate ?? "ongoing"}` : "";
  return <div className="line-item" onClick={canEdit ? onOpen : undefined} style={canEdit ? { cursor: "pointer" } : undefined}>
    <div className="mid">
      <b>{site.name}</b>
      <div className="tiny muted">{[site.company, site.address].filter(Boolean).join(" · ")}</div>
      {(site.siteContactName || dateRange) && <div className="tiny muted">{[site.siteContactName, dateRange].filter(Boolean).join(" · ")}</div>}
    </div>
    {site.driveFolderUrl && <a className="tiny" href={site.driveFolderUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>Docs →</a>}
    {/* Several jobs often sit at one location with the same site contacts. */}
    {onCopy && <button className="btn line sm" onClick={(event) => { event.stopPropagation(); onCopy(); }}>Copy</button>}
  </div>;
}

function JobForm({ site, saveSite }: { site?: Site; saveSite: (site: Site) => void }) {
  const [draft, setDraft] = useState<Site>(site ?? { id: crypto.randomUUID(), name: "", address: "", source: "manual" });
  // Three taps on Save used to file three jobs. The id above fixes the cause;
  // this stops the second tap reaching it at all.
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Site>(key: K, value: Site[K]) => setDraft((current) => ({ ...current, [key]: value }));
  return <div className="form-stack">
    <label className="fld">Job name</label>
    <input className="in" value={draft.name} onChange={(event) => set("name", event.target.value)} />
    <label className="fld">Company</label>
    <input className="in" value={draft.company ?? ""} onChange={(event) => set("company", event.target.value || undefined)} />
    <label className="fld">Job address</label>
    <input className="in" value={draft.address} onChange={(event) => set("address", event.target.value)} />
    <label className="fld">Site contact name</label>
    <input className="in" value={draft.siteContactName ?? ""} onChange={(event) => set("siteContactName", event.target.value || undefined)} />
    <div className="row2">
      <div><label className="fld">Site contact phone</label><input className="in" type="tel" value={draft.siteContactPhone ?? ""} onChange={(event) => set("siteContactPhone", event.target.value || undefined)} /></div>
      <div><label className="fld">Site contact email</label><input className="in" type="email" value={draft.siteContactEmail ?? ""} onChange={(event) => set("siteContactEmail", event.target.value || undefined)} /></div>
    </div>
    <div className="row2">
      <div><label className="fld">Start date</label><input className="in" type="date" value={draft.startDate ?? ""} onChange={(event) => set("startDate", event.target.value || undefined)} /></div>
      <div><label className="fld">End date</label><input className="in" type="date" value={draft.endDate ?? ""} onChange={(event) => set("endDate", event.target.value || undefined)} /></div>
    </div>
    <label className="fld">Documents &amp; PDFs</label>
    <input className="in" value={draft.driveFolderUrl ?? ""} onChange={(event) => set("driveFolderUrl", event.target.value || undefined)} placeholder="Google Drive folder link (job details / site plans)" />
    <button className="btn primary block" disabled={!draft.name.trim() || saving} onClick={() => { setSaving(true); saveSite(draft); }}>{saving ? "Saving\u2026" : "Save job"}</button>
  </div>;
}
