import { useState } from "react";
import { loadInProgress, isCrewWorkDay, nextLoadInDate, todayKey, formatDate } from "../domain/business";
import { loadInFileSignedUrl } from "../data/repo";
import type { AppState, ProjectLoadIn, ProjectLoadInItem, ProjectLoadInMedia, ServiceId } from "../types";

export interface NewLoadIn {
  siteId: string;
  serviceId: ServiceId;
  loadInDate: string;
  notes?: string;
  assignedTo?: string;
  items: Array<{ taskId?: string; label: string; section?: string }>;
  files: File[];
}

const sectionLabels: Record<string, string> = {
  services: "Service items",
  trucks: "Truck items",
  warehouse: "Warehouse items",
};

/**
 * The project manager's side: build tomorrow's list the evening before.
 *
 * Items come from the three task lists the crew already work from, so the
 * load-in speaks the same language as the checklists they tick off on site.
 */
export function LoadInPlanner({ state, userId, saveLoadIn }: {
  state: AppState;
  userId: string;
  saveLoadIn: (input: NewLoadIn) => void;
}) {
  const today = todayKey();
  const [siteId, setSiteId] = useState(state.sites[0]?.id ?? "");
  const [serviceId, setServiceId] = useState<ServiceId>("wp");
  const [loadInDate, setLoadInDate] = useState(nextLoadInDate(today));
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [query, setQuery] = useState("");

  const crew = state.users.filter((user) => user.status !== "Inactive");
  // The service's own items first, then the truck and warehouse lists, which
  // apply whatever the job is.
  const candidates = state.truckTasks.filter((task) => {
    if (task.section === "services") return !task.serviceId || task.serviceId === serviceId;
    return true;
  }).filter((task) => !query || task.text.toLowerCase().includes(query.toLowerCase()));

  const chosen = candidates.filter((task) => picked[task.id]);
  const canSubmit = Boolean(siteId && serviceId && loadInDate && assignedTo && chosen.length);

  const submit = () => {
    if (!canSubmit) return;
    saveLoadIn({
      siteId,
      serviceId,
      loadInDate,
      notes: notes.trim() || undefined,
      assignedTo,
      items: chosen.map((task) => ({ taskId: task.id, label: task.text, section: task.section })),
      files,
    });
  };

  return <div>
    <label className="fld">Job</label>
    <select className="in" value={siteId} onChange={(event) => setSiteId(event.target.value)}>
      {[...state.sites].sort((a, b) => a.name.localeCompare(b.name)).map((site) =>
        <option key={site.id} value={site.id}>{site.name}</option>)}
    </select>

    <label className="fld">Service</label>
    <select className="in" value={serviceId} onChange={(event) => setServiceId(event.target.value as ServiceId)}>
      {state.services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
    </select>

    <label className="fld">Load-in morning</label>
    <input className="in" type="date" value={loadInDate} min={today} onChange={(event) => setLoadInDate(event.target.value)} />
    {!isCrewWorkDay(loadInDate) && <p className="tiny error">That is a Sunday - the crew do not work. Pick another morning.</p>}

    <label className="fld">Items to load ({chosen.length} picked)</label>
    <div className="search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the task lists" /></div>
    <section className="card">
      {candidates.length ? candidates.map((task) => (
        <label className="line-item" key={task.id} style={{ cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={Boolean(picked[task.id])}
            onChange={() => setPicked((current) => ({ ...current, [task.id]: !current[task.id] }))}
          />
          <div className="mid">
            <b>{task.text}</b>
            <div className="tiny muted">{sectionLabels[task.section ?? ""] ?? task.section}</div>
          </div>
        </label>
      )) : <p className="tiny muted">Nothing matches that search.</p>}
    </section>

    <label className="fld">Notes for the crew</label>
    <textarea className="in" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Anything they need to know before they load" />

    <label className="fld">Photos and PDFs</label>
    <div className="file-picker">
      <input className="in" type="file" accept="image/*,application/pdf" multiple
        onChange={(event) => { setFiles((current) => [...current, ...Array.from(event.target.files ?? [])]); event.target.value = ""; }} />
      {files.map((file, index) => <div className="line-item" key={`${file.name}-${index}`}>
        <div className="mid"><b>{file.name}</b><div className="tiny muted">{(file.size / 1024 / 1024).toFixed(1)} MB</div></div>
        <button className="btn line sm" onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}>Remove</button>
      </div>)}
    </div>

    <label className="fld">Who is loading it in, 6-7am</label>
    <select className="in" value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}>
      <option value="">Choose a crew member</option>
      {crew.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
    </select>
    <p className="tiny muted">They tick the list off for 50 points, and they file this job&rsquo;s daily log by 4pm.</p>

    <button className="btn good block" disabled={!canSubmit || !isCrewWorkDay(loadInDate)} onClick={submit}>
      Send the load-in list
    </button>
    {!canSubmit && <p className="tiny muted">A job, a service, at least one item and a person are all needed.</p>}
  </div>;
}

/** What the assigned crew member sees, and ticks off. */
export function LoadInChecklist({ state, loadIn, items, media, onToggle, onComplete, readOnly = false }: {
  state: AppState;
  loadIn: ProjectLoadIn;
  items: ProjectLoadInItem[];
  media: ProjectLoadInMedia[];
  onToggle: (itemId: string, done: boolean) => void;
  onComplete: (loadIn: ProjectLoadIn) => void;
  readOnly?: boolean;
}) {
  const progress = loadInProgress(items);
  const site = state.sites.find((item) => item.id === loadIn.siteId);
  const service = state.services.find((item) => item.id === loadIn.serviceId);
  const grouped = ["services", "trucks", "warehouse"].map((section) => ({
    section,
    rows: items.filter((item) => (item.section ?? "services") === section),
  })).filter((group) => group.rows.length);

  return <section className="card" id="wz-load-in">
    <div className="sec-h">
      <div>
        <h3>Load-in &mdash; {site?.name ?? "Job"}</h3>
        <p className="tiny muted">{service?.name} &middot; {formatDate(loadIn.loadInDate)} &middot; {progress.done} of {progress.total} loaded</p>
      </div>
    </div>

    {loadIn.notes && <p className="tiny">{loadIn.notes}</p>}

    {grouped.map((group) => <div key={group.section}>
      <label className="fld">{sectionLabels[group.section] ?? group.section}</label>
      {group.rows.map((item) => <label className="line-item" key={item.id} style={{ cursor: readOnly ? "default" : "pointer" }}>
        <input type="checkbox" checked={Boolean(item.doneAt)} disabled={readOnly}
          onChange={() => onToggle(item.id, !item.doneAt)} />
        <div className="mid"><b>{item.label}</b></div>
      </label>)}
    </div>)}

    {media.length > 0 && <>
      <label className="fld">Attached</label>
      <LoadInFiles media={media} />
    </>}

    {!readOnly && <button className="btn good block" disabled={!progress.complete || Boolean(loadIn.completedAt)}
      onClick={() => onComplete(loadIn)}>
      {loadIn.completedAt ? "Load-in complete" : `Mark loaded (${progress.done}/${progress.total})`}
    </button>}
    {!loadIn.completedAt && !progress.complete && <p className="tiny muted">Tick everything off to finish and earn 50 points.</p>}
    {loadIn.completedAt && <p className="tiny muted">Now file this job&rsquo;s daily log by 4pm.</p>}
  </section>;
}

function LoadInFiles({ media }: { media: ProjectLoadInMedia[] }) {
  const [busyId, setBusyId] = useState("");
  const [failedId, setFailedId] = useState("");
  const open = async (item: ProjectLoadInMedia) => {
    setBusyId(item.id);
    setFailedId("");
    try {
      window.open(await loadInFileSignedUrl(item.storageKey), "_blank", "noopener");
    } catch {
      setFailedId(item.id);
    } finally {
      setBusyId("");
    }
  };
  return <div className="row-action">{media.map((item, index) => (
    <button key={item.id} className="link" disabled={busyId === item.id} onClick={() => open(item)}>
      {busyId === item.id ? "Opening…" : failedId === item.id ? "Could not open" : `${item.kind === "pdf" ? "PDF" : "Photo"} ${index + 1}`}
    </button>
  ))}</div>;
}

/**
 * The Project Load-In tab.
 *
 * The manager sees everything and plans the next one. A crew member sees only
 * what they were assigned, per the client's rule that the three crew leads see
 * their own load-in rather than the whole board.
 */
export function LoadInTab({ state, role, userId, openSheet, saveLoadIn, onToggle, onComplete }: {
  state: AppState;
  role: string;
  userId: string;
  openSheet: (sheet: { title: string; content: React.ReactNode } | null) => void;
  saveLoadIn: (input: NewLoadIn) => void;
  onToggle: (itemId: string, done: boolean) => void;
  onComplete: (loadIn: ProjectLoadIn) => void;
}) {
  const manages = role === "admin" || role === "manager";
  const mine = state.loadIns
    .filter((loadIn) => loadIn.assignedTo === userId)
    .sort((a, b) => b.loadInDate.localeCompare(a.loadInDate));
  const visible = manages
    ? [...state.loadIns].sort((a, b) => b.loadInDate.localeCompare(a.loadInDate))
    : mine;

  return <>
    {manages && <button className="btn primary block" onClick={() => openSheet({
      title: "Plan a load-in",
      content: <LoadInPlanner state={state} userId={userId} saveLoadIn={saveLoadIn} />,
    })}>Plan a load-in</button>}

    {visible.length === 0 && <section className="card">
      <p className="tiny muted">{manages
        ? "No load-ins yet. Plan one for tomorrow morning."
        : "Nothing assigned to you yet. The project manager sends these out the evening before."}</p>
    </section>}

    {visible.map((loadIn) => <LoadInChecklist
      key={loadIn.id}
      state={state}
      loadIn={loadIn}
      items={state.loadInItems.filter((item) => item.loadInId === loadIn.id)}
      media={state.loadInMedia.filter((item) => item.loadInId === loadIn.id)}
      onToggle={onToggle}
      onComplete={onComplete}
      readOnly={loadIn.assignedTo !== userId}
    />)}
  </>;
}
