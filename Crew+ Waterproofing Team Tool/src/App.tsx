import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createSeedState } from "./data/seed";
import { getCurrentSession, loadRemoteState, signInWithPassword, signOut, syncCrewState } from "./data/repo";
import { bonusTrajectory, canApproveRedemptions, canRunReviews, certAlertLevelFromType, employeeReviewSubmission, isNewHireRestricted, leaderboard, newHireReviewsDue, walletBalance } from "./domain/crew";
import type { CrewState, Profile, ReviewRating } from "./types";
import { isSupabaseConfigured } from "./integrations/supabase";
import { SuiteSwitcher } from "./components/SuiteSwitcher";
import { ThemeControl, useThemePreference } from "./components/ThemeControl";
import { ToastHost, useToast } from "./components/Toast";
import { GraphModal } from "./components/GraphModal";
import type { GraphType } from "./components/GraphModal";

const STORAGE_KEY = "crew-plus-state-v1";
export const REMOTE_MODE = isSupabaseConfigured();
const DEMO_PICKER = !REMOTE_MODE || import.meta.env.VITE_DEMO_MODE === "true";
const LazyWorkTabs = lazy(() => import("./tabs/WorkTabBoundary"));
const LazyPerformanceTabs = lazy(() => import("./tabs/PerformanceTabBoundary"));
const LazyAdminTabs = lazy(() => import("./tabs/AdminTabBoundary"));
type Tab = "home" | "profile" | "onboarding" | "wallet" | "rituals" | "reviews" | "forms" | "timeoff" | "incidents" | "bonus" | "certs" | "rewards" | "feedback" | "admin";
const NEW_HIRE_TABS: Tab[] = ["home", "profile", "onboarding", "timeoff", "incidents", "certs"];
const WORK_TABS = ["profile", "onboarding", "timeoff", "incidents", "certs"] as const;
const PERFORMANCE_TABS = ["wallet", "rituals", "reviews", "forms", "bonus", "feedback"] as const;
const ADMIN_TABS = ["rewards", "admin"] as const;

