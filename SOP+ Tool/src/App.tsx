import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createSeedState } from "./data/seed";
import { shouldRequestSopAward } from "./data/award";
import { drainRemoteMediaQueue } from "./data/offline";
import { awardSopPoints, getCurrentSession, loadRemoteState, persistState, recordPointsAward, signInWithPassword, signOut, uploadMediaFile } from "./data/repo";
import { addStep, approveSop, attachMedia, attachUploadedMedia, canApprove, canCreateSop, canEditSop, canManage, createSop, deleteStep, drainOfflineMediaQueue, moveStep, requestChanges, sopPointsForUser, submitForReview, updateStep } from "./domain/sop";
import type { MediaType, Role, SopDraft, SopItem, SopState, SopStatus } from "./types";
import { isSupabaseConfigured } from "./integrations/supabase";
import { SuiteSwitcher } from "./components/SuiteSwitcher";
import { ThemeControl, useThemePreference } from "./components/ThemeControl";
import { ToastHost, useToast } from "./components/Toast";
import { GraphModal } from "./components/GraphModal";
import type { GraphType } from "./components/GraphModal";
import { IntroVideo } from "./components/IntroVideo";

const STORAGE_KEY = "sop-plus-state-v2";
export const REMOTE_MODE = isSupabaseConfigured();
const DEMO_PICKER = !REMOTE_MODE || import.meta.env.VITE_DEMO_MODE === "true";
const LazyContentTabs = lazy(() => import("./tabs/ContentTabBoundary"));
const LazyReviewTab = lazy(() => import("./tabs/ReviewTabBoundary"));
const LazyAdminTab = lazy(() => import("./tabs/AdminTabBoundary"));

export const statusLabels: Record<SopStatus, string> = {
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
  const [graphModal, setGraphModal] = useState<GraphType | null>(null);
  const [theme, setTheme] = useThemePreference();
  const { showToast } = useToast();

  useEffect(() => {
    if (remote.error) showToast(remote.error, "bad");
  }, [remote.error, showToast]);

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
    showToast("SOP approved and published");
  }

  async function attachFile(stepId: string, type: MediaType, file: File) {
    const step = state?.steps.find((item) => item.id === stepId);
    if (!step) return;
    if (REMOTE_MODE && navigator.onLine) {
      const uploaded = await uploadMediaFile(stepId, step.sopId, file);
      setState((next) => attachUploadedMedia(next, stepId, uploaded.type as MediaType, file.name, uploaded.storageKey, uploaded.thumbnailUrl, uploaded.size));
      showToast("Media uploaded");
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
    showToast("Media saved for upload", "warn");
  }

  return (
    <div className="shell app">
      <IntroVideo />
      <aside className="rail">
        <div className="brand">
          <div className="drop logo">+</div>
          <div>
            <h1>SOP+</h1>
            <p>Van Isle Water Proofing+</p>
          </div>
        </div>
        <SuiteSwitcher current="sop" />
        <nav>
          <button className={tab === "home" ? "on" : ""} onClick={() => setTab("home")}>Home</button>
          <button className={tab === "library" ? "on" : ""} onClick={() => setTab("library")}>Library</button>
          <button className={tab === "build" ? "on" : ""} onClick={() => setTab("build")}>Build</button>
          <button className={tab === "review" ? "on" : ""} onClick={() => setTab("review")}>Review <span>{reviewCount}</span></button>
          <button className={tab === "admin" ? "on" : ""} onClick={() => setTab("admin")}>Admin</button>
        </nav>
        <div className="rail-foot">
          <ThemeControl value={theme} onChange={setTheme} />
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

        {tab === "home" && <SopAttention state={state} userId={currentUser.id} role={role} setTab={setTab} />}
        {tab === "home" && (canManage(role) ? <ManagerHome state={state} setTab={setTab} select={setSelectedId} openGraph={setGraphModal} /> : <CrewHome state={state} userId={currentUser.id} select={(id) => { setSelectedId(id); setTab("build"); }} />)}
        <Suspense fallback={<TabSkeleton />}>
          {(tab === "library" || tab === "build") && <LazyContentTabs activeTab={tab} state={state} sop={selected} role={role} select={(id) => { setSelectedId(id); setTab("build"); }} setState={setState} openEdit={() => setSheet("edit")} approve={approveAction} attachFile={attachFile} />}
          {tab === "review" && <LazyReviewTab state={state} role={role} approve={approveAction} select={(id) => { setSelectedId(id); setTab("build"); }} />}
          {tab === "admin" && <LazyAdminTab state={state} setState={setState} />}
        </Suspense>
      </main>

      <footer className="mobile-nav">
        {(["home", "library", "build", "review"] as const).map((item) => <button key={item} className={tab === item ? "on" : ""} onClick={() => setTab(item)}>{titleFor(item)}</button>)}
      </footer>

      {sheet === "create" && <CreateSheet state={state} close={() => setSheet(null)} save={(draft) => setState((next) => createSop(next, draft))} />}
      {sheet === "edit" && selected && <EditSheet state={state} sop={selected} close={() => setSheet(null)} save={(patch) => setState((next) => ({ ...next, sops: next.sops.map((sop) => sop.id === selected.id ? { ...sop, ...patch, updatedAt: new Date().toISOString() } : sop) }))} />}
      <ToastHost />
      {graphModal && <GraphModal type={graphModal} state={state} onClose={() => setGraphModal(null)} />}
    </div>
  );
}

