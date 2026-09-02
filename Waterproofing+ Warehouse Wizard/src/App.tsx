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
import { SuiteSwitcher } from "./components/SuiteSwitcher";
import { ThemeControl, useThemePreference } from "./components/ThemeControl";
import { ToastHost, useToast } from "./components/Toast";
import { IntroVideo } from "./components/IntroVideo";
import { categoryLabels, createSeedState } from "./data/seed";
import { validateMaterialsCsv } from "./data/csvImport";
import { drainOfflineQueue } from "./data/offline";
import {
  deleteTask,
  deleteCompletion,
  insertMaintenanceRequest,
  insertTransactions,
  invokeMaterialsImport,
  invokeQuickBooksConnect,
  invokeQuickBooksSync,
  loadProfile,
  loadRemoteState,
  persistPoints,
  replayCommand,
  respondMaintenanceRequest,
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
  applyCostChangeFlag,
  batteryState,
  canResolveMaintenanceRequests,
  combineDateWithNow,
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
  respondToMaintenanceRequest,
  serviceRequired,
  setExactCountDelta,
  stockStatus,
  submitMaintenanceRequest,
  todayKey,
  ALLOWED_MATERIAL_UNITS,
  priceChangeMaterials,
  stepForMaterialUnit,
} from "./domain/business";
import { isSupabaseConfigured, supabase } from "./integrations/supabase";
import type { AppState, Category, MaintenanceRequest, MaintenanceTargetType, Material, MaterialUnit, Role, ServiceId, Site, TaskFrequency, ToolCondition, ToolItem, Transaction, TruckLog, TruckTask, TxType, User } from "./types";

const STORAGE_KEY = "warehouse-wizard-state-v4";
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true" || !isSupabaseConfigured();
const LazyOperationsTabs = React.lazy(() => import("./tabs/OperationsTabBoundary"));
const LazyPeopleTab = React.lazy(() => import("./tabs/PeopleTabBoundary"));
const LazyAdminTab = React.lazy(() => import("./tabs/AdminTabBoundary"));

const tabTitles = {
  home: ["Today", "Trucks, tools and stock at a glance"],
  inventory: ["Warehouse inventory", "Live counts, locked units and reorder thresholds"],
  log: ["Log materials", "Fast crew flow with offline sync"],
  tools: ["Tools & equipment", "Check in/out, damage and battery charge"],
  trucks: ["Trucks & daily tasks", "Daily, weekly and monthly work by service"],
  crew: ["Crew & points", "100% daily tasks earns points"],
  admin: ["Admin", "Imports, integrations, exports and role management"],
} as const;

export type Tab = keyof typeof tabTitles;

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
      return { ...material, unit, step: stepForMaterialUnit(unit), strictTracking: material.strictTracking ?? true };
    }),
  };
}