export function App() {
  const [demoState, setDemoState] = useStoredState();
  const remote = useRemoteState(demoState);
  const state = withIntakeDefaults(REMOTE_MODE ? remote.state : demoState);
  const setState = REMOTE_MODE ? remote.setState : setDemoState;
  const [tab, setTab] = useState<Tab>("home");
  const [theme, setTheme] = useThemePreference();
  const [graphModal, setGraphModal] = useState<GraphType | null>(null);
  const { showToast } = useToast();
  useRipple();

  useEffect(() => {
    if (remote.error) showToast(remote.error, "bad");
  }, [remote.error, showToast]);

  if (REMOTE_MODE && remote.loading) return <Splash text="Loading Crew+ from Supabase..." />;
  if (REMOTE_MODE && !remote.sessionUserId) return <LoginScreen error={remote.error} onLogin={remote.login} />;

  const currentUser = state.users.find((user) => user.id === state.currentUserId) ?? state.users[0];
  const today = new Date().toISOString().slice(0, 10);
  const newHireRestricted = isNewHireRestricted(currentUser, today);
  const visibleTabs = (["home", "profile", "onboarding", "wallet", "rituals", "reviews", "forms", "timeoff", "incidents", "bonus", "certs", "rewards", "feedback", "admin"] as const).filter((item) => !newHireRestricted || NEW_HIRE_TABS.includes(item));
  const activeTab = visibleTabs.includes(tab) ? tab : "home";
  const balance = walletBalance(state.pointsEvents, currentUser.id);
  const certsVisibleToUser = currentUser.role === "admin" || currentUser.role === "manager" ? state.certifications : state.certifications.filter((cert) => cert.userId === currentUser.id);
  const certAlerts = certsVisibleToUser.filter((cert) => certAlertLevelFromType(cert, state.certificationTypes?.find((type) => type.id === cert.certTypeId), new Date().toISOString().slice(0, 10)) !== "green");
  const pendingRedemptions = state.redemptions.filter((item) => item.status === "requested").length;
  const newHireReviewCount = currentUser.role === "admin" ? newHireReviewsDue(state, today).length : 0;

  return (
    <div className="shell app">
      <aside className="rail">
        <div className="brand">
          <div className="drop logo crew-mark">+</div>
          <div><h1>Crew+</h1><p>People & Performance</p></div>
        </div>
        <SuiteSwitcher current="crew" />
        {newHireRestricted && <p className="chip warn nav-note">New hire access - full access unlocks {currentUser.newHireUntil}</p>}
        <nav>
          {visibleTabs.map((item) => (
            <button key={item} className={activeTab === item ? "on" : ""} onClick={() => setTab(item)}><span className="nav-label">{titleFor(item)}</span>{item === "rewards" && pendingRedemptions ? <span className="nav-count">{pendingRedemptions}</span> : null}{item === "admin" && newHireReviewCount ? <span className="nav-count">{newHireReviewCount}</span> : null}</button>
          ))}
        </nav>
        <div className="rail-foot">
          <ThemeControl value={theme} onChange={setTheme} />
          {DEMO_PICKER && <><label>View as</label><select value={state.currentUserId} onChange={(event) => setState({ ...state, currentUserId: event.target.value })}>{state.users.map((user) => <option key={user.id} value={user.id}>{user.name} - {user.orgRole}</option>)}</select></>}
          {!DEMO_PICKER && <div className="signed-in"><b>{currentUser.name}</b><small>{currentUser.orgRole}</small></div>}
          {REMOTE_MODE ? <button onClick={remote.logout}>Sign out</button> : <small>Demo mode - localStorage fallback</small>}
        </div>
      </aside>

      <main>
        <header className="topbar top">
          <div><h2>{titleFor(activeTab)}</h2><p>One wallet, one leaderboard, values, reviews, bonus trajectory, and compliance.</p></div>
          <div className="top-actions">
            {remote.error && <span className="chip warn">{remote.error}</span>}
            {(!currentUser.address?.trim() || !currentUser.emergencyContactName?.trim() || !currentUser.emergencyContactPhone?.trim()) && <button onClick={() => setTab("profile")}>Complete profile</button>}
            <span className="chip good">{balance} pts</span>
            <span className="chip warn">{certAlerts.length} compliance flags</span>
          </div>
        </header>

        <TabView tab={activeTab}>
          {activeTab === "home" && <Home state={state} user={currentUser} setTab={setTab} openGraph={setGraphModal} />}
          <Suspense fallback={<TabSkeleton />}>
            {(WORK_TABS as readonly string[]).includes(activeTab) && <LazyWorkTabs activeTab={activeTab as typeof WORK_TABS[number]} state={state} user={currentUser} setState={setState} />}
            {(PERFORMANCE_TABS as readonly string[]).includes(activeTab) && <LazyPerformanceTabs activeTab={activeTab as typeof PERFORMANCE_TABS[number]} state={state} user={currentUser} setState={setState} />}
            {(ADMIN_TABS as readonly string[]).includes(activeTab) && <LazyAdminTabs activeTab={activeTab as typeof ADMIN_TABS[number]} state={state} user={currentUser} setState={setState} />}
          </Suspense>
        </TabView>
      </main>

      <footer className="mobile-nav">
        {(["home", "profile", "timeoff", "incidents", "certs"] as const).map((item) => <button key={item} className={activeTab === item ? "on" : ""} onClick={() => setTab(item)}>{titleFor(item)}</button>)}
      </footer>
      <ToastHost />
      {graphModal && <GraphModal type={graphModal} state={state} onClose={() => setGraphModal(null)} />}
    </div>
  );
}

function TabSkeleton() {
  return (
    <section className="panel card tab-skeleton" aria-label="Loading section">
      <i /><i /><i />
    </section>
  );
}

/** Wraps tab content in an animated container that re-triggers on tab change */
function TabView({ tab, children }: { tab: string; children: React.ReactNode }) {
  return (
    <div key={tab} className="tab-view">
      {children}
    </div>
  );
}

/** Injects a ripple animation at the click location inside a button */
function useRipple() {
  const attached = useRef(false);
  useEffect(() => {
    if (attached.current) return;
    attached.current = true;

    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      const btn = target.closest("button, .button-link") as HTMLButtonElement | null;
      if (!btn || (btn as HTMLButtonElement).disabled) return;
      const rect = btn.getBoundingClientRect();
      const ripple = document.createElement("span");
      ripple.className = "ripple";
      ripple.style.left = `${e.clientX - rect.left}px`;
      ripple.style.top = `${e.clientY - rect.top}px`;
      btn.appendChild(ripple);
      ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
    }

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);
}

