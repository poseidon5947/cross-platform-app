import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { themes, applyTheme, loadTheme, saveTheme } from "./themes";
import type { Theme } from "./themes";
import { defaultUIStyle, applyUIStyle, loadUIStyle, saveUIStyle } from "./uiStyle";
import type { UIStyle } from "./uiStyle";
import { ThemeEditor } from "./components/ThemeEditor";
import { UIStyleEditor } from "./components/UIStyleEditor";
import { GraphModal } from "./components/GraphModal";
import type { GraphType } from "./components/GraphModal";
import { categoryLabels, createSeedState } from "./data/seed";
import { validateMaterialsCsv } from "./data/csvImport";
import { drainOfflineQueue } from "./data/offline";
import {
  deleteTask,
  deleteCompletion,
  insertTransactions,
  invokeMaterialsImport,
  invokeQuickBooksConnect,
  invokeQuickBooksSync,
  loadProfile,
  loadRemoteState,
  persistPoints,
  replayCommand,
  saveTruckLog as saveRemoteTruckLog,
  upsertCompletion,
  updateTool,
  upsertMaterial,
  upsertSite,
  upsertTask,
} from "./data/repo";
import {
  applyTransactions,
  applyTruckLog,
  applyCostIncreaseFlag,
  batteryState,
  dailyProgress,
  evaluateDailyPoints,
  id,
  isTaskDone,
  money,
  monthlyInventoryLogCsv,
  normalizeMaterialUnit,
  periodKey,
  reorderEstimate,
  remapProvisionalMaterialUnit,
  serviceRequired,
  setExactCountDelta,
  stockStatus,
  todayKey,
  ALLOWED_MATERIAL_UNITS,
  priceIncreaseMaterials,
  stepForMaterialUnit,
} from "./domain/business";
import { isSupabaseConfigured, supabase } from "./integrations/supabase";
import type { AppState, Category, Material, MaterialUnit, Role, ServiceId, Site, TaskFrequency, ToolCondition, ToolItem, Transaction, TruckLog, TruckTask, TxType, User } from "./types";

const STORAGE_KEY = "warehouse-wizard-state-v4";
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true" || !isSupabaseConfigured();

const tabTitles = {
  home: ["Today", "Trucks, tools and stock at a glance"],
  inventory: ["Warehouse inventory", "Live counts, locked units and reorder thresholds"],
  log: ["Log materials", "Fast crew flow with offline sync"],
  tools: ["Tools & equipment", "Check in/out, damage and battery charge"],
  trucks: ["Trucks & daily tasks", "Daily, weekly and monthly work by service"],
  crew: ["Crew & points", "100% daily tasks earns points"],
  admin: ["Admin", "Imports, integrations, exports and role management"],
} as const;

type Tab = keyof typeof tabTitles;

function loadDemoState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return sanitizeStoredState(raw ? JSON.parse(raw) : createSeedState());
  } catch {
    return createSeedState();
  }
}

function sanitizeStoredState(state: AppState): AppState {
  return {
    ...state,
    materials: state.materials.map((material) => {
      const unit = normalizeMaterialUnit(String(material.unit)) ?? remapProvisionalMaterialUnit(`${material.unit} ${material.name}`);
      return { ...material, unit, step: stepForMaterialUnit(unit) };
    }),
  };
}