function persistDemo(state: AppState) {
  if (DEMO_MODE) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function canManage(role: Role | string) {
  return role === "admin" || role === "manager";
}

export function canAdmin(role: Role | string) {
  return role === "admin";
}

export function App() {
  const queryClient = useQueryClient();
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [state, setStateInner] = useState(loadDemoState);
  const [tab, setTab] = useState<Tab>("home");
  const [focusTarget, setFocusTarget] = useState<string | null>(null);
  const goToFocus = (nextTab: Tab, focus: string) => { setTab(nextTab); setFocusTarget(focus); };
  const { showToast } = useToast();
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
  const applyPreferredTheme = React.useCallback((mode: "light" | "dark") => {
    const next = mode === "dark" ? themes.midnight : themes.waterproofing;
    setCurrentTheme(next);
    applyTheme(next);
  }, []);
  const [themePreference, setThemePreference] = useThemePreference(applyPreferredTheme);

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

  const notify = (message: string) => showToast(message, /failed|could not|delete failed|sync failed/i.test(message) ? "bad" : /offline|queued|pending/i.test(message) ? "warn" : "good");

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

  const submitTransactions = (txs: Omit<Transaction, "id" | "ts">[], chosenDate?: string) => {
    patchState((current) => {
      const dated = txs.map((tx) => ({ ...tx, id: id("tx"), ts: combineDateWithNow(chosenDate) }));
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
    const materialToSave = applyCostChangeFlag(state.materials.find((item) => item.id === material.id), material);
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

  const saveTruck = (log: Omit<TruckLog, "id" | "ts">, chosenDate?: string) => {
    patchState((current) => {
      const fullLog = { ...log, id: id("tl"), ts: combineDateWithNow(chosenDate) };
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

  const submitMaintenance = (targetType: MaintenanceTargetType, targetId: string, targetLabel: string, description: string, deadlineAt?: string, chosenDate?: string) => {
    let created: MaintenanceRequest | undefined;
    patchState((current) => {
      const applied = submitMaintenanceRequest(current, current.currentUserId, targetType, targetId, targetLabel, description, deadlineAt, combineDateWithNow(chosenDate));
      created = applied.maintenanceRequests[0];
      return applied;
    }, "Maintenance request submitted");
    if (remoteMode && created) insertMaintenanceRequest(created).then(invalidateRemote).catch((err) => notify(`Maintenance request sync failed: ${err.message}`));
    setSheet(null);
  };

  const respondMaintenance = (requestId: string, note: string) => {
    let updated: MaintenanceRequest | undefined;
    patchState((current) => {
      const applied = respondToMaintenanceRequest(current, current.currentUserId, requestId, note);
      updated = applied.maintenanceRequests.find((item) => item.id === requestId);
      return applied;
    }, "Maintenance request resolved");
    if (remoteMode && updated) respondMaintenanceRequest(updated).then(invalidateRemote).catch((err) => notify(`Maintenance response sync failed: ${err.message}`));
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
      <IntroVideo />
      <header className="top">
        <div className="brandrow">
          <div className="brand">
            <span className="logo" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><defs><linearGradient id="dl" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#00d4ff"/><stop offset="100%" stopColor="#0099cc"/></linearGradient></defs><path d="M12 2.5c3.5 4.2 6 7.4 6 10.6a6 6 0 1 1-12 0c0-3.2 2.5-6.4 6-10.6Z" fill="url(#dl)" /><path d="M9.5 13.5a2.5 2.5 0 0 0 2.5 2.5" stroke="#060d1a" strokeWidth="1.8" strokeLinecap="round" /></svg></span>
            <div>Van Isle Water Proofing+<small>Warehouse & Crew Ops</small></div>
          </div>
          <div className="brandrow-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <ThemeControl value={themePreference} onChange={setThemePreference} />
            <button className="theme-quick-btn" onClick={openThemeSheet} title="Appearance settings">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v6m0 6v6M1 12h6m6 0h6M3.93 3.93l4.24 4.24m5.66 5.66l4.24 4.24M3.93 20.07l4.24-4.24m5.66-5.66l4.24-4.24"/></svg>
            </button>
            <button className="whoami" onClick={() => DEMO_MODE ? setSheet({ title: "Choose demo user", content: <UserSheet state={state} switchUser={switchDemoUser} /> }) : supabase?.auth.signOut()}>
              <span className="av" style={{ background: currentUser.color }}>{initials(currentUser.name)}</span>
              <span>{currentUser.name} · {currentUser.role}</span>
            </button>
          </div>
        </div>
        <SuiteSwitcher current="warehouse" />
        <div className="htitle">{title}</div>
        <div className="hsub">{pendingCount ? `${pendingCount} pending sync · ${sub}` : sub}</div>
      </header>

      <main>
        {tab === "home" && <Home state={state} userId={currentUser.id} setTab={setTab} goToFocus={goToFocus} openGraph={setGraphModal} />}
        <React.Suspense fallback={<TabSkeleton />}>
          {(["inventory", "log", "tools", "trucks"] as Tab[]).includes(tab) && <LazyOperationsTabs activeTab={tab as "inventory" | "log" | "tools" | "trucks"} state={state} role={currentUser.role} currentUser={currentUser} userId={currentUser.id} toggleTask={toggleTask} openSheet={setSheet} saveMaterial={saveMaterial} setExactCount={setExactCount} setTab={setTab} submitTransactions={submitTransactions} saveSite={saveSite} saveTool={saveTool} saveTruck={saveTruck} saveTask={saveTask} removeTask={removeTask} submitMaintenance={submitMaintenance} respondMaintenance={respondMaintenance} focusTarget={focusTarget} onFocusHandled={() => setFocusTarget(null)} />}
          {tab === "crew" && <LazyPeopleTab state={state} role={currentUser.role} setState={setState} openSheet={setSheet} />}
          {tab === "admin" && <LazyAdminTab state={state} role={currentUser.role} notify={notify} remoteMode={remoteMode} saveMaterial={saveMaterial} currentTheme={currentTheme} onThemeChange={(theme) => { setCurrentTheme(theme); applyTheme(theme); saveTheme(theme); }} openThemeEditor={() => setShowAppearance(true)} />}
        </React.Suspense>
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
      <ToastHost />
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

function TabSkeleton() { return <section className="card tab-skeleton" aria-label="Loading section"><i /><i /><i /></section>; }

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
  const loading = title.startsWith("Loading");
  return <div className="app auth loading-screen"><section className="card"><div className="brand loading-brand"><span className={`logo ${loading ? "loading-mark" : ""}`} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M12 2.5c3.5 4.2 6 7.4 6 10.6a6 6 0 1 1-12 0c0-3.2 2.5-6.4 6-10.6Z" fill="currentColor" /></svg></span><div><h1>{title}</h1><p>{detail}</p></div></div>{loading && <div className="loading-line" aria-hidden="true"><i /></div>}</section></div>;
}

function Home({ state, userId, setTab, goToFocus, openGraph }: { state: AppState; userId: string; setTab: (tab: Tab) => void; goToFocus: (tab: Tab, focus: string) => void; openGraph: (t: GraphType) => void }) {
  const trackedMaterials = state.materials.filter((material) => material.strictTracking !== false);
  const lows = trackedMaterials.filter((material) => stockStatus(material).key !== "good");
  const today = todayKey();
  const usedToday = state.transactions.filter((tx) => tx.ts.slice(0, 10) === today && ["use", "deliver"].includes(tx.type)).reduce((sum, tx) => sum + tx.qty, 0);
  const losses = state.transactions.filter((tx) => tx.type === "loss" && Date.now() - new Date(tx.ts).getTime() < 30 * 86400000).reduce((sum, tx) => sum + tx.qty * (state.materials.find((material) => material.id === tx.materialId)?.cost ?? 0), 0);
  const progress = dailyProgress(state.truckTasks, state.taskCompletions, userId);
  const toolsOut = state.tools.filter((tool) => tool.status === "out").length;
  const chargeDue = state.tools.filter((tool) => tool.battery && batteryState(tool.lastCharged).key === "bad").length;
  const priceChanges = priceChangeMaterials(state.materials);
  const maintenance = state.maintenanceRequests.filter((request) => request.status === "open").length;
  const incompleteTasks = Math.max(0, progress.total - progress.done);
  const attention = [{ count: maintenance, label: "Open maintenance requests", tab: "trucks" as Tab, focus: "maintenance" }, { count: incompleteTasks, label: "Truck tasks remaining today", tab: "trucks" as Tab, focus: "tasks" }, { count: lows.length, label: "Items below reorder threshold", tab: "inventory" as Tab, focus: "low-stock" }].filter((item) => item.count > 0);
  return <>
    {attention.length > 0 && <section className="attention-strip" aria-label="Needs attention"><div className="attention-title"><span aria-hidden="true">!</span><b>Needs attention</b></div><div className="attention-rows">{attention.map((item) => <button key={item.label} onClick={() => goToFocus(item.tab, item.focus)}><span>{item.label}</span><b>{item.count}</b><span aria-hidden="true">→</span></button>)}</div></section>}
    <div className="banner"><b>{progress.pct === 100 ? "Daily tasks complete" : "Crew-first workflow"}</b><span>{progress.done}/{progress.total} daily tasks complete today.</span></div>
    <div className="kpis">
      <Kpi label="SKUs tracked"  value={trackedMaterials.length}  sub={`${state.materials.length - trackedMaterials.length} reference only`} onClick={() => openGraph("inventory_stock")} />
      <Kpi label="Need reorder"  value={lows.length}             sub={lows.length ? "below threshold" : "all stocked"} alert={lows.length > 0} onClick={() => openGraph("reorder_alert")} />
      <Kpi label="Units out today" value={usedToday}             sub="used + delivered" onClick={() => openGraph("activity_trend")} />
      <Kpi label="Losses (30d)"  value={money(losses)}           sub="damaged / spilled" alert={losses > 0} onClick={() => openGraph("losses_30d")} />
    </div>
    <section className="card card-interactive"><div className="sec-h"><h2>Reorder now</h2><button className="link" onClick={() => setTab("inventory")}>Open</button></div>{lows.slice(0, 5).map((material) => <MaterialMini key={material.id} material={material} />)}{lows.length === 0 && <div className="empty-state"><span className="empty-icon">✓</span><div className="empty-msg">All materials above reorder threshold</div></div>}</section>
    <section className="card card-interactive" onClick={() => openGraph("tools_status")}><div className="sec-h"><h2>Tools & equipment</h2><button className="link" onClick={(e) => { e.stopPropagation(); setTab("tools"); }}>Manage</button></div><div className="kpis compact"><Kpi label="Checked out" value={toolsOut} sub={`of ${state.tools.length}`} /><Kpi label="Charge due" value={chargeDue} sub="cordless batteries" alert={chargeDue > 0} /></div></section>
    <section className="card"><div className="sec-h"><h2>Price changes</h2><button className="link" onClick={() => setTab("admin")}>Report</button></div>{priceChanges.slice(0, 4).map((material) => <div className="line-item" key={material.id}><b>{material.name}</b><span className={`pill ${material.cost > (material.previousCost ?? material.cost) ? "warn" : "good"}`}>{money(material.previousCost ?? 0)} to {money(material.cost)}</span></div>)}{priceChanges.length === 0 && <div className="empty-state"><span className="empty-icon">OK</span><div className="empty-msg">No material price changes flagged</div></div>}</section>
    <section className="card card-interactive"><div className="sec-h"><h2>Today's truck tasks</h2><button className="link" onClick={() => setTab("trucks")}>Open</button></div><ProgressRing pct={progress.pct} /></section>
    <section className="card card-interactive" onClick={() => openGraph("activity_trend")}><div className="sec-h"><h2>Recent activity</h2><button className="link" onClick={(e) => { e.stopPropagation(); setTab("admin"); }}>Exports</button></div>{state.transactions.slice(0, 6).map((tx) => <Activity key={tx.id} state={state} tx={tx} />)}{state.transactions.length === 0 && <div className="empty-state"><span className="empty-icon">📋</span><div className="empty-msg">No activity logged yet</div></div>}</section>
  </>;
}

export function BulkToolSheet({ state, userId, saveTool }: { state: AppState; userId: string; saveTool: (tool: ToolItem, message?: string) => void }) {
  const [siteId, setSiteId] = useState(state.sites[0]?.id ?? "");
  const [serviceId, setServiceId] = useState<ServiceId>("wp");
  const tools = state.tools.filter((tool) => tool.serviceId === serviceId || tool.serviceId === "veh");
  const checkout = (tool: ToolItem) => saveTool({ ...tool, status: "out", outBy: userId, outJob: siteId, outService: serviceId, outTs: new Date().toISOString() }, "Checked out");
  const checkin = (tool: ToolItem) => saveTool({ ...tool, status: "in", outBy: undefined, outJob: undefined, outService: undefined, outTs: undefined }, "Checked in");
  return <div><label className="fld">Job</label><select className="in" value={siteId} onChange={(event) => setSiteId(event.target.value)}>{state.sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select><label className="fld">Service</label><select className="in" value={serviceId} onChange={(event) => setServiceId(event.target.value as ServiceId)}>{state.services.filter((service) => service.id !== "veh").map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select><section className="card compact-card">{tools.map((tool) => <div className="tool-row" key={tool.id}><div><b>{tool.name}</b><div className="tiny muted">{tool.status === "out" ? `${userName(state, tool.outBy)} - ${siteName(state, tool.outJob)}` : "Available in warehouse"}</div></div><button className={`btn sm ${tool.status === "out" ? "line" : "primary"}`} disabled={!siteId && tool.status === "in"} onClick={() => tool.status === "out" ? checkin(tool) : checkout(tool)}>{tool.status === "out" ? "Check in" : "Check out"}</button></div>)}</section></div>;
}

export function Kpi({ label, value, sub, alert, onClick }: { label: string; value: string | number; sub: string; alert?: boolean; onClick?: () => void }) {
  return <div className={`kpi ${alert ? "alert" : ""} ${onClick ? "kpi-clickable" : ""}`} onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined} onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}><div className="k-lab"><span className="dot" />{label}</div><div className="k-val">{value}</div><div className="k-sub">{sub}{onClick && <span className="kpi-hint">View chart →</span>}</div></div>;
}

function MaterialMini({ material }: { material: Material }) {
  const need = Math.max(0, material.reorderPoint - material.qty + material.reorderPoint * 0.2);
  return <div className="line-item"><b>{material.name}</b><span className="tiny muted">need {formatQty(need, material.step)} {material.unit}</span></div>;
}

function formatQty(value: number, step: Material["step"]) {
  return value.toFixed(step === 0.25 ? 2 : step === 0.5 ? 1 : 0).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

export function ProgressRing({ pct }: { pct: number }) {
  return <div className="ring-wrap"><div className="ring" style={{ "--p": pct } as React.CSSProperties}><b>{pct}%</b></div><div><b>{pct === 100 ? "Points secured" : "Keep moving"}</b><div className="tiny muted">100% daily completion awards +25 points.</div></div></div>;
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

export function Pill({ tone, children }: { tone: "good" | "warn" | "bad" | "neu"; children: React.ReactNode }) {
  return <span className={`pill ${tone}`}>{children}</span>;
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

export function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export function userName(state: AppState, idValue?: string) {
  return state.users.find((user) => user.id === idValue)?.name ?? "Unassigned";
}

export function siteName(state: AppState, idValue?: string) {
  return state.sites.find((site) => site.id === idValue)?.name ?? "No site";
}

export function serviceName(state: AppState, idValue?: ServiceId) {
  return state.services.find((service) => service.id === idValue)?.name ?? "Service";
}

function upsertStreak(streaks: AppState["streaks"], streak: AppState["streaks"][number]) {
  return streaks.some((row) => row.userId === streak.userId) ? streaks.map((row) => row.userId === streak.userId ? streak : row) : [...streaks, streak];
}