function useRemoteState(fallback: CrewState) {
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["crew-plus-state", sessionUserId],
    queryFn: () => loadRemoteState(sessionUserId!),
    enabled: REMOTE_MODE && Boolean(sessionUserId),
    staleTime: 20_000,
  });
  const state = useMemo(() => ({ ...fallback, ...(query.data ?? {}) }), [fallback, query.data]);

  useEffect(() => {
    if (!REMOTE_MODE) return;
    getCurrentSession().then((session) => setSessionUserId(session?.user.id ?? null)).catch((err) => setError(err instanceof Error ? err.message : "Could not read session."));
  }, []);

  async function login(email: string, password: string) {
    try {
      const user = await signInWithPassword(email, password);
      setSessionUserId(user.id);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
    }
  }

  async function logout() {
    await signOut();
    setSessionUserId(null);
    queryClient.removeQueries({ queryKey: ["crew-plus-state"] });
  }

  const setState: React.Dispatch<React.SetStateAction<CrewState>> = (update) => {
    const prev = state;
    const next = typeof update === "function" ? (update as (current: CrewState) => CrewState)(prev) : update;
    if (next === prev) return;
    queryClient.setQueryData(["crew-plus-state", sessionUserId], { ...query.data, ...next });
    syncCrewState(prev, next)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not save changes."))
      .finally(() => queryClient.invalidateQueries({ queryKey: ["crew-plus-state", sessionUserId] }));
  };

  return { state, setState, sessionUserId, loading: query.isFetching && !query.data && Boolean(sessionUserId), error, login, logout };
}

function Home({ state, user, setTab, openGraph }: { state: CrewState; user: Profile; setTab: (tab: Tab) => void; openGraph: (type: GraphType) => void }) {
  const board = leaderboard(state).slice(0, 5);
  const trajectory = bonusTrajectory(state.reviews.filter((review) => review.userId === user.id && review.status === "completed").flatMap((review) => Object.values(review.ratings).filter(Boolean) as ReviewRating[]));
  const today = new Date().toISOString().slice(0, 10);
  const selfAssessments = state.reviews.filter((review) => review.type === "quarterly" && review.userId === user.id && review.status !== "completed" && !employeeReviewSubmission(state, review)).length;
  const managerReviews = canRunReviews(state, user) ? state.reviews.filter((review) => review.type === "quarterly" && review.userId !== user.id && review.status !== "completed" && employeeReviewSubmission(state, review)).length : 0;
  const hireReviews = user.role === "admin" ? newHireReviewsDue(state, today).length : 0;
  const compliance = state.certifications.filter((cert) => (user.role === "admin" || user.role === "manager" || cert.userId === user.id) && certAlertLevelFromType(cert, state.certificationTypes.find((type) => type.id === cert.certTypeId), today) !== "green").length;
  const redemptions = canApproveRedemptions(state, user) ? state.redemptions.filter((item) => item.status === "requested").length : 0;
  const attention = [
    { count: selfAssessments, label: "Self-assessment due", tab: "reviews" as Tab },
    { count: managerReviews, label: "Quarterly reviews ready", tab: "reviews" as Tab },
    { count: hireReviews, label: "New-hire access reviews", tab: "admin" as Tab },
    { count: compliance, label: "Compliance flags", tab: "certs" as Tab },
    { count: redemptions, label: "Reward approvals", tab: "rewards" as Tab },
  ].filter((item) => item.count > 0);
  return <>{attention.length > 0 && <section className="attention-strip" aria-label="Needs attention"><div className="attention-title"><span aria-hidden="true">!</span><b>Needs attention</b></div><div className="attention-rows">{attention.map((item) => <button key={item.label} onClick={() => setTab(item.tab)}><span>{item.label}</span><b>{item.count}</b><span aria-hidden="true">→</span></button>)}</div></section>}<div className="grid two"><section className="panel card hero-panel card-interactive" onClick={() => openGraph("points_trend")}><h3>{walletBalance(state.pointsEvents, user.id)} points</h3><p>Shared wallet from Warehouse Wizard, SOP+, and Crew+. Tap for the 30-day trend.</p><div className="hero-actions"><button className="primary" onClick={(event) => { event.stopPropagation(); setTab("wallet"); }}>Open wallet</button><button className="primary" onClick={(event) => { event.stopPropagation(); setTab("certs"); }}>Compliance</button></div></section><section className="panel card"><div className="section-head"><h3>Bonus trajectory</h3><span className={`status ${trajectory}`}>{trajectory.toUpperCase()}</span></div><p className="muted">Trajectory is visible to everyone. Dollars stay admin/CFO-only.</p><div className="score-grid"><div className="score-tile"><strong>{state.reviews.filter((review) => review.userId === user.id && review.status === "completed").length}</strong><span>completed reviews</span></div><div className="score-tile"><strong>{state.certifications.filter((cert) => cert.userId === user.id).length}</strong><span>cert records</span></div></div><button onClick={() => setTab("bonus")}>Open scorecard</button></section><section className="panel card card-interactive" onClick={() => openGraph("leaderboard")}><div className="section-head"><h3>Leaderboard</h3><span className="pill">Chart</span></div>{board.map((row, index) => <div className="lb" key={row.user.id}><b>{index + 1}. {row.user.name}</b><span className="pill">{row.balance} pts</span></div>)}</section><section className="panel card"><h3>Weekly value-share</h3><p>{state.values[0].weeklyRitual}</p><div className="facts"><span>Monday 6:30am</span><span>+5 points</span></div><button onClick={() => setTab("reviews")}>Review cadence</button></section></div></>;
}

