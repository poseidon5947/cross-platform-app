import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createSeedState } from "./data/seed";
import { shouldRequestSopAward } from "./data/award";
import { drainRemoteMediaQueue } from "./data/offline";
import { awardSopPoints, getCurrentSession, loadRemoteState, persistState, recordPointsAward, signInWithPassword, signOut, uploadMediaFile } from "./data/repo";
import { addStep, approveSop, attachMedia, attachUploadedMedia, canApprove, canCreateSop, canEditSop, canManage, createSop, deleteStep, drainOfflineMediaQueue, moveStep, requestChanges, sopPointsForUser, submitForReview, updateStep } from "./domain/sop";
import type { MediaType, Role, SopDraft, SopItem, SopState, SopStatus } from "./types";
import { isSupabaseConfigured } from "./integrations/supabase";

const STORAGE_KEY = "sop-plus-state-v2";
const REMOTE_MODE = isSupabaseConfigured();
const DEMO_PICKER = !REMOTE_MODE || import.meta.env.VITE_DEMO_MODE === "true";

const statusLabels: Record<SopStatus, string> = {
  assigned: "Assigned",
  in_progress: "In Progress",
  in_review: "In Review",
  published: "Published",
  archived: "Archived",
};

export function App() {
  const [demoState, setDemoState] = useStoredState();
  const remote = useRemoteState();
  const state = REMOTE_MODE ? remote.state : demoState;
  const setState = REMOTE_MODE ? remote.setState : setDemoState;
  const [tab, setTab] = useState<"home" | "library" | "build" | "review" | "admin">("home");
  const [selectedId, setSelectedId] = useState("");
  const [sheet, setSheet] = useState<"create" | "edit" | null>(null);

  useEffect(() => {
    if (!selectedId && state?.sops[0]) setSelectedId(state.sops[0].id);
  }, [selectedId, state]);

  useEffect(() => {
    const onOnline = () => {
      if (REMOTE_MODE) remote.drainQueue();
      else setState((next) => drainOfflineMediaQueue(next));
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [remote, setState]);

  if (REMOTE_MODE && remote.loading) return <Splash text="Loading SOP+ from Supabase..." />;
  if (REMOTE_MODE && !remote.sessionUserId) return <LoginScreen error={remote.error} onLogin={remote.login} />;
  if (!state) return <Splash text="Preparing SOP+..." />;

  const currentUser = state.users.find((user) => user.id === state.currentUserId) ?? state.users[0];
  const selected = state.sops.find((sop) => sop.id === selectedId) ?? state.sops[0];
  const role = currentUser.role;
  const reviewCount = state.sops.filter((sop) => sop.status === "in_review").length;
  const queueCount = state.offlineMediaQueue.filter((item) => item.status === "queued" || item.status === "failed").length;

  async function approveAction(sopId: string) {
    const sop = state?.sops.find((item) => item.id === sopId);
    if (!sop || !state) return;
    if (REMOTE_MODE) {
      const result = shouldRequestSopAward(state.pointsEvents, sopId)
        ? await awardSopPoints(sop, state.currentUserId)
        : { eventId: state.pointsEvents.find((event) => event.type === "sop_completed" && event.ref === sopId)?.id ?? sopId, awardedAt: new Date().toISOString(), alreadyAwarded: true };
      if (!result.alreadyAwarded) await recordPointsAward(sop, result);
      setState((next) => approveSop(next, sopId, state.currentUserId, result.awardedAt));
      remote.reload();
    } else {
      setState((next) => approveSop(next, sopId, state.currentUserId));
    }
  }

  async function attachFile(stepId: string, type: MediaType, file: File) {
    const step = state?.steps.find((item) => item.id === stepId);
    if (!step) return;
    if (REMOTE_MODE && navigator.onLine) {
      const uploaded = await uploadMediaFile(stepId, step.sopId, file);
      setState((next) => attachUploadedMedia(next, stepId, uploaded.type as MediaType, file.name, uploaded.storageKey, uploaded.thumbnailUrl, uploaded.size));
      return;
    }
    setState((next) => {
      const queued = attachMedia(next, stepId, type, file.name, false);
      const pending = queued.offlineMediaQueue[queued.offlineMediaQueue.length - 1];
      return {
        ...queued,
        media: queued.media.map((item) => item.id === pending?.mediaId ? { ...item, localUrl: URL.createObjectURL(file), size: file.size } : item),
        offlineMediaQueue: queued.offlineMediaQueue.map((command) => command.id === pending?.id ? { ...command, file, size: file.size } : command),
      };
    });
  }

  return (
    <div className="shell app">
      <aside className="rail">
        <div className="brand">
          <div className="drop logo">+</div>
          <div>
            <h1>SOP+</h1>
            <p>Van Isle Water Proofing+</p>
          </div>
        </div>
        <nav>
          <button className={tab === "home" ? "on" : ""} onClick={() => setTab("home")}>Home</button>
          <button className={tab === "library" ? "on" : ""} onClick={() => setTab("library")}>Library</button>
          <button className={tab === "build" ? "on" : ""} onClick={() => setTab("build")}>Build</button>
          <button className={tab === "review" ? "on" : ""} onClick={() => setTab("review")}>Review <span>{reviewCount}</span></button>
          <button className={tab === "admin" ? "on" : ""} onClick={() => setTab("admin")}>Admin</button>
        </nav>
        <div className="rail-foot">
          {DEMO_PICKER && (
            <>
              <label>View as</label>
              <select value={state.currentUserId} onChange={(event) => setState({ ...state, currentUserId: event.target.value })}>
                {state.users.map((user) => <option key={user.id} value={user.id}>{user.name} - {user.role}</option>)}
              </select>
            </>
          )}
          {!DEMO_PICKER && <div className="signed-in"><b>{currentUser.name}</b><small>{currentUser.role}</small></div>}
          {REMOTE_MODE ? <button onClick={remote.logout}>Sign out</button> : <small>Demo mode - localStorage fallback</small>}
        </div>
      </aside>

      <main>
        <header className="topbar top">
          <div>
            <h2>{tab === "home" ? (canManage(role) ? "SOP map" : "My SOPs") : titleFor(tab)}</h2>
            <p>Build living procedures with photos, video, approval, and +20 points.</p>
          </div>
          <div className="top-actions">
            {remote.error && <span className="chip warn">{remote.error}</span>}
            {queueCount > 0 && <button className="chip warn" onClick={() => REMOTE_MODE ? remote.drainQueue() : setState(drainOfflineMediaQueue(state))}>{queueCount} media queued</button>}
            {canCreateSop(role, state.permissions.crewLeadCanAssignWithinCrew) && <button className="primary" onClick={() => setSheet("create")}>+ New SOP</button>}
          </div>
        </header>

        {tab === "home" && (
          canManage(role) ? <ManagerHome state={state} setTab={setTab} select={setSelectedId} /> : <CrewHome state={state} userId={currentUser.id} select={(id) => { setSelectedId(id); setTab("build"); }} />
        )}
        {tab === "library" && <Library state={state} select={(id) => { setSelectedId(id); setTab("build"); }} />}
        {tab === "build" && selected && <Builder state={state} sop={selected} role={role} setState={setState} openEdit={() => setSheet("edit")} approve={approveAction} attachFile={attachFile} />}
        {tab === "review" && <ReviewQueue state={state} role={role} approve={approveAction} select={(id) => { setSelectedId(id); setTab("build"); }} />}
        {tab === "admin" && <AdminPanel state={state} setState={setState} />}
      </main>

      <footer className="mobile-nav">
        {(["home", "library", "build", "review"] as const).map((item) => <button key={item} className={tab === item ? "on" : ""} onClick={() => setTab(item)}>{titleFor(item)}</button>)}
      </footer>

      {sheet === "create" && <CreateSheet state={state} close={() => setSheet(null)} save={(draft) => setState((next) => createSop(next, draft))} />}
      {sheet === "edit" && selected && <EditSheet state={state} sop={selected} close={() => setSheet(null)} save={(patch) => setState((next) => ({ ...next, sops: next.sops.map((sop) => sop.id === selected.id ? { ...sop, ...patch, updatedAt: new Date().toISOString() } : sop) }))} />}
    </div>
  );
}

function useRemoteState() {
  const [state, setRawState] = useState<SopState | null>(null);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(REMOTE_MODE);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();
  const remoteQuery = useQuery({
    queryKey: ["sop-plus-state", sessionUserId],
    queryFn: () => loadRemoteState(sessionUserId!),
    enabled: REMOTE_MODE && Boolean(sessionUserId),
    staleTime: 20_000,
  });

  useEffect(() => {
    if (remoteQuery.data) {
      setRawState(remoteQuery.data);
      setLoading(false);
      setError("");
    }
    if (remoteQuery.error) {
      setError(remoteQuery.error instanceof Error ? remoteQuery.error.message : "Could not load Supabase data.");
      setLoading(false);
    }
  }, [remoteQuery.data, remoteQuery.error]);

  async function reload(userId = sessionUserId) {
    if (!REMOTE_MODE || !userId) return;
    setLoading(true);
    try {
      const remoteState = await loadRemoteState(userId);
      setRawState(remoteState);
      queryClient.setQueryData(["sop-plus-state", userId], remoteState);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load Supabase data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!REMOTE_MODE) return;
    getCurrentSession()
      .then((session) => {
        const userId = session?.user.id ?? null;
        setSessionUserId(userId);
        if (userId) reload(userId);
        else setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not read session.");
        setLoading(false);
      });
  }, []);

  const setState: React.Dispatch<React.SetStateAction<SopState>> = (update) => {
    setRawState((previous) => {
      if (!previous) return previous;
      const next = typeof update === "function" ? (update as (value: SopState) => SopState)(previous) : update;
      persistState(previous, next).catch((err) => setError(err instanceof Error ? err.message : "Could not save changes."));
      return next;
    });
  };

  async function login(email: string, password: string) {
    setLoading(true);
    try {
      const user = await signInWithPassword(email, password);
      setSessionUserId(user.id);
      await reload(user.id);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
      setLoading(false);
    }
  }

  async function logout() {
    await signOut();
    setSessionUserId(null);
    setRawState(null);
    queryClient.removeQueries({ queryKey: ["sop-plus-state"] });
  }

  async function drainQueue() {
    if (!state) return;
    const drained = await drainRemoteMediaQueue(state, {
      upload: async (command) => {
        if (!command.file) throw new Error("Original file is not available; reattach when online.");
        return uploadMediaFile(command.stepId, command.sopId, command.file);
      },
    });
    setRawState(drained);
    persistState(state, drained).catch((err) => setError(err instanceof Error ? err.message : "Could not save uploaded media."));
  }

  return { state, setState, sessionUserId, loading: loading || (remoteQuery.isFetching && !state), error, login, logout, reload, drainQueue };
}

function ManagerHome({ state, setTab, select }: { state: SopState; setTab: (tab: "review" | "library") => void; select: (id: string) => void }) {
  const stats = useMemo(() => state.categories.map((category) => {
    const sops = state.sops.filter((sop) => sop.categoryId === category.id && sop.status !== "archived");
    const published = sops.filter((sop) => sop.status === "published").length;
    return { category, sops, published };
  }), [state]);
  const review = state.sops.filter((sop) => sop.status === "in_review").slice(0, 4);
  const unassigned = state.sops.filter((sop) => !sop.assignedTo).length;
  return (
    <div className="grid two">
      <section className="panel card wide">
        <div className="section-head"><h3>Library progress</h3><button onClick={() => setTab("library")}>Open library</button></div>
        <div className="category-grid">
          {stats.map(({ category, sops, published }) => <div className="category-card" key={category.id}><b>{category.name}</b><span>{published} of {sops.length} documented</span><div className="bar"><i style={{ width: `${sops.length ? (published / sops.length) * 100 : 0}%` }} /></div></div>)}
        </div>
      </section>
      <section className="panel card">
        <h3>Review queue</h3>
        {review.map((sop) => <SopRow key={sop.id} state={state} sop={sop} onClick={() => { select(sop.id); setTab("review"); }} />)}
        {!review.length && <p className="muted">No SOPs waiting for approval.</p>}
      </section>
      <section className="panel card">
        <h3>Workload</h3>
        <Metric label="In progress" value={state.sops.filter((sop) => sop.status === "in_progress").length} />
        <Metric label="Unassigned" value={unassigned} />
        <Metric label="Published" value={state.sops.filter((sop) => sop.status === "published").length} />
      </section>
    </div>
  );
}

function CrewHome({ state, userId, select }: { state: SopState; userId: string; select: (id: string) => void }) {
  const mine = state.sops.filter((sop) => sop.assignedTo === userId || sop.createdBy === userId);
  return (
    <div className="grid two">
      <section className="panel card hero-panel">
        <h3>{sopPointsForUser(state, userId)} SOP points</h3>
        <p>Approved SOPs earn a flat +20 in the shared Van Isle points ledger.</p>
      </section>
      <section className="panel card">
        <h3>Assigned to build</h3>
        {mine.filter((sop) => ["assigned", "in_progress"].includes(sop.status)).map((sop) => <SopRow key={sop.id} state={state} sop={sop} onClick={() => select(sop.id)} />)}
      </section>
      <section className="panel card wide">
        <h3>In review and approved</h3>
        {mine.filter((sop) => ["in_review", "published"].includes(sop.status)).map((sop) => <SopRow key={sop.id} state={state} sop={sop} onClick={() => select(sop.id)} />)}
      </section>
    </div>
  );
}

function Library({ state, select }: { state: SopState; select: (id: string) => void }) {
  return <div className="library">{state.categories.map((category) => {
    const sops = state.sops.filter((sop) => sop.categoryId === category.id && sop.status !== "archived");
    return <section className="panel card" key={category.id}><h3>{category.name}</h3>{sops.map((sop) => <SopRow key={sop.id} state={state} sop={sop} onClick={() => select(sop.id)} />)}</section>;
  })}</div>;
}

function Builder({ state, sop, role, setState, openEdit, approve, attachFile }: { state: SopState; sop: SopItem; role: Role; setState: React.Dispatch<React.SetStateAction<SopState>>; openEdit: () => void; approve: (sopId: string) => void; attachFile: (stepId: string, type: MediaType, file: File) => void }) {
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [comments, setComments] = useState("");
  const category = state.categories.find((item) => item.id === sop.categoryId);
  const promptSet = state.promptSets.find((item) => item.id === category?.promptSetId);
  const steps = state.steps.filter((step) => step.sopId === sop.id).sort((a, b) => a.sortOrder - b.sortOrder);
  const manager = state.users.find((user) => user.role === "manager") ?? state.users[0];
  const published = sop.status === "published";
  const editable = canEditSop(role, state.currentUserId, sop);
  return (
    <div className="builder">
      <section className="panel card wide">
        <div className="builder-head">
          <div>
            <span className={`status ${sop.status}`}>{statusLabels[sop.status]}</span>
            <h3>{sop.title}</h3>
            <p>{sop.description}</p>
          </div>
          {editable && <button onClick={openEdit}>Edit fields</button>}
        </div>
        <div className="facts">
          <span>Category: {category?.name}</span>
          <span>Responsible: {nameOf(state, sop.assignedTo)}</span>
          <span>Photo: {sop.requiresPhoto ? "Expected" : "Optional"}</span>
          <span>Video: {sop.requiresVideo ? "Expected" : "Optional"}</span>
          {sop.dueDate && <span>Due: {sop.dueDate}</span>}
        </div>
      </section>

      <section className="panel card prompts">
        <h3>Thinking prompts</h3>
        {promptSet?.prompts.map((prompt) => <p key={prompt}>{prompt}</p>)}
      </section>

      <section className="panel card wide">
        <div className="section-head"><h3>{published ? "Published reference" : "Build steps"}</h3><span>{steps.length} steps</span></div>
        <div className="steps">
          {steps.map((step, index) => <div className="step" key={step.id}>
            <div className="step-num">{index + 1}</div>
            <div className="step-body">
              <textarea disabled={!editable} value={step.text} onChange={(event) => setState((next) => updateStep(next, step.id, event.target.value, step.note))} />
              <input disabled={!editable} value={step.note} onChange={(event) => setState((next) => updateStep(next, step.id, step.text, event.target.value))} placeholder="Short note or caption" />
              <MediaStrip state={state} stepId={step.id} />
              {editable && <div className="step-actions">
                <button onClick={() => setState((next) => moveStep(next, sop.id, step.id, -1))}>Up</button>
                <button onClick={() => setState((next) => moveStep(next, sop.id, step.id, 1))}>Down</button>
                <label className="upload">Photo<input type="file" accept="image/*" capture="environment" onChange={(event) => attachFromInput(event, "photo", step.id, attachFile)} /></label>
                <label className="upload">Video<input type="file" accept="video/*" capture="environment" onChange={(event) => attachFromInput(event, "video", step.id, attachFile)} /></label>
                <button className="danger" onClick={() => setState((next) => deleteStep(next, step.id))}>Delete</button>
              </div>}
            </div>
          </div>)}
        </div>
        {editable && <div className="add-step">
          <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Add the next step..." />
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note" />
          <button className="primary" disabled={!text.trim()} onClick={() => { setState((next) => addStep(next, sop.id, text, note)); setText(""); setNote(""); }}>Add step</button>
        </div>}
        <div className="review-actions">
          {!published && editable && <button className="primary" disabled={!steps.length} onClick={() => setState((next) => submitForReview(next, sop.id, manager.id))}>Submit for review</button>}
          {canApprove(role, state.permissions.crewLeadCanApprove) && sop.status === "in_review" && <button onClick={() => approve(sop.id)}>Approve +20</button>}
          {canApprove(role, state.permissions.crewLeadCanApprove) && sop.status === "in_review" && <><input value={comments} onChange={(event) => setComments(event.target.value)} placeholder="Change request comments" /><button onClick={() => setState((next) => requestChanges(next, sop.id, comments || "Please revise and resubmit.", sop.assignedTo))}>Request changes</button></>}
        </div>
      </section>
    </div>
  );
}

function ReviewQueue({ state, role, approve, select }: { state: SopState; role: Role; approve: (sopId: string) => void; select: (id: string) => void }) {
  const queue = state.sops.filter((sop) => sop.status === "in_review");
  return <section className="panel card wide"><h3>Submitted SOPs</h3>{queue.map((sop) => <div className="review-row" key={sop.id}><SopRow state={state} sop={sop} onClick={() => select(sop.id)} />{canApprove(role, state.permissions.crewLeadCanApprove) && <button onClick={() => approve(sop.id)}>Approve +20</button>}</div>)}{!queue.length && <p className="muted">Nothing waiting for review.</p>}</section>;
}

function AdminPanel({ state, setState }: { state: SopState; setState: React.Dispatch<React.SetStateAction<SopState>> }) {
  const total = state.pointsEvents.filter((event) => event.type === "sop_completed").reduce((sum, event) => sum + event.points, 0);
  return <div className="grid two"><section className="panel card"><h3>Permissions</h3>{Object.entries(state.permissions).map(([key, value]) => <label className="check" key={key}><input type="checkbox" checked={value} onChange={(event) => setState((next) => ({ ...next, permissions: { ...next.permissions, [key]: event.target.checked } }))} /> {labelize(key)}</label>)}</section><section className="panel card"><h3>Shared points ledger</h3><Metric label="SOP points awarded" value={total} /><Metric label="Award events" value={state.pointsEvents.filter((event) => event.type === "sop_completed").length} /></section><section className="panel card wide"><h3>Notifications</h3>{state.notifications.slice(0, 8).map((note) => <div className="note" key={note.id}><b>{note.title}</b><span>{note.body}</span></div>)}{!REMOTE_MODE && <button className="danger" onClick={() => setState(createSeedState())}>Reset demo data</button>}</section></div>;
}

function CreateSheet({ state, close, save }: { state: SopState; close: () => void; save: (draft: SopDraft) => void }) {
  const [draft, setDraft] = useState<SopDraft>({ title: "", categoryId: state.categories[0].id, description: "", assignedTo: state.users.find((user) => user.role === "crew")?.id ?? state.users[0].id, createdBy: state.currentUserId, requiresPhoto: true, requiresVideo: false, dueDate: "" });
  return <Sheet title="New SOP" close={close}><FormFields state={state} draft={draft} setDraft={setDraft} /><button className="primary block" disabled={!draft.title.trim()} onClick={() => { save(draft); close(); }}>Create and assign</button></Sheet>;
}

function EditSheet({ state, sop, close, save }: { state: SopState; sop: SopItem; close: () => void; save: (patch: Partial<SopItem>) => void }) {
  const [draft, setDraft] = useState<SopDraft>({ title: sop.title, categoryId: sop.categoryId, description: sop.description, assignedTo: sop.assignedTo, createdBy: sop.createdBy, requiresPhoto: sop.requiresPhoto, requiresVideo: sop.requiresVideo, dueDate: sop.dueDate ?? "" });
  return <Sheet title="Edit SOP" close={close}><FormFields state={state} draft={draft} setDraft={setDraft} /><button className="primary block" onClick={() => { save(draft); close(); }}>Save changes</button></Sheet>;
}

function FormFields({ state, draft, setDraft }: { state: SopState; draft: SopDraft; setDraft: (draft: SopDraft) => void }) {
  return <div className="form"><label>Title<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label><label>Category<select value={draft.categoryId} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}>{state.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Description<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label><label>Assign to<select value={draft.assignedTo} onChange={(event) => setDraft({ ...draft, assignedTo: event.target.value })}>{state.users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label><label>Due date<input type="date" value={draft.dueDate ?? ""} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} /></label><label className="check"><input type="checkbox" checked={draft.requiresPhoto} onChange={(event) => setDraft({ ...draft, requiresPhoto: event.target.checked })} /> Requires photo</label><label className="check"><input type="checkbox" checked={draft.requiresVideo} onChange={(event) => setDraft({ ...draft, requiresVideo: event.target.checked })} /> Requires video</label></div>;
}

function MediaStrip({ state, stepId }: { state: SopState; stepId: string }) {
  const media = state.media.filter((item) => item.stepId === stepId);
  if (!media.length) return null;
  return <div className="media-strip">{media.map((item) => <button className="media" key={item.id} onClick={() => item.localUrl || item.thumbnailUrl ? window.open(item.localUrl || item.thumbnailUrl, "_blank") : undefined}><b>{item.type === "photo" ? "PHOTO" : "VIDEO"}</b><span>{item.syncStatus}</span>{item.thumbnailUrl || item.localUrl ? <small>Tap to expand</small> : null}</button>)}</div>;
}

function SopRow({ state, sop, onClick }: { state: SopState; sop: SopItem; onClick: () => void }) {
  return <button className="sop-row" onClick={onClick}><span className={`dot ${sop.status}`} /><div><b>{sop.title}</b><small>{nameOf(state, sop.assignedTo)} - {statusLabels[sop.status]}</small></div></button>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="metric"><strong>{value}</strong><span>{label}</span></div>;
}

function Sheet({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) {
  return <div className="overlay" onClick={close}><section className="sheet bottom-sheet" onClick={(event) => event.stopPropagation()}><div className="grip" /><div className="section-head"><h3>{title}</h3><button onClick={close}>Close</button></div>{children}</section></div>;
}

function LoginScreen({ error, onLogin }: { error: string; onLogin: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  return <div className="login"><section className="panel card"><div className="brand login-brand"><div className="drop logo">+</div><div><h1>SOP+</h1><p>Van Isle Water Proofing+</p></div></div><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error && <p className="error">{error}</p>}<button className="primary block" disabled={!email || !password || busy} onClick={() => { setBusy(true); onLogin(email, password).finally(() => setBusy(false)); }}>{busy ? "Signing in..." : "Sign in"}</button></section></div>;
}

function Splash({ text }: { text: string }) {
  return <div className="login"><section className="panel card"><h1>SOP+</h1><p>{text}</p></section></div>;
}

function useStoredState(): [SopState, React.Dispatch<React.SetStateAction<SopState>>] {
  const [state, setState] = useState<SopState>(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as SopState : createSeedState();
  });
  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(state)), [state]);
  return [state, setState];
}

function attachFromInput(event: React.ChangeEvent<HTMLInputElement>, type: MediaType, stepId: string, attachFile: (stepId: string, type: MediaType, file: File) => void) {
  const file = event.target.files?.[0];
  if (!file) return;
  attachFile(stepId, type, file);
  event.target.value = "";
}

function titleFor(tab: string) {
  if (tab === "home") return "Home";
  if (tab === "library") return "Library";
  if (tab === "build") return "Build";
  if (tab === "review") return "Review";
  return "Admin";
}

function nameOf(state: SopState, userId: string) {
  return state.users.find((user) => user.id === userId)?.name ?? "Unassigned";
}

function labelize(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}