function persistDemo(state: AppState) {
  if (DEMO_MODE) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function canManage(role: Role | string) {
  return role === "admin" || role === "manager";
}

function canAdmin(role: Role | string) {
  return role === "admin";
}

export function App() {
  const queryClient = useQueryClient();
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [state, setStateInner] = useState(loadDemoState);
  const [tab, setTab] = useState<Tab>("home");
  const [toast, setToast] = useState("");
  const [confetti, setConfetti] = useState(false);
  const [sheet, setSheet] = useState<null | { title: string; content: React.ReactNode }>(null);
  const [graphModal, setGraphModal] = useState<GraphType | null>(null);
  const [currentTheme, setCurrentTheme] = useState<Theme>(() => {
    const t = loadTheme();
    applyTheme(t);
    return t;
  });
  const [uiStyle, setUiStyle] = useState<UIStyle>(() => {
    const s = loadUIStyle();
    applyUIStyle(s);
    return s;
  });
  const [showAppearance, setShowAppearance] = useState(false);

  const handleUIStyleChange = (next: UIStyle) => {
    setUiStyle(next);
    applyUIStyle(next);
    saveUIStyle(next);
  };

  const openThemeSheet = () => setShowAppearance(true);

  const remoteMode = !DEMO_MODE;
  const { data: remoteState, isLoading, error } = useQuery({
    queryKey: ["app-state", sessionUserId],
    queryFn: () => loadRemoteState(sessionUserId!),
    enabled: remoteMode && Boolean(sessionUserId),
  });

  useEffect(() => {
    if (!remoteMode || !supabase) return;
    supabase.auth.getSession().then(({ data }) => setSessionUserId(data.session?.user.id ?? null));
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUserId(session?.user.id ?? null);
      setProfile(null);
    });
    return () => authListener.subscription.unsubscribe();
  }, [remoteMode]);

  useEffect(() => {
    if (!remoteMode || !sessionUserId) return;
    loadProfile(sessionUserId).then(setProfile).catch(() => setProfile(null));
  }, [remoteMode, sessionUserId]);

  useEffect(() => {
    if (remoteState) setStateInner(remoteState);
  }, [remoteState]);

  const setState = (next: AppState | ((current: AppState) => AppState)) => {
    setStateInner((current) => {
      const updated = typeof next === "function" ? next(current) : next;
      persistDemo(updated);
      return updated;
    });
  };

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  };

  const currentUser = remoteMode
    ? profile ?? state.users.find((user) => user.id === sessionUserId) ?? state.users[0]
    : state.users.find((user) => user.id === state.currentUserId) ?? state.users[0];
  const pendingCount = state.offlineQueue.length;
  const [title, sub] = tabTitles[tab];

  useEffect(() => {
    const flush = async () => {
      if (!remoteMode || !navigator.onLine || state.offlineQueue.length === 0) return;
      const remaining = await drainOfflineQueue(state.offlineQueue, {
        logMaterials: replayCommand,
        completeTask: replayCommand,
        saveTruckLog: replayCommand,
      });
      setState((current) => ({ ...current, offlineQueue: remaining }));
      if (remaining.length === 0) {
        notify("Pending sync complete");
        queryClient.invalidateQueries({ queryKey: ["app-state"] });
      }
    };
    window.addEventListener("online", flush);
    flush();
    return () => window.removeEventListener("online", flush);
  }, [remoteMode, state.offlineQueue.length]);

  if (remoteMode && !sessionUserId) return <LoginScreen />;
  if (remoteMode && isLoading) return <ShellMessage title="Loading Warehouse Wizard" detail="Pulling live Supabase data." />;
  if (remoteMode && error) return <ShellMessage title="Could not load data" detail={String((error as Error).message)} />;

  const invalidateRemote = () => {
    if (remoteMode) queryClient.invalidateQueries({ queryKey: ["app-state"] });
  };

  const patchState = (fn: (draft: AppState) => AppState, message?: string) => {
    setState(fn);
    if (message) notify(message);
  };

  const switchDemoUser = (userId: string) => {
    patchState((current) => ({ ...current, currentUserId: userId }), "Signed in as demo user");
    setSheet(null);
  };

  const toggleTask = (taskId: string) => {
    patchState((current) => {
      const task = current.truckTasks.find((item) => item.id === taskId);
      if (!task) return current;
      const pk = periodKey(task.freq);
      const existing = current.taskCompletions.find(
        (completion) => completion.userId === current.currentUserId && completion.taskId === task.id && completion.periodKey === pk,
      );
      const completions = existing
        ? current.taskCompletions.filter((completion) => completion.id !== existing.id)
        : [...current.taskCompletions, { id: id("tc"), userId: current.currentUserId, taskId: task.id, periodKey: pk, completedAt: new Date().toISOString() }];
      const evaluated = evaluateDailyPoints({ ...current, taskCompletions: completions }, current.currentUserId);
      if (evaluated.events.some((event) => event.type === "daily_100")) {
        setConfetti(true);
        window.setTimeout(() => setConfetti(false), 1800);
        notify("100% complete. +25 points awarded.");
      }
      const queueItem = { id: id("oq"), type: "complete_task" as const, userId: current.currentUserId, taskId, periodKey: pk, queuedAt: new Date().toISOString() };
      let offlineQueue = current.offlineQueue;
      if (remoteMode) {
        if (navigator.onLine) {
          const syncCompletion = existing ? deleteCompletion(current.currentUserId, taskId, pk) : upsertCompletion(current.currentUserId, taskId, pk);
          syncCompletion
            .then(() => persistPoints(evaluated.events, evaluated.streak))
            .then(invalidateRemote)
            .catch(() => {
              notify("Task saved locally; it will sync when connection returns.");
              if (!existing) setState((latest) => ({ ...latest, offlineQueue: [...latest.offlineQueue, queueItem] }));
            });
        } else if (!existing) {
          offlineQueue = [...offlineQueue, queueItem];
        }
      }
      return { ...current, taskCompletions: completions, pointsEvents: [...current.pointsEvents, ...evaluated.events], streaks: upsertStreak(current.streaks, evaluated.streak), offlineQueue };
    });
  };

  const submitTransactions = (txs: Omit<Transaction, "id" | "ts">[]) => {
    patchState((current) => {
      const dated = txs.map((tx) => ({ ...tx, id: id("tx"), ts: new Date().toISOString() }));
      const queueItem = { id: id("oq"), type: "log_materials" as const, transactions: txs, queuedAt: new Date().toISOString() };
      if (remoteMode) {
        if (navigator.onLine) insertTransactions(txs).then(invalidateRemote).catch(() => setState((latest) => ({ ...latest, offlineQueue: [...latest.offlineQueue, queueItem] })));
        else return { ...current, transactions: [...dated, ...current.transactions], materials: applyTransactions(current.materials, dated), offlineQueue: [...current.offlineQueue, queueItem] };
      }
      return { ...current, transactions: [...dated, ...current.transactions], materials: applyTransactions(current.materials, dated) };
    }, navigator.onLine || !remoteMode ? "Log submitted" : "Saved offline. It will sync when connection returns.");
  };

  const setExactCount = (material: Material, targetQty: number) => {
    const delta = setExactCountDelta(material.qty, targetQty);
    if (delta === 0) return notify("Count is already exact");
    submitTransactions([{ materialId: material.id, qty: delta, type: "adjust", userId: currentUser.id, note: `Set exact count to ${targetQty}` }]);
    setSheet(null);
  };

  const saveMaterial = (material: Material, includeQty = true) => {
    const materialToSave = applyCostIncreaseFlag(state.materials.find((item) => item.id === material.id), material);
    patchState((current) => ({
      ...current,
      materials: current.materials.some((item) => item.id === material.id)
        ? current.materials.map((item) => (item.id === material.id ? materialToSave : item))
        : [materialToSave, ...current.materials],
    }), "Material saved");
    if (remoteMode) upsertMaterial(materialToSave, includeQty).then(invalidateRemote).catch((err) => notify(`Material sync failed: ${err.message}`));
  };

  const saveSite = (site: Site) => {
    patchState((current) => ({ ...current, sites: current.sites.some((item) => item.id === site.id) ? current.sites.map((item) => item.id === site.id ? site : item) : [...current.sites, site] }), "Site added");
    if (remoteMode) upsertSite(site).then(invalidateRemote).catch((err) => notify(`Site sync failed: ${err.message}`));
  };

  const saveTool = (tool: ToolItem, message = "Tool updated") => {
    patchState((current) => ({ ...current, tools: current.tools.map((item) => item.id === tool.id ? tool : item) }), message);
    if (remoteMode) updateTool(tool).then(invalidateRemote).catch((err) => notify(`Tool sync failed: ${err.message}`));
  };

  const saveTruck = (log: Omit<TruckLog, "id" | "ts">) => {
    patchState((current) => {
      const fullLog = { ...log, id: id("tl"), ts: new Date().toISOString() };
      const applied = applyTruckLog(current, fullLog);
      const queueItem = { id: id("oq"), type: "truck_log" as const, log, autoTaskIds: applied.autoTaskIds, pointsEvents: applied.pointsEventsCreated, streak: applied.streaks.find((row) => row.userId === log.driverId), queuedAt: new Date().toISOString() };
      if (remoteMode && navigator.onLine) saveRemoteTruckLog(log, applied.autoTaskIds, applied.pointsEventsCreated, applied.streaks.find((row) => row.userId === log.driverId)).then(invalidateRemote).catch(() => setState((latest) => ({ ...latest, offlineQueue: [...latest.offlineQueue, queueItem] })));
      return { ...current, trucks: applied.trucks, truckLogs: applied.truckLogs, taskCompletions: applied.taskCompletions, pointsEvents: applied.pointsEvents, streaks: applied.streaks, offlineQueue: remoteMode && !navigator.onLine ? [...current.offlineQueue, queueItem] : current.offlineQueue };
    }, "Truck log saved");
    setSheet(null);
  };

  const saveTask = (task: TruckTask) => {
    patchState((current) => ({ ...current, truckTasks: current.truckTasks.some((item) => item.id === task.id) ? current.truckTasks.map((item) => item.id === task.id ? task : item) : [...current.truckTasks, task] }), "Task saved");
    if (remoteMode) upsertTask(task).then(invalidateRemote).catch((err) => notify(`Task sync failed: ${err.message}`));
  };

  const removeTask = (taskId: string) => {
    patchState((current) => ({ ...current, truckTasks: current.truckTasks.filter((task) => task.id !== taskId) }), "Task deleted");
    if (remoteMode) deleteTask(taskId).then(invalidateRemote).catch((err) => notify(`Task delete failed: ${err.message}`));
  };

  const openToolsCheck = () => setSheet({
    title: "Check tools for job",
    content: <BulkToolSheet state={state} userId={currentUser.id} saveTool={saveTool} />,
  });

  const handlePrimaryAction = () => {
    if (tab === "log") setTab("inventory");
    else if (tab === "tools") openToolsCheck();
    else setTab("log");
  };

  const primaryActionLabel = tab === "log" ? "Back" : tab === "tools" ? "Check tools" : "Submit log";

  return (
    <div className="app">
      <header className="top">
        <div className="brandrow">
          <div className="brand">
            <span className="logo" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><defs><linearGradient id="dl" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#00d4ff"/><stop offset="100%" stopColor="#0099cc"/></linearGradient></defs><path d="M12 2.5c3.5 4.2 6 7.4 6 10.6a6 6 0 1 1-12 0c0-3.2 2.5-6.4 6-10.6Z" fill="url(#dl)" /><path d="M9.5 13.5a2.5 2.5 0 0 0 2.5 2.5" stroke="#060d1a" strokeWidth="1.8" strokeLinecap="round" /></svg></span>
            <div>Van Isle Water Proofing+<small>Warehouse & Crew Ops</small></div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button className="theme-quick-btn" onClick={openThemeSheet} title="Appearance settings">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v6m0 6v6M1 12h6m6 0h6M3.93 3.93l4.24 4.24m5.66 5.66l4.24 4.24M3.93 20.07l4.24-4.24m5.66-5.66l4.24-4.24"/></svg>
            </button>
            <button className="whoami" onClick={() => DEMO_MODE ? setSheet({ title: "Choose demo user", content: <UserSheet state={state} switchUser={switchDemoUser} /> }) : supabase?.auth.signOut()}>
              <span className="av" style={{ background: currentUser.color }}>{initials(currentUser.name)}</span>
              <span>{currentUser.name} · {currentUser.role}</span>
            </button>
          </div>
        </div>
        <div className="htitle">{title}</div>
        <div className="hsub">{pendingCount ? `${pendingCount} pending sync · ${sub}` : sub}</div>
      </header>

      <main>
        {tab === "home" && <Home state={state} userId={currentUser.id} setTab={setTab} openGraph={setGraphModal} />}
        {tab === "inventory" && <Inventory state={state} role={currentUser.role} openSheet={setSheet} saveMaterial={saveMaterial} setExactCount={setExactCount} setTab={setTab} />}
        {tab === "log" && <LogMaterials state={state} userId={currentUser.id} submitTransactions={submitTransactions} saveSite={saveSite} />}
        {tab === "tools" && <Tools state={state} role={currentUser.role} userId={currentUser.id} openSheet={setSheet} saveTool={saveTool} />}
        {tab === "trucks" && <Trucks state={state} role={currentUser.role} toggleTask={toggleTask} openSheet={setSheet} saveTruck={saveTruck} saveTask={saveTask} removeTask={removeTask} />}
        {tab === "crew" && <Crew state={state} role={currentUser.role} setState={setState} openSheet={setSheet} />}
        {tab === "admin" && <Admin state={state} role={currentUser.role} notify={notify} setState={setState} remoteMode={remoteMode} saveMaterial={saveMaterial} currentTheme={currentTheme} onThemeChange={(theme) => { setCurrentTheme(theme); applyTheme(theme); saveTheme(theme); }} openThemeEditor={() => setShowAppearance(true)} />}
      </main>

      <nav className="tabs">
        {(["home", "inventory", "tools", "trucks", "crew"] as Tab[]).map((item) => (
          <button key={item} className={tab === item ? "on" : ""} onClick={() => setTab(item)}>
            <NavIcon tab={item} />
            {item === "inventory" ? "Inventory" : item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
        {canManage(currentUser.role) && (
          <button className={tab === "admin" ? "on" : ""} onClick={() => setTab("admin")}>
            <NavIcon tab={"admin"} />
            Admin
          </button>
        )}
      </nav>
      <div className="bottom-bar">
        <button className="fab btn good" onClick={handlePrimaryAction}>{primaryActionLabel}</button>
      </div>
      {sheet && <BottomSheet title={sheet.title} onClose={() => setSheet(null)}>{sheet.content}</BottomSheet>}
      <div className={`toast ${toast ? "show" : ""}`}>{toast}</div>
      {confetti && <Confetti />}
      {graphModal && <GraphModal type={graphModal} state={state} onClose={() => setGraphModal(null)} />}
      {showAppearance && (
        <BottomSheet title="Appearance" onClose={() => setShowAppearance(false)}>
          <AppearanceSheet
            currentTheme={currentTheme}
            uiStyle={uiStyle}
            onThemeChange={(t) => { setCurrentTheme(t); applyTheme(t); saveTheme(t); }}
            onUIStyleChange={handleUIStyleChange}
            onClose={() => setShowAppearance(false)}
          />
        </BottomSheet>
      )}
    </div>
  );
}

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    const { error: signInError } = await supabase!.auth.signInWithPassword({ email, password });
    if (signInError) setError(signInError.message);
  };
  return <div className="app auth"><header className="top"><div className="brandrow"><div className="brand"><span className="logo"><svg viewBox="0 0 24 24" fill="none"><defs><linearGradient id="dl2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#00d4ff"/><stop offset="100%" stopColor="#0099cc"/></linearGradient></defs><path d="M12 2.5c3.5 4.2 6 7.4 6 10.6a6 6 0 1 1-12 0c0-3.2 2.5-6.4 6-10.6Z" fill="url(#dl2)" /><path d="M9.5 13.5a2.5 2.5 0 0 0 2.5 2.5" stroke="#060d1a" strokeWidth="1.8" strokeLinecap="round" /></svg></span>Van Isle Water Proofing+<small>Warehouse & Crew Ops</small></div></div><div className="htitle">Sign in</div><div className="hsub">Use your company account.</div></header><main><form className="card" onSubmit={submit}><label className="fld">Email</label><input className="in" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /><label className="fld">Password</label><input className="in" type="password" value={password} onChange={(event) => setPassword(event.target.value)} /><button className="btn primary block">Sign in</button>{error && <p className="tiny error">{error}</p>}</form></main></div>;
}

function ShellMessage({ title, detail }: { title: string; detail: string }) {
  return <div className="app auth"><header className="top"><div className="htitle">{title}</div><div className="hsub">{detail}</div></header></div>;
}

function Home({ state, userId, setTab, openGraph }: { state: AppState; userId: string; setTab: (tab: Tab) => void; openGraph: (t: GraphType) => void }) {
  const lows = state.materials.filter((material) => stockStatus(material).key !== "good");
  const today = todayKey();
  const usedToday = state.transactions.filter((tx) => tx.ts.slice(0, 10) === today && ["use", "deliver"].includes(tx.type)).reduce((sum, tx) => sum + tx.qty, 0);
  const losses = state.transactions.filter((tx) => tx.type === "loss" && Date.now() - new Date(tx.ts).getTime() < 30 * 86400000).reduce((sum, tx) => sum + tx.qty * (state.materials.find((material) => material.id === tx.materialId)?.cost ?? 0), 0);
  const progress = dailyProgress(state.truckTasks, state.taskCompletions, userId);
  const toolsOut = state.tools.filter((tool) => tool.status === "out").length;
  const chargeDue = state.tools.filter((tool) => tool.battery && batteryState(tool.lastCharged).key === "bad").length;
  const priceUps = priceIncreaseMaterials(state.materials);
  return <>
    <div className="banner"><b>{progress.pct === 100 ? "Daily tasks complete" : "Crew-first workflow"}</b><span>{progress.done}/{progress.total} daily tasks complete today.</span></div>
    <div className="kpis">
      <Kpi label="SKUs tracked"  value={state.materials.length}  sub={`across ${Object.keys(categoryLabels).length} categories`} onClick={() => openGraph("inventory_stock")} />
      <Kpi label="Need reorder"  value={lows.length}             sub={lows.length ? "below threshold" : "all stocked"} alert={lows.length > 0} onClick={() => openGraph("reorder_alert")} />
      <Kpi label="Units out today" value={usedToday}             sub="used + delivered" onClick={() => openGraph("activity_trend")} />
      <Kpi label="Losses (30d)"  value={money(losses)}           sub="damaged / spilled" alert={losses > 0} onClick={() => openGraph("losses_30d")} />
    </div>
    <section className="card card-interactive"><div className="sec-h"><h2>Reorder now</h2><button className="link" onClick={() => setTab("inventory")}>Open</button></div>{lows.slice(0, 5).map((material) => <MaterialMini key={material.id} material={material} />)}{lows.length === 0 && <div className="empty-state"><span className="empty-icon">✓</span><div className="empty-msg">All materials above reorder threshold</div></div>}</section>
    <section className="card card-interactive" onClick={() => openGraph("tools_status")}><div className="sec-h"><h2>Tools & equipment</h2><button className="link" onClick={(e) => { e.stopPropagation(); setTab("tools"); }}>Manage</button></div><div className="kpis compact"><Kpi label="Checked out" value={toolsOut} sub={`of ${state.tools.length}`} /><Kpi label="Charge due" value={chargeDue} sub="cordless batteries" alert={chargeDue > 0} /></div></section>
    <section className="card"><div className="sec-h"><h2>Price increases</h2><button className="link" onClick={() => setTab("admin")}>Report</button></div>{priceUps.slice(0, 4).map((material) => <div className="line-item" key={material.id}><b>{material.name}</b><span className="pill warn">{money(material.previousCost ?? 0)} to {money(material.cost)}</span></div>)}{priceUps.length === 0 && <div className="empty-state"><span className="empty-icon">OK</span><div className="empty-msg">No material price increases flagged</div></div>}</section>
    <section className="card card-interactive"><div className="sec-h"><h2>Today's truck tasks</h2><button className="link" onClick={() => setTab("trucks")}>Open</button></div><ProgressRing pct={progress.pct} /></section>
    <section className="card card-interactive" onClick={() => openGraph("activity_trend")}><div className="sec-h"><h2>Recent activity</h2><button className="link" onClick={(e) => { e.stopPropagation(); setTab("admin"); }}>Exports</button></div>{state.transactions.slice(0, 6).map((tx) => <Activity key={tx.id} state={state} tx={tx} />)}{state.transactions.length === 0 && <div className="empty-state"><span className="empty-icon">📋</span><div className="empty-msg">No activity logged yet</div></div>}</section>
  </>;
}

function Inventory({ state, role, openSheet, saveMaterial, setExactCount, setTab }: { state: AppState; role: Role; openSheet: (sheet: { title: string; content: React.ReactNode }) => void; saveMaterial: (material: Material, includeQty?: boolean) => void; setExactCount: (material: Material, qty: number) => void; setTab: (tab: Tab) => void }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const list = state.materials.filter((material) => (category === "all" || category === material.category || (category === "low" && stockStatus(material).key !== "good")) && (!query || `${material.name} ${material.bin}`.toLowerCase().includes(query.toLowerCase())));
  return <><button className="btn dark block" onClick={() => setTab("log")}>Log materials used / delivered</button><div className="search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search material or bin" /></div><div className="chips"><Chip on={category === "all"} onClick={() => setCategory("all")}>All {state.materials.length}</Chip><Chip on={category === "low"} onClick={() => setCategory("low")}>Reorder</Chip>{Object.entries(categoryLabels).map(([key, label]) => <Chip key={key} on={category === key} onClick={() => setCategory(key)}>{label}</Chip>)}</div><section className="card inv-card">{list.map((material) => <MaterialRow key={material.id} material={material} onClick={() => openSheet({ title: material.name, content: <MaterialDetail material={material} role={role} setExactCount={setExactCount} saveMaterial={saveMaterial} /> })} />)}</section>{canManage(role) && <button className="btn line block" onClick={() => openSheet({ title: "New material", content: <MaterialForm saveMaterial={saveMaterial} /> })}>Add new material</button>}</>;
}

function LogMaterials({ state, userId, submitTransactions, saveSite }: { state: AppState; userId: string; submitTransactions: (txs: Omit<Transaction, "id" | "ts">[]) => void; saveSite: (site: Site) => void }) {
  const [siteId, setSiteId] = useState(state.sites[0]?.id);
  const [serviceId, setServiceId] = useState<ServiceId>("wp");
  const [type, setType] = useState<TxType>("use");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [newSite, setNewSite] = useState("");
  const materials = state.materials.filter((material) => !query || material.name.toLowerCase().includes(query.toLowerCase()));
  const total = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  const add = (material: Material, sign = 1) => setCart((current) => ({ ...current, [material.id]: Math.max(0, (current[material.id] ?? 0) + sign * material.step) }));
  const submit = () => {
    if (!serviceRequired(siteId, serviceId) || total <= 0) return;
    submitTransactions(Object.entries(cart).filter(([, qty]) => qty > 0).map(([materialId, qty]) => ({ materialId, qty, type, siteId, serviceId, userId })));
    setCart({});
  };
  const addSite = () => {
    if (!newSite.trim()) return;
    const site = { id: id("s"), name: newSite.trim(), address: "", source: "manual" as const };
    saveSite(site);
    setSiteId(site.id);
    setNewSite("");
  };
  return <><section className="card"><label className="fld">Job site</label><div className="selrow">{state.sites.map((site) => <button key={site.id} className={`sopt ${siteId === site.id ? "on" : ""}`} onClick={() => setSiteId(site.id)}>{site.name}</button>)}</div><div className="row-action"><input className="in" value={newSite} onChange={(event) => setNewSite(event.target.value)} placeholder="+ Add job site" /><button className="btn line sm" onClick={addSite}>Add</button></div><label className="fld">Service</label><div className="selrow">{state.services.map((service) => <button key={service.id} className={`sopt ${serviceId === service.id ? "on" : ""}`} onClick={() => setServiceId(service.id)}>{service.name}</button>)}</div><div className="seg">{(["use", "deliver", "return", "receive", "loss"] as TxType[]).map((item) => <button key={item} className={type === item ? "on" : ""} onClick={() => setType(item)}>{item}</button>)}</div></section><div className="search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search materials to add" /></div><section className="card">{materials.map((material) => <div className="line-item" key={material.id}><div className="mid"><b>{material.name}</b><div className="tiny muted">{material.qty} {material.unit} on hand · locked unit</div></div><div className="qtybox"><button onClick={() => add(material, -1)}>-</button><input readOnly value={cart[material.id] ?? 0} /><button onClick={() => add(material, 1)}>+</button></div>{cart[material.id] > 0 && <button className="btn line sm" onClick={() => setCart((current) => ({ ...current, [material.id]: 0 }))}>Remove</button>}</div>)}</section>
    {total > 0 && (
      <div className="cart-summary">
        <div className="cart-summary-info">
          <span className="cart-summary-count">{Object.values(cart).filter(q => q > 0).length} items</span>
          <span className="cart-summary-sep">·</span>
          <span className="cart-summary-units">{total} units</span>
          <span className="cart-summary-sep">·</span>
          <span className="cart-summary-type">{type}</span>
        </div>
        <button className="cart-clear-btn" onClick={() => setCart({})}>Clear</button>
      </div>
    )}
    <button className="btn good block" disabled={total <= 0} onClick={submit}>Submit log ({total} units)</button></>;
}

function Tools({ state, role, userId, openSheet, saveTool }: { state: AppState; role: Role; userId: string; openSheet: (sheet: { title: string; content: React.ReactNode }) => void; saveTool: (tool: ToolItem, message?: string) => void }) {
  const [filter, setFilter] = useState<ServiceId | "all" | "charge">("all");
  const list = state.tools.filter((tool) => {
    if (filter === "charge") return tool.battery && batteryState(tool.lastCharged).key === "bad";
    if (filter === "all") return true;
    return tool.serviceId === filter;
  });
  return <><div className="kpis"><Kpi label="Checked out" value={state.tools.filter((tool) => tool.status === "out").length} sub={`of ${state.tools.length}`} /><Kpi label="Repair flags" value={state.tools.filter((tool) => tool.condition !== "good").length} sub="needs manager review" /></div><button className="btn primary block" onClick={() => openSheet({ title: "Check tools for job", content: <BulkToolSheet state={state} userId={userId} saveTool={saveTool} /> })}>Check tools for job</button><div className="chips"><Chip on={filter === "all"} onClick={() => setFilter("all")}>All</Chip><Chip on={filter === "charge"} onClick={() => setFilter("charge")}>🔋 Charge due {state.tools.filter(t => t.battery && batteryState(t.lastCharged).key === "bad").length > 0 ? `(${state.tools.filter(t => t.battery && batteryState(t.lastCharged).key === "bad").length})` : ""}</Chip>{state.services.map((service) => <Chip key={service.id} on={filter === service.id} onClick={() => setFilter(service.id)}>{service.name}</Chip>)}</div><section className="card">{list.map((tool) => { const charge = tool.battery ? batteryState(tool.lastCharged) : null; return <div className="tool-row" key={tool.id} onClick={() => openSheet({ title: tool.name, content: <ToolSheet state={state} role={role} userId={userId} tool={tool} saveTool={saveTool} /> })}><div><b>{tool.name}</b><div className="tiny muted">{serviceName(state, tool.serviceId)} {tool.status === "out" ? `- out with ${userName(state, tool.outBy)} - ${siteName(state, tool.outJob)}` : "- in warehouse"}</div></div><div className="tool-actions"><Pill tone={tool.status === "out" ? "warn" : "good"}>{tool.status}</Pill><Pill tone={tool.condition === "good" ? "good" : "bad"}>{tool.condition}</Pill>{charge && <Pill tone={charge.key}>{charge.label}</Pill>}</div></div>; })}</section></>;
}

function Trucks({ state, role, toggleTask, openSheet, saveTruck, saveTask, removeTask }: { state: AppState; role: Role; toggleTask: (taskId: string) => void; openSheet: (sheet: { title: string; content: React.ReactNode }) => void; saveTruck: (log: Omit<TruckLog, "id" | "ts">) => void; saveTask: (task: TruckTask) => void; removeTask: (id: string) => void }) {
  const [freq, setFreq] = useState<TaskFrequency>("daily");
  const [serviceId, setServiceId] = useState<ServiceId | "all">("all");
  const progress = dailyProgress(state.truckTasks, state.taskCompletions, state.currentUserId);
  const visibleTasks = state.truckTasks.filter((task) => task.freq === freq && (serviceId === "all" || task.serviceId === serviceId));

  // Separate by type
  const allShownDone = visibleTasks.length > 0 && visibleTasks.every((task) => isTaskDone(state.taskCompletions, state.currentUserId, task));
  const markAllShown = () => visibleTasks.filter((task) => !isTaskDone(state.taskCompletions, state.currentUserId, task)).forEach((task) => toggleTask(task.id));

  // For veh or all: split into groups
  const vehicleTasks = visibleTasks.filter((task) => task.serviceId === "veh" && task.timeOfDay !== "pack_list");
  const packTasks = visibleTasks.filter((task) => task.timeOfDay === "pack_list");
  const startTasks = vehicleTasks.filter((task) => task.timeOfDay === "start");
  const endTasks = vehicleTasks.filter((task) => task.timeOfDay === "end");
  const otherVehTasks = vehicleTasks.filter((task) => !task.timeOfDay);
  // Non-veh service tasks
  const serviceTasks = visibleTasks.filter((task) => task.serviceId !== "veh");
  const currentServiceName = serviceId !== "all" ? (state.services.find(s => s.id === serviceId)?.name ?? serviceId) : "";

  return <>
    {state.trucks.length > 0 && (
      <section className="card">
        <div className="sec-h"><h2>Fleet</h2></div>
        <div className="truck-list">
          {state.trucks.map(truck => {
            const lastLog = state.truckLogs.filter(l => l.truckId === truck.id).sort((a, b) => b.ts.localeCompare(a.ts))[0];
            return (
              <div className="truck-item" key={truck.id}>
                <div className="truck-icon">🚛</div>
                <div className="mid">
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{truck.name}</div>
                  <div className="tiny muted">{truck.km.toLocaleString()} km · last service {new Date(truck.lastServiced).toLocaleDateString('en-CA')}</div>
                </div>
                {lastLog && <div className="tiny muted">{new Date(lastLog.ts).toLocaleDateString('en-CA')}</div>}
              </div>
            );
          })}
        </div>
      </section>
    )}
    <section className="card"><ProgressRing pct={progress.pct} /><button className="btn primary block" onClick={() => openSheet({ title: "Gas Station Check", content: <TruckLogForm state={state} saveTruck={saveTruck} /> })}>Gas Station Check</button></section>
    <div className="seg">{(["daily", "weekly", "monthly"] as TaskFrequency[]).map((item) => <button key={item} className={freq === item ? "on" : ""} onClick={() => setFreq(item)}>{item}</button>)}</div>
    <div className="chips"><Chip on={serviceId === "all"} onClick={() => setServiceId("all")}>All</Chip>{state.services.map((service) => <Chip key={service.id} on={serviceId === service.id} onClick={() => setServiceId(service.id)}>{service.name}</Chip>)}</div>
    <button className="btn line block" disabled={visibleTasks.length === 0 || allShownDone} onClick={markAllShown}>Mark all shown done</button>
    {serviceId !== "all" && serviceId !== "veh" && serviceTasks.length > 0
      ? <TaskGroup title={currentServiceName + " Tasks"} subtitle={"Service-specific checklist"} tasks={serviceTasks} state={state} toggleTask={toggleTask} />
      : <>
          <TaskGroup title="Start of Day" subtitle="Before 8am - vehicle / general" tasks={startTasks} state={state} toggleTask={toggleTask} />
          <TaskGroup title="End of Day" subtitle="Before 4pm - vehicle / general" tasks={endTasks} state={state} toggleTask={toggleTask} />
          {otherVehTasks.length > 0 && <TaskGroup title="Vehicle / General" subtitle="No time assigned" tasks={otherVehTasks} state={state} toggleTask={toggleTask} />}
          {packTasks.length > 0 && <TaskGroup title="Service packing list" subtitle="Job-specific checklist - not required for daily points" tasks={packTasks} state={state} toggleTask={toggleTask} />}
        </>
    }
    {canManage(role) && <button className="btn line block" onClick={() => openSheet({ title: "Edit task list", content: <TaskEditor state={state} saveTask={saveTask} removeTask={removeTask} /> })}>Edit task list</button>}
  </>;
}

function TaskGroup({ title, subtitle, tasks, state, toggleTask }: { title: string; subtitle: string; tasks: TruckTask[]; state: AppState; toggleTask: (taskId: string) => void }) {
  return <section className="card"><div className="sec-h"><div><h2>{title}</h2><div className="tiny muted">{subtitle}</div></div><Pill tone={tasks.length ? "neu" : "warn"}>{tasks.length}</Pill></div>{tasks.length ? tasks.map((task) => <TaskRow key={task.id} task={task} done={isTaskDone(state.taskCompletions, state.currentUserId, task)} toggleTask={toggleTask} />) : <p className="tiny muted">No tasks for this filter.</p>}</section>;
}

function CrewMemberSheet({ user, state }: { user: { id: string; name: string; role: Role; color: string; points: number }; state: AppState }) {
  const events = state.pointsEvents.filter(e => e.userId === user.id).slice().reverse().slice(0, 20);
  const streak = state.streaks.find(s => s.userId === user.id);
  const total = user.points + state.pointsEvents.filter(e => e.userId === user.id).reduce((s, e) => s + e.points, 0);
  const progress = dailyProgress(state.truckTasks, state.taskCompletions, user.id);
  return (
    <div>
      <div className="crew-profile">
        <div className="av-xl" style={{ background: user.color }}>{initials(user.name)}</div>
        <div>
          <div className="crew-name">{user.name}</div>
          <div className="tiny muted">{user.role}</div>
        </div>
      </div>
      <div className="kpis" style={{ marginTop: 14 }}>
        <Kpi label="Total points" value={total} sub="all time" />
        <Kpi label="Today" value={`${progress.pct}%`} sub={`${progress.done}/${progress.total} tasks`} />
        <Kpi label="Streak" value={streak?.count ?? 0} sub="day streak" />
        <Kpi label="Events" value={events.length} sub="recent 20" />
      </div>
      {streak && streak.count > 0 && (
        <div className="streak-badge">🔥 {streak.count}-day streak — last award {streak.awardedOn ? new Date(streak.awardedOn).toLocaleDateString('en-CA') : 'none'}</div>
      )}
      <div className="sec-h" style={{ marginTop: 16 }}><h2>Points history</h2></div>
      <section className="card">
        {events.length === 0 && <p className="tiny muted">No points events yet.</p>}
        {events.map(e => (
          <div className="line-item" key={e.id}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{e.reason}</div>
              <div className="tiny muted">{new Date(e.ts).toLocaleDateString('en-CA')}</div>
            </div>
            <span className={`pill ${e.points >= 0 ? 'good' : 'bad'}`}>{e.points > 0 ? '+' : ''}{e.points}</span>
          </div>
        ))}
      </section>
    </div>
  );
}

function Crew({ state, role, setState, openSheet }: { state: AppState; role: Role; setState: (state: AppState | ((current: AppState) => AppState)) => void; openSheet: (sheet: { title: string; content: React.ReactNode }) => void }) {
  const ranked = state.users.map((user) => ({ ...user, total: user.points + state.pointsEvents.filter((event) => event.userId === user.id).reduce((sum, event) => sum + event.points, 0), progress: dailyProgress(state.truckTasks, state.taskCompletions, user.id).pct })).sort((a, b) => b.total - a.total);
  return <><section className="card">{ranked.map((user, index) => <div className="lb" key={user.id} style={{ cursor: 'pointer' }} onClick={() => openSheet({ title: user.name, content: <CrewMemberSheet user={user} state={state} /> })}><div className={`rank ${index === 0 ? "top" : ""}`}>{index + 1}</div><div className="av-lg" style={{ background: user.color }}>{initials(user.name)}</div><div><b>{user.name}</b><div className="tiny muted">{user.role} · {user.progress}% today</div></div>{(() => {
    const streak = state.streaks.find(s => s.userId === user.id);
    return streak && streak.count >= 2 ? (
      <span className="streak-pill">🔥 {streak.count}</span>
    ) : null;
  })()}<div className="pts"><b>{user.total}</b><div className="tiny muted">points</div></div></div>)}{ranked.length === 0 && <div className="empty-state"><span className="empty-icon">👥</span><div className="empty-msg">No crew members found</div></div>}</section><section className="card"><h3>How points work</h3><p className="tiny muted">Completing 100% of daily truck tasks awards +25 points once per Vancouver workday. Every 5-day streak adds +25. Reversals are append-only events so PEOPLE can audit the ledger.</p></section>{DEMO_MODE && canAdmin(role) && <button className="btn danger block" onClick={() => setState(createSeedState())}>Reset demo data</button>}</>;
}

function Admin({ state, role, notify, remoteMode, saveMaterial, currentTheme, onThemeChange, openThemeEditor }: { state: AppState; role: Role; notify: (message: string) => void; setState: (state: AppState | ((current: AppState) => AppState)) => void; remoteMode: boolean; saveMaterial: (material: Material, includeQty?: boolean) => void; currentTheme: Theme; onThemeChange: (theme: Theme) => void; openThemeEditor: () => void }) {
  const estimate = reorderEstimate(state.materials);
  const csv = useMemo(() => transactionsCsv(state), [state]);
  const [exportMonth, setExportMonth] = useState(new Date().toISOString().slice(0, 7));
  const monthlyCsv = useMemo(() => monthlyInventoryLogCsv(state, exportMonth), [state, exportMonth]);
  const priceUps = priceIncreaseMaterials(state.materials);
  const [report, setReport] = useState<string>(() => priceUps.length ? `${priceUps.length} price increase flag${priceUps.length === 1 ? "" : "s"} active` : "");
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

function MaterialDetail({ material, role, setExactCount, saveMaterial }: { material: Material; role: Role; setExactCount: (material: Material, qty: number) => void; saveMaterial: (material: Material, includeQty?: boolean) => void }) {
  const [qty, setQty] = useState(material.qty);
  return <div><MaterialRow material={material} /><label className="fld">Exact stock count</label><input className="in" type="number" value={qty} onChange={(event) => setQty(Number(event.target.value))} disabled={!canManage(role)} /><button className="btn primary block" disabled={!canManage(role)} onClick={() => setExactCount(material, qty)}>Set exact count</button>{canManage(role) && <MaterialForm material={material} saveMaterial={saveMaterial} />}</div>;
}

function MaterialForm({ material, saveMaterial }: { material?: Material; saveMaterial: (material: Material, includeQty?: boolean) => void }) {
  const [draft, setDraft] = useState<Material>(material ?? { id: id("m"), name: "", category: "waterproofing", unit: "Unit", step: 1, pack: "", unitsPerPallet: 0, cost: 0, qty: 0, reorderPoint: 1, bin: "" });
  const set = <K extends keyof Material>(key: K, value: Material[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const setUnit = (unit: MaterialUnit) => setDraft((current) => ({ ...current, unit, step: stepForMaterialUnit(unit) }));
  return <div className="form-stack"><label className="fld">Name</label><input className="in" value={draft.name} onChange={(event) => set("name", event.target.value)} /><div className="row2"><div><label className="fld">Category</label><select className="in" value={draft.category} onChange={(event) => set("category", event.target.value as Category)}>{Object.entries(categoryLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div><div><label className="fld">Locked unit</label><select className="in" value={draft.unit} onChange={(event) => setUnit(event.target.value as MaterialUnit)}>{ALLOWED_MATERIAL_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></div></div><div className="row2"><div><label className="fld">Step</label><input className="in" readOnly value={draft.step === 0.25 ? "Quarter" : "Whole"} /></div><div><label className="fld">Bin</label><input className="in" value={draft.bin} onChange={(event) => set("bin", event.target.value)} /></div></div><label className="fld">Pack note</label><input className="in" value={draft.pack} onChange={(event) => set("pack", event.target.value)} /><div className="row2"><NumberField label="Units/pallet" value={draft.unitsPerPallet} setValue={(value) => set("unitsPerPallet", value)} /><NumberField label="Cost" value={draft.cost} setValue={(value) => set("cost", value)} step={0.01} /></div><div className="row2"><NumberField label="On hand" value={draft.qty} setValue={(value) => set("qty", value)} step={draft.step} /><NumberField label="Reorder" value={draft.reorderPoint} setValue={(value) => set("reorderPoint", value)} step={draft.step} /></div><button className="btn primary block" onClick={() => saveMaterial(draft)}>Save material</button></div>;
}

function BulkToolSheet({ state, userId, saveTool }: { state: AppState; userId: string; saveTool: (tool: ToolItem, message?: string) => void }) {
  const [siteId, setSiteId] = useState(state.sites[0]?.id ?? "");
  const [serviceId, setServiceId] = useState<ServiceId>("wp");
  const tools = state.tools.filter((tool) => tool.serviceId === serviceId || tool.serviceId === "veh");
  const checkout = (tool: ToolItem) => saveTool({ ...tool, status: "out", outBy: userId, outJob: siteId, outService: serviceId, outTs: new Date().toISOString() }, "Checked out");
  const checkin = (tool: ToolItem) => saveTool({ ...tool, status: "in", outBy: undefined, outJob: undefined, outService: undefined, outTs: undefined }, "Checked in");
  return <div><label className="fld">Job</label><select className="in" value={siteId} onChange={(event) => setSiteId(event.target.value)}>{state.sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select><label className="fld">Service</label><select className="in" value={serviceId} onChange={(event) => setServiceId(event.target.value as ServiceId)}>{state.services.filter((service) => service.id !== "veh").map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select><section className="card compact-card">{tools.map((tool) => <div className="tool-row" key={tool.id}><div><b>{tool.name}</b><div className="tiny muted">{tool.status === "out" ? `${userName(state, tool.outBy)} - ${siteName(state, tool.outJob)}` : "Available in warehouse"}</div></div><button className={`btn sm ${tool.status === "out" ? "line" : "primary"}`} disabled={!siteId && tool.status === "in"} onClick={() => tool.status === "out" ? checkin(tool) : checkout(tool)}>{tool.status === "out" ? "Check in" : "Check out"}</button></div>)}</section></div>;
}

function ToolSheet({ state, role, userId, tool, saveTool }: { state: AppState; role: Role; userId: string; tool: ToolItem; saveTool: (tool: ToolItem, message?: string) => void }) {
  const [siteId, setSiteId] = useState(tool.outJob ?? state.sites[0]?.id ?? "");
  const [serviceId, setServiceId] = useState<ServiceId>(tool.outService ?? tool.serviceId);
  const [note, setNote] = useState(tool.note ?? "");
  const markCondition = (condition: ToolCondition) => saveTool({ ...tool, condition, note }, "Tool condition updated");
  const checkout = () => siteId && serviceId && saveTool({ ...tool, status: "out", outBy: userId, outJob: siteId, outService: serviceId, outTs: new Date().toISOString() }, "Checked out");
  return <div><div className="line-item"><b>Status</b><Pill tone={tool.status === "out" ? "warn" : "good"}>{tool.status}</Pill></div>{tool.battery && <div className="line-item"><b>Battery</b><Pill tone={batteryState(tool.lastCharged).key}>{batteryState(tool.lastCharged).label}</Pill></div>}<label className="fld">Job</label><select className="in" value={siteId} onChange={(event) => setSiteId(event.target.value)}>{state.sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select><label className="fld">Service</label><select className="in" value={serviceId} onChange={(event) => setServiceId(event.target.value as ServiceId)}>{state.services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select><label className="fld">Damage / repair note</label><textarea className="in" value={note} onChange={(event) => setNote(event.target.value)} /><button className="btn primary block" onClick={tool.status === "out" ? () => saveTool({ ...tool, status: "in", outBy: undefined, outJob: undefined, outService: undefined, outTs: undefined }, "Checked in") : checkout}>{tool.status === "out" ? "Check in" : "Check out"}</button>{tool.battery && <button className="btn line block" onClick={() => saveTool({ ...tool, lastCharged: new Date().toISOString() }, "Marked charged")}>Mark charged</button>}{canManage(role) && <div className="row-action"><button className="btn line sm" onClick={() => markCondition("damaged")}>Report damage</button><button className="btn line sm" onClick={() => markCondition("repair")}>Send to repair</button><button className="btn line sm" onClick={() => markCondition("good")}>Back in service</button></div>}</div>;
}

function TruckLogForm({ state, saveTruck }: { state: AppState; saveTruck: (log: Omit<TruckLog, "id" | "ts">) => void }) {
  const [truckId, setTruckId] = useState(state.trucks[0]?.id ?? "");
  const truck = state.trucks.find((item) => item.id === truckId);
  const [km, setKm] = useState(truck?.km ?? 0);
  const [siteId, setSiteId] = useState(state.sites[0]?.id ?? "");
  const [serviceId, setServiceId] = useState<ServiceId>("veh");
  const [fuelTopped, setFuelTopped] = useState(false);
  const [oilChecked, setOilChecked] = useState(false);
  const [exteriorWash, setExteriorWash] = useState(false);
  const [gasStation, setGasStation] = useState("");
  const [totalCost, setTotalCost] = useState(0);
  const [receiptPhotoName, setReceiptPhotoName] = useState("");
  const [repairs, setRepairs] = useState("");
  const [notes, setNotes] = useState("");
  return <div><label className="fld">Truck</label><select className="in" value={truckId} onChange={(event) => { setTruckId(event.target.value); setKm(state.trucks.find((item) => item.id === event.target.value)?.km ?? 0); }}>{state.trucks.map((item) => <option key={item.id} value={item.id}>{item.name} - {item.km} km</option>)}</select><NumberField label="Odometer KM" value={km} setValue={setKm} /><label className="fld">Job</label><select className="in" value={siteId} onChange={(event) => setSiteId(event.target.value)}>{state.sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select><label className="fld">Service</label><select className="in" value={serviceId} onChange={(event) => setServiceId(event.target.value as ServiceId)}>{state.services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select><label className="fld">Gas station</label><input className="in" value={gasStation} onChange={(event) => setGasStation(event.target.value)} placeholder="Station name" /><NumberField label="Total cost with GST" value={totalCost} setValue={setTotalCost} step={0.01} /><label className="fld">Receipt photo</label><input className="in" type="file" accept="image/*" onChange={(event) => setReceiptPhotoName(event.target.files?.[0]?.name ?? "")} />{receiptPhotoName && <p className="tiny muted">Receipt: {receiptPhotoName}</p>}<label className="check"><input type="checkbox" checked={fuelTopped} onChange={(event) => setFuelTopped(event.target.checked)} /> Fuel topped</label><label className="check"><input type="checkbox" checked={oilChecked} onChange={(event) => setOilChecked(event.target.checked)} /> Oil checked</label><label className="check"><input type="checkbox" checked={exteriorWash} onChange={(event) => setExteriorWash(event.target.checked)} /> Exterior wash</label><label className="fld">Repairs / issues</label><textarea className="in" value={repairs} onChange={(event) => setRepairs(event.target.value)} /><label className="fld">Notes</label><textarea className="in" value={notes} onChange={(event) => setNotes(event.target.value)} /><button className="btn primary block" disabled={!truckId || !siteId || !gasStation.trim() || totalCost <= 0} onClick={() => saveTruck({ truckId, km, driverId: state.currentUserId, siteId, serviceId, oilChecked, fuelTopped, gasStation: gasStation.trim(), totalCost, receiptPhotoName, exteriorWash, repairs, notes })}>Save Gas Station Check</button></div>;
}

function TaskEditor({ state, saveTask, removeTask }: { state: AppState; saveTask: (task: TruckTask) => void; removeTask: (id: string) => void }) {
  const [draft, setDraft] = useState<TruckTask>({ id: id("k"), text: "", serviceId: "veh", freq: "daily", timeOfDay: "start", requiredForDailyPoints: true });
  return <div><section className="card">{state.truckTasks.map((task) => <div className="line-item" key={task.id}><span>{task.text}</span><span className="tiny muted">{taskTimeLabel(task)}</span><button className="btn line sm" onClick={() => setDraft(task)}>Edit</button><button className="btn line sm" onClick={() => removeTask(task.id)}>Delete</button></div>)}</section><label className="fld">Task</label><input className="in" value={draft.text} onChange={(event) => setDraft((current) => ({ ...current, text: event.target.value }))} /><div className="row2"><select className="in" value={draft.serviceId} onChange={(event) => setDraft((current) => ({ ...current, serviceId: event.target.value as ServiceId }))}>{state.services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select><select className="in" value={draft.freq} onChange={(event) => setDraft((current) => ({ ...current, freq: event.target.value as TaskFrequency }))}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></div><div className="row2"><select className="in" value={draft.timeOfDay ?? ""} onChange={(event) => setDraft((current) => ({ ...current, timeOfDay: (event.target.value || undefined) as TruckTask["timeOfDay"] }))}><option value="">No time</option><option value="start">Start of Day</option><option value="end">End of Day</option><option value="pack_list">Service packing list</option><option value="job_start">Job start</option><option value="job_completion">Job completion</option></select><label className="check"><input type="checkbox" checked={draft.requiredForDailyPoints !== false} onChange={(event) => setDraft((current) => ({ ...current, requiredForDailyPoints: event.target.checked }))} /> Counts for daily points</label></div><button className="btn primary block" onClick={() => saveTask(draft)}>Save task</button></div>;
}

function taskTimeLabel(task: TruckTask) {
  if (task.timeOfDay === "start") return "Start of Day";
  if (task.timeOfDay === "end") return "End of Day";
  if (task.timeOfDay === "pack_list") return "Packing list";
  if (task.timeOfDay === "job_start") return "Job start";
  if (task.timeOfDay === "job_completion") return "Job completion";
  return "No time";
}

function NumberField({ label, value, setValue, step = 1 }: { label: string; value: number; setValue: (value: number) => void; step?: number }) {
  return <div><label className="fld">{label}</label><input className="in" type="number" step={step} value={value} onChange={(event) => setValue(Number(event.target.value))} /></div>;
}

function Kpi({ label, value, sub, alert, onClick }: { label: string; value: string | number; sub: string; alert?: boolean; onClick?: () => void }) {
  return <div className={`kpi ${alert ? "alert" : ""} ${onClick ? "kpi-clickable" : ""}`} onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined} onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}><div className="k-lab"><span className="dot" />{label}</div><div className="k-val">{value}</div><div className="k-sub">{sub}{onClick && <span className="kpi-hint">View chart →</span>}</div></div>;
}

function MaterialRow({ material, onClick }: { material: Material; onClick?: () => void }) {
  const status = stockStatus(material);
  const pct = Math.max(6, Math.min(100, (material.qty / Math.max(material.reorderPoint * 1.6, 1)) * 100));
  return <div className="inv" onClick={onClick}><div className="ic">{categoryLabels[material.category].slice(0, 2).toUpperCase()}</div><div className="mid"><div className="nm">{material.name}</div><div className="meta">{material.bin} · reorder {material.reorderPoint} · {money(material.cost)}/{material.unit} · {material.pack}</div><div className="bar"><i style={{ width: `${pct}%` }} className={status.key} /></div></div><div className="qtywrap"><div className="qty">{material.qty}</div><Pill tone={status.key}>{status.label}</Pill></div></div>;
}

function MaterialMini({ material }: { material: Material }) {
  const need = Math.max(0, material.reorderPoint - material.qty + material.reorderPoint * 0.2);
  return <div className="line-item"><b>{material.name}</b><span className="tiny muted">need {formatQty(need, material.step)} {material.unit}</span></div>;
}

function formatQty(value: number, step: Material["step"]) {
  return value.toFixed(step === 0.25 ? 2 : step === 0.5 ? 1 : 0).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function ProgressRing({ pct }: { pct: number }) {
  return <div className="ring-wrap"><div className="ring" style={{ "--p": pct } as React.CSSProperties}><b>{pct}%</b></div><div><b>{pct === 100 ? "Points secured" : "Keep moving"}</b><div className="tiny muted">100% daily completion awards +25 points.</div></div></div>;
}

function TaskRow({ task, done, toggleTask }: { task: { id: string; text: string }; done: boolean; toggleTask: (taskId: string) => void }) {
  return <div className={`task ${done ? "done" : ""}`} onClick={() => toggleTask(task.id)}><span className="cbx"><svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6" fill="none" stroke="currentColor" strokeWidth="3" /></svg></span><span className="tk-txt">{task.text}</span></div>;
}

function Activity({ state, tx }: { state: AppState; tx: Transaction }) {
  const material = state.materials.find((item) => item.id === tx.materialId);
  return <div className="act"><div className="ai">{tx.type.slice(0, 2).toUpperCase()}</div><div className="atxt"><b>{tx.type}</b> {tx.qty} {material?.unit} {material?.name}<div className="tiny muted">{userName(state, tx.userId)} · {siteName(state, tx.siteId)}</div></div><div className="atime">{new Date(tx.ts).toLocaleDateString("en-CA")}</div></div>;
}

function BottomSheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <><div className="sheet-bg open" onClick={onClose} /><div className="sheet open"><div className="grip" /><div className="sh-head"><h3>{title}</h3><button className="x" onClick={onClose}>x</button></div><div className="sh-body">{children}</div></div></>;
}

function UserSheet({ state, switchUser }: { state: AppState; switchUser: (id: string) => void }) {
  return <div>{state.users.map((user) => <button className="line-item user-choice" key={user.id} onClick={() => switchUser(user.id)}><span className="av-lg" style={{ background: user.color }}>{initials(user.name)}</span><b>{user.name}</b><span className="pill neu">{user.role}</span></button>)}</div>;
}

function Pill({ tone, children }: { tone: "good" | "warn" | "bad" | "neu"; children: React.ReactNode }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

function Chip({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return <button className={`chip ${on ? "on" : ""}`} onClick={onClick}>{children}</button>;
}

function Confetti() {
  return <div className="confetti">{Array.from({ length: 36 }).map((_, index) => <i key={index} style={{ left: `${(index * 29) % 100}%`, background: ["#12b3a6", "#0b6ea8", "#c9820a", "#6b57d4"][index % 4], animationDuration: `${900 + index * 18}ms` }} />)}</div>;
}

// ── Appearance sheet: tabbed Theme + UI Style ─────────────
function AppearanceSheet({ currentTheme, uiStyle, onThemeChange, onUIStyleChange, onClose }: {
  currentTheme: Theme;
  uiStyle: UIStyle;
  onThemeChange: (t: Theme) => void;
  onUIStyleChange: (s: UIStyle) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = React.useState<'theme' | 'style'>('theme');
  return (
    <div className="appearance-sheet">
      <div className="appearance-tabs">
        <button className={tab === 'theme' ? 'on' : ''} onClick={() => setTab('theme')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><circle cx="12" cy="12" r="3"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
          Colors
        </button>
        <button className={tab === 'style' ? 'on' : ''} onClick={() => setTab('style')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
          UI Style
        </button>
      </div>
      <div className="appearance-body">
        {tab === 'theme' && (
          <ThemeEditor
            currentTheme={currentTheme}
            onThemeChange={onThemeChange}
            onClose={onClose}
          />
        )}
        {tab === 'style' && (
          <UIStyleEditor
            value={uiStyle}
            onChange={onUIStyleChange}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

function NavIcon({ tab }: { tab: Tab | "admin" }) {
  const icons: Record<Tab | "admin", React.ReactNode> = {
    home: <svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></svg>,
    inventory: <svg viewBox="0 0 24 24"><path d="M3 7l9-4 9 4-9 4-9-4Z" /><path d="M3 7v10l9 4 9-4V7" /><path d="M12 11v10" /></svg>,
    tools: <svg viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4l-6 6a1.5 1.5 0 0 0 2 2l6-6a4 4 0 0 0 5.4-5.4l-2.3 2.3-2-2 2.3-2.3Z" /></svg>,
    trucks: <svg viewBox="0 0 24 24"><path d="M3 6h11v9H3z" /><path d="M14 9h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></svg>,
    crew: <svg viewBox="0 0 24 24"><path d="M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /><path d="M2 21a6 6 0 0 1 12 0" /><path d="M16 4a4 4 0 0 1 0 8M22 21a6 6 0 0 0-6-6" /></svg>,
    log: null,
    admin: <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/><path d="M18 2l1.5 1.5M18 7l1.5-1.5M13 2l-1.5 1.5M13 7l-1.5-1.5"/></svg>,
  };
  return <span className="nav-svg">{icons[tab]}</span>;
}

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function userName(state: AppState, idValue?: string) {
  return state.users.find((user) => user.id === idValue)?.name ?? "Unassigned";
}

function siteName(state: AppState, idValue?: string) {
  return state.sites.find((site) => site.id === idValue)?.name ?? "No site";
}

function serviceName(state: AppState, idValue?: ServiceId) {
  return state.services.find((service) => service.id === idValue)?.name ?? "Service";
}

function upsertStreak(streaks: AppState["streaks"], streak: AppState["streaks"][number]) {
  return streaks.some((row) => row.userId === streak.userId) ? streaks.map((row) => row.userId === streak.userId ? streak : row) : [...streaks, streak];
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