function LoginScreen({ error, onLogin }: { error: string; onLogin: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  return <div className="login"><section className="panel card"><div className="brand login-brand"><div className="drop logo crew-mark">+</div><div><h1>Crew+</h1><p>Van Isle Water Proofing+</p></div></div><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error && <p className="error">{error}</p>}<button className="primary block" disabled={!email || !password || busy} onClick={() => { setBusy(true); onLogin(email, password).finally(() => setBusy(false)); }}>{busy ? "Signing in..." : "Sign in"}</button></section></div>;
}

function Splash({ text }: { text: string }) {
  return <div className="login loading-screen"><section className="panel card"><div className="brand login-brand"><div className="drop logo crew-mark loading-mark">+</div><div><h1>Crew+</h1><p>{text}</p></div></div><div className="loading-line" aria-hidden="true"><i /></div></section></div>;
}

export function Metric({ label, value }: { label: string; value: number | string }) {
  return <div className="metric"><strong>{value}</strong><span>{label}</span></div>;
}

function useStoredState(): [CrewState, React.Dispatch<React.SetStateAction<CrewState>>] {
  const [state, setState] = useState<CrewState>(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as CrewState : createSeedState();
  });
  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(state)), [state]);
  return [state, setState];
}

function withIntakeDefaults(state: CrewState): CrewState {
  const defaults = createSeedState();
  return {
    ...defaults,
    ...state,
    config: { ...defaults.config, ...(state.config ?? {}) },
    rolePermissions: state.rolePermissions ?? defaults.rolePermissions,
    jobDescriptions: state.jobDescriptions ?? defaults.jobDescriptions,
    valueRituals: state.valueRituals ?? defaults.valueRituals,
    reviewTypes: state.reviewTypes ?? defaults.reviewTypes,
    ratingScale: state.ratingScale ?? defaults.ratingScale,
    reviewCompetencies: state.reviewCompetencies ?? defaults.reviewCompetencies,
    bonusRoleWeights: state.bonusRoleWeights ?? defaults.bonusRoleWeights,
    certificationTypes: state.certificationTypes ?? defaults.certificationTypes,
    nudges: state.nudges ?? defaults.nudges,
    forms: [...defaults.forms.map((form) => ({ ...(state.forms ?? []).find((item) => item.id === form.id), ...form })), ...(state.forms ?? []).filter((form) => !defaults.forms.some((item) => item.id === form.id))],
    formQuestions: [...defaults.formQuestions.map((question) => ({ ...(state.formQuestions ?? []).find((item) => item.id === question.id), ...question })), ...(state.formQuestions ?? []).filter((question) => !defaults.formQuestions.some((item) => item.id === question.id))],
    formSubmissions: state.formSubmissions ?? defaults.formSubmissions,
    policyDocuments: state.policyDocuments ?? defaults.policyDocuments,
    policyAcknowledgments: state.policyAcknowledgments ?? defaults.policyAcknowledgments,
    timeOffPolicies: state.timeOffPolicies ?? defaults.timeOffPolicies,
    timeOffEntries: state.timeOffEntries ?? defaults.timeOffEntries,
    incidentReports: state.incidentReports ?? defaults.incidentReports,
    integrations: state.integrations ?? defaults.integrations,
    permissions: { ...defaults.permissions, ...(state.permissions ?? {}) },
    walletConfig: { ...defaults.walletConfig, ...(state.walletConfig ?? {}) },
  };
}

function titleFor(tab: string) {
  if (tab === "home") return "Home";
  if (tab === "timeoff") return "Time Off";
  if (tab === "incidents") return "Incidents";
  return tab[0].toUpperCase() + tab.slice(1);
}

export function nameOf(state: CrewState, userId: string) {
  return state.users.find((user) => user.id === userId)?.name ?? "Team member";
}