function TabSkeleton() { return <section className="panel card tab-skeleton" aria-label="Loading section"><i /><i /><i /></section>; }

function SopAttention({ state, userId, role, setTab }: { state: SopState; userId: string; role: Role; setTab: (tab: "library" | "build" | "review") => void }) {
  const assigned = state.sops.filter((sop) => sop.assignedTo === userId && ["assigned", "in_progress"].includes(sop.status)).length;
  const review = canManage(role) ? state.sops.filter((sop) => sop.status === "in_review").length : 0;
  const updated = state.notifications.filter((note) => note.userId === userId && note.type === "approved" && !note.read).length;
  const items = [{ count: assigned, label: "SOPs to complete", tab: "build" as const }, { count: review, label: "SOPs awaiting review", tab: "review" as const }, { count: updated, label: "Recently published updates", tab: "library" as const }].filter((item) => item.count > 0);
  if (!items.length) return null;
  return <section className="attention-strip" aria-label="Needs attention"><div className="attention-title"><span aria-hidden="true">!</span><b>Needs attention</b></div><div className="attention-rows">{items.map((item) => <button key={item.label} onClick={() => setTab(item.tab)}><span>{item.label}</span><b>{item.count}</b><span aria-hidden="true">→</span></button>)}</div></section>;
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

function ManagerHome({ state, setTab, select, openGraph }: { state: SopState; setTab: (tab: "review" | "library") => void; select: (id: string) => void; openGraph: (type: GraphType) => void }) {
  const stats = useMemo(() => state.categories.map((category) => {
    const sops = state.sops.filter((sop) => sop.categoryId === category.id && sop.status !== "archived");
    const published = sops.filter((sop) => sop.status === "published").length;
    return { category, sops, published };
  }), [state]);
  const review = state.sops.filter((sop) => sop.status === "in_review").slice(0, 4);
  const unassigned = state.sops.filter((sop) => !sop.assignedTo).length;
  return (
    <div className="grid two">
      <section className="panel card wide card-interactive" onClick={() => openGraph("category_breakdown")}>
        <div className="section-head"><h3>Library progress</h3><span className="pill">Chart</span><button onClick={(event) => { event.stopPropagation(); setTab("library"); }}>Open library</button></div>
        <div className="category-grid">
          {stats.map(({ category, sops, published }) => <div className="category-card" key={category.id}><b>{category.name}</b><span>{published} of {sops.length} documented</span><div className="bar"><i style={{ width: `${sops.length ? (published / sops.length) * 100 : 0}%` }} /></div></div>)}
        </div>
      </section>
      <section className="panel card">
        <h3>Review queue</h3>
        {review.map((sop) => <SopRow key={sop.id} state={state} sop={sop} onClick={() => { select(sop.id); setTab("review"); }} />)}
        {!review.length && <p className="muted">No SOPs waiting for approval.</p>}
      </section>
      <section className="panel card card-interactive" onClick={() => openGraph("completion_trend")}>
        <div className="section-head"><h3>Workload</h3><span className="pill">Chart</span></div>
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

function CreateSheet({ state, close, save }: { state: SopState; close: () => void; save: (draft: SopDraft) => void }) {
  const { showToast } = useToast();
  const [draft, setDraft] = useState<SopDraft>({ title: "", categoryId: state.categories[0].id, description: "", assignedTo: state.users.find((user) => user.role === "crew")?.id ?? state.users[0].id, createdBy: state.currentUserId, requiresPhoto: true, requiresVideo: false, dueDate: "" });
  return <Sheet title="New SOP" close={close}><FormFields state={state} draft={draft} setDraft={setDraft} /><button className="primary block" disabled={!draft.title.trim()} onClick={() => { save(draft); showToast("SOP created and assigned"); close(); }}>Create and assign</button></Sheet>;
}

function EditSheet({ state, sop, close, save }: { state: SopState; sop: SopItem; close: () => void; save: (patch: Partial<SopItem>) => void }) {
  const { showToast } = useToast();
  const [draft, setDraft] = useState<SopDraft>({ title: sop.title, categoryId: sop.categoryId, description: sop.description, assignedTo: sop.assignedTo, createdBy: sop.createdBy, requiresPhoto: sop.requiresPhoto, requiresVideo: sop.requiresVideo, dueDate: sop.dueDate ?? "" });
  return <Sheet title="Edit SOP" close={close}><FormFields state={state} draft={draft} setDraft={setDraft} /><button className="primary block" onClick={() => { save(draft); showToast("SOP changes saved"); close(); }}>Save changes</button></Sheet>;
}

function FormFields({ state, draft, setDraft }: { state: SopState; draft: SopDraft; setDraft: (draft: SopDraft) => void }) {
  return <div className="form"><label>Title<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label><label>Category<select value={draft.categoryId} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}>{state.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Description<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label><label>Assign to<select value={draft.assignedTo} onChange={(event) => setDraft({ ...draft, assignedTo: event.target.value })}>{state.users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label><label>Due date<input type="date" value={draft.dueDate ?? ""} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} /></label><label className="check"><input type="checkbox" checked={draft.requiresPhoto} onChange={(event) => setDraft({ ...draft, requiresPhoto: event.target.checked })} /> Requires photo</label><label className="check"><input type="checkbox" checked={draft.requiresVideo} onChange={(event) => setDraft({ ...draft, requiresVideo: event.target.checked })} /> Requires video</label></div>;
}

export function SopRow({ state, sop, onClick }: { state: SopState; sop: SopItem; onClick: () => void }) {
  return <button className="sop-row" onClick={onClick}><span className={`dot ${sop.status}`} /><div><b>{sop.title}</b><small>{nameOf(state, sop.assignedTo)} - {statusLabels[sop.status]}</small></div></button>;
}

export function Metric({ label, value }: { label: string; value: number }) {
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
  return <div className="login loading-screen"><section className="panel card"><div className="brand login-brand"><div className="drop logo loading-mark">+</div><div><h1>SOP+</h1><p>{text}</p></div></div><div className="loading-line" aria-hidden="true"><i /></div></section></div>;
}

function useStoredState(): [SopState, React.Dispatch<React.SetStateAction<SopState>>] {
  const [state, setState] = useState<SopState>(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as SopState : createSeedState();
  });
  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(state)), [state]);
  return [state, setState];
}

function titleFor(tab: string) {
  if (tab === "home") return "Home";
  if (tab === "library") return "Library";
  if (tab === "build") return "Build";
  if (tab === "review") return "Review";
  return "Admin";
}

export function nameOf(state: SopState, userId: string) {
  return state.users.find((user) => user.id === userId)?.name ?? "Unassigned";
}

function labelize(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}
