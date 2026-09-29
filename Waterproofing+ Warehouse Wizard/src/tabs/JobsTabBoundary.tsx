import { useState } from "react";
import { todayKey, id, formatDate, loadInProgress } from "../domain/business";
import type { AppState, Role, Site } from "../types";
import { canManage, Pill, siteName, userName } from "../App";
import { LoadInPlanner } from "../components/LoadIn";
import type { NewLoadIn } from "../components/LoadIn";

export default function JobsTabBoundary({ state, role, userId, saveSite, openSheet, saveLoadIn }: {
  state: AppState;
  role: Role;
  userId: string;
  saveSite: (site: Site) => void;
  openSheet: (sheet: { title: string; content: React.ReactNode } | null) => void;
  saveLoadIn: (input: NewLoadIn) => void;
}) {
  // Vancouver time, not UTC: a job ending today used to drop into Past from 5pm
  // Pacific onward, while the crew were still on it.
  const today = todayKey();
  const active = state.sites.filter((site) => !site.endDate || site.endDate >= today);
  const past = state.sites.filter((site) => site.endDate && site.endDate < today);
  const canEdit = canManage(role);

  // Upcoming first, and anything still outstanding from earlier mornings.
  const upcomingLoadIns = [...state.loadIns]
    .filter((loadIn) => !loadIn.completedAt || loadIn.loadInDate >= today)
    .sort((a, b) => a.loadInDate.localeCompare(b.loadInDate));

  return <>
    {canEdit && <button className="btn primary block" onClick={() => openSheet({ title: "Plan a load-in", content: <LoadInPlanner state={state} userId={userId} saveLoadIn={saveLoadIn} /> })}>Plan a load-in</button>}
    {canEdit && upcomingLoadIns.length > 0 && <section className="card">
      <div className="sec-h"><h2>Load-ins</h2></div>
      {upcomingLoadIns.map((loadIn) => {
        const items = state.loadInItems.filter((item) => item.loadInId === loadIn.id);
        const progress = loadInProgress(items);
        return <div className="line-item" key={loadIn.id}>
          <div className="mid">
            <b>{siteName(state, loadIn.siteId)}</b>
            <div className="tiny muted">
              {formatDate(loadIn.loadInDate)} &middot; {userName(state, loadIn.assignedTo ?? "")} &middot; {progress.done}/{progress.total} loaded
            </div>
          </div>
          <Pill tone={loadIn.completedAt ? "good" : progress.done ? "warn" : "bad"}>
            {loadIn.completedAt ? "done" : progress.done ? "started" : "not started"}
          </Pill>
        </div>;
      })}
    </section>}
    {canEdit && <button className="btn line block" onClick={() => openSheet({ title: "New job", content: <JobForm saveSite={saveSite} /> })}>Add new job</button>}
    <section className="card">
      <div className="sec-h"><h2>Active jobs</h2></div>
      {active.length ? active.map((site) => <JobRow key={site.id} site={site} canEdit={canEdit} onOpen={() => openSheet({ title: site.name, content: <JobForm site={site} saveSite={saveSite} /> })} />) : <p className="tiny muted">No active jobs.</p>}
    </section>
    {past.length > 0 && <section className="card">
      <details>
        <summary className="tiny muted">{past.length} past job{past.length === 1 ? "" : "s"}</summary>
        {past.map((site) => <JobRow key={site.id} site={site} canEdit={canEdit} onOpen={() => openSheet({ title: site.name, content: <JobForm site={site} saveSite={saveSite} /> })} />)}
      </details>
    </section>}
  </>;
}

function JobRow({ site, canEdit, onOpen }: { site: Site; canEdit: boolean; onOpen: () => void }) {
  const dateRange = site.startDate || site.endDate ? `${site.startDate ?? "—"} → ${site.endDate ?? "ongoing"}` : "";
  return <div className="line-item" onClick={canEdit ? onOpen : undefined} style={canEdit ? { cursor: "pointer" } : undefined}>
    <div className="mid">
      <b>{site.name}</b>
      <div className="tiny muted">{[site.company, site.address].filter(Boolean).join(" · ")}</div>
      {(site.siteContactName || dateRange) && <div className="tiny muted">{[site.siteContactName, dateRange].filter(Boolean).join(" · ")}</div>}
    </div>
    {site.driveFolderUrl && <a className="tiny" href={site.driveFolderUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>Docs →</a>}
  </div>;
}

function JobForm({ site, saveSite }: { site?: Site; saveSite: (site: Site) => void }) {
  const [draft, setDraft] = useState<Site>(site ?? { id: id("s"), name: "", address: "", source: "manual" });
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
    <button className="btn primary block" disabled={!draft.name.trim()} onClick={() => saveSite(draft)}>Save job</button>
  </div>;
}
