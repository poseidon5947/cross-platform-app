import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createSeedState } from "./data/seed";
import { applyIntakeCsvTabs } from "./data/intakeImport";
import { getCurrentSession, loadRemoteState, removePushSubscription, savePushSubscription, sendTestPush, signInWithPassword, signOut, syncCrewState } from "./data/repo";
import { acknowledgePolicy, approveRedemption, awardCertDetail, awardCertsCurrent, awardKpiHit, bonusPercentForAverage, bonusTrajectory, canApproveRedemptions, canRunReviews, canSeeBonusDollars, certAlertLevelFromType, completeQuarterlyReview, completeReview, completeRitual, confirmCustomerReview, confirmIncidentReceipt, employeeReviewSubmission, estimatedBonusDollars, giveRecognition, hasRolePermission, impliedRewardValue, isNewHireRestricted, isRedemptionWindowOpen, averageQuarterlyRating, JOB_RESPONSIBILITY_ITEMS, KPI_REVIEW_ITEMS, leaderboard, newHireReviewsDue, nextQuarterDeadline, nextRedemptionWindow, OVERALL_RATING_LABELS, policyDueDate, promoteToFullAccess, quarterlyLeaderboard, bonusAdminReviewNoticeActive, bonusEmployeeNoticeActive, setEmploymentStatus, recordTimeOff, requestRedemption, rulePoints, submitFeedback, submitIncidentReport, setCompensation, submitOnboarding, submitQuarterlyReviewAnswers, submitQuarterlySwot, timeOffSummary, vacationReminderText, walletBalance, wordCount } from "./domain/crew";
import type { Certification, CrewState, IncidentReport, IncidentReportInput, OnboardingInput, Profile, QuarterlyReviewDetail, Review, ReviewRating, TimeOffKind } from "./types";
import { isSupabaseConfigured } from "./integrations/supabase";

const STORAGE_KEY = "crew-plus-state-v1";
const REMOTE_MODE = isSupabaseConfigured();
const DEMO_PICKER = !REMOTE_MODE || import.meta.env.VITE_DEMO_MODE === "true";
type Tab = "home" | "profile" | "onboarding" | "wallet" | "rituals" | "reviews" | "forms" | "timeoff" | "incidents" | "bonus" | "certs" | "rewards" | "feedback" | "admin";
const NEW_HIRE_TABS: Tab[] = ["home", "profile", "onboarding", "timeoff", "incidents", "certs"];
const INTAKE_TAB_NAMES = [
  "1. Company & App Config",
  "2. Roles & Access",
  "3. Team Members",
  "4. Job Descriptions",
  "5. Certification Types",
  "6. Certifications",
  "7. Values & Rituals",
  "8. Review Structure",
  "9. Review Competencies",
  "10. KPIs by Role",
  "11. Bonus Program",
  "12. Rewards - Earning",
  "13. Rewards - Catalog",
  "14. Nudges & Cadence",
  "15. Forms & SWOT",
  "16. Integrations & Tech",
];

export function App() {
  const [demoState, setDemoState] = useStoredState();
  const remote = useRemoteState(demoState);
  const state = withIntakeDefaults(REMOTE_MODE ? remote.state : demoState);
  const setState = REMOTE_MODE ? remote.setState : setDemoState;
  const [tab, setTab] = useState<Tab>("home");

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
        {newHireRestricted && <p className="chip warn nav-note">New hire access - full access unlocks {currentUser.newHireUntil}</p>}
        <nav>
          {visibleTabs.map((item) => (
            <button key={item} className={activeTab === item ? "on" : ""} onClick={() => setTab(item)}><span className="nav-label">{titleFor(item)}</span>{item === "rewards" && pendingRedemptions ? <span className="nav-count">{pendingRedemptions}</span> : null}{item === "admin" && newHireReviewCount ? <span className="nav-count">{newHireReviewCount}</span> : null}</button>
          ))}
        </nav>
        <div className="rail-foot">
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

        {activeTab === "home" && <Home state={state} user={currentUser} setTab={setTab} />}
        {activeTab === "profile" && <ProfileScreen state={state} user={currentUser} setState={setState} />}
        {activeTab === "onboarding" && <Onboarding state={state} user={currentUser} setState={setState} />}
        {activeTab === "wallet" && <Wallet state={state} user={currentUser} />}
        {activeTab === "rituals" && <Rituals state={state} user={currentUser} setState={setState} />}
        {activeTab === "reviews" && <Reviews state={state} user={currentUser} setState={setState} />}
        {activeTab === "forms" && <Forms state={state} user={currentUser} setState={setState} />}
        {activeTab === "timeoff" && <TimeOff state={state} user={currentUser} setState={setState} />}
        {activeTab === "incidents" && <Incidents state={state} user={currentUser} setState={setState} />}
        {activeTab === "bonus" && <Bonus state={state} user={currentUser} setState={setState} />}
        {activeTab === "certs" && <Compliance state={state} user={currentUser} setState={setState} />}
        {activeTab === "rewards" && <Rewards state={state} user={currentUser} setState={setState} />}
        {activeTab === "feedback" && <Feedback state={state} user={currentUser} setState={setState} />}
        {activeTab === "admin" && <AdminIntake state={state} user={currentUser} setState={setState} />}
      </main>

      <footer className="mobile-nav">
        {(["home", "profile", "timeoff", "incidents", "certs"] as const).map((item) => <button key={item} className={activeTab === item ? "on" : ""} onClick={() => setTab(item)}>{titleFor(item)}</button>)}
      </footer>
    </div>
  );
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

function Home({ state, user, setTab }: { state: CrewState; user: Profile; setTab: (tab: Tab) => void }) {
  const board = leaderboard(state).slice(0, 5);
  const trajectory = bonusTrajectory(state.reviews.filter((review) => review.userId === user.id && review.status === "completed").flatMap((review) => Object.values(review.ratings).filter(Boolean) as ReviewRating[]));
  return <div className="grid two"><section className="panel card hero-panel"><h3>{walletBalance(state.pointsEvents, user.id)} points</h3><p>Shared wallet from Warehouse Wizard, SOP+, and Crew+.</p><div className="hero-actions"><button className="primary" onClick={() => setTab("wallet")}>Open wallet</button><button className="primary" onClick={() => setTab("certs")}>Compliance</button></div></section><section className="panel card"><div className="section-head"><h3>Bonus trajectory</h3><span className={`status ${trajectory}`}>{trajectory.toUpperCase()}</span></div><p className="muted">Trajectory is visible to everyone. Dollars stay admin/CFO-only.</p><div className="score-grid"><div className="score-tile"><strong>{state.reviews.filter((review) => review.userId === user.id && review.status === "completed").length}</strong><span>completed reviews</span></div><div className="score-tile"><strong>{state.certifications.filter((cert) => cert.userId === user.id).length}</strong><span>cert records</span></div></div><button onClick={() => setTab("bonus")}>Open scorecard</button></section><section className="panel card"><h3>Leaderboard</h3>{board.map((row, index) => <div className="lb" key={row.user.id}><b>{index + 1}. {row.user.name}</b><span className="pill">{row.balance} pts</span></div>)}</section><section className="panel card"><h3>Weekly value-share</h3><p>{state.values[0].weeklyRitual}</p><div className="facts"><span>Monday 6:30am</span><span>+5 points</span></div><button onClick={() => setTab("reviews")}>Review cadence</button></section></div>;
}

function ProfileScreen({ state, user, setState }: { state: CrewState; user: Profile; setState: React.Dispatch<React.SetStateAction<CrewState>> }) {
  const update = (patch: Partial<Profile>) => setState((next) => ({ ...next, users: next.users.map((item) => item.id === user.id ? { ...item, ...patch } : item) }));
  const complete = Boolean(user.address?.trim() && user.emergencyContactName?.trim() && user.emergencyContactPhone?.trim());
  return <div className="grid two"><section className="panel card"><div className="section-head"><div><h3>My details</h3><p className="muted">Keep your current address and contact details up to date.</p></div><span className={`pill ${complete ? "good" : "warn"}`}>{complete ? "Complete" : "Action needed"}</span></div><div className="field-stack"><label>Address<textarea value={user.address ?? ""} onChange={(event) => update({ address: event.target.value })} placeholder="Current home address" /></label><label>Phone<input type="tel" value={user.phone ?? ""} onChange={(event) => update({ phone: event.target.value })} /></label><label>Email<input type="email" value={user.email ?? ""} onChange={(event) => update({ email: event.target.value })} /></label></div></section><section className="panel card"><h3>Emergency contact</h3><div className="field-stack"><label>Name<input value={user.emergencyContactName ?? ""} onChange={(event) => update({ emergencyContactName: event.target.value })} /></label><label>Phone<input type="tel" value={user.emergencyContactPhone ?? ""} onChange={(event) => update({ emergencyContactPhone: event.target.value })} /></label><label>Email<input type="email" value={user.emergencyContactEmail ?? ""} onChange={(event) => update({ emergencyContactEmail: event.target.value })} /></label></div></section>{REMOTE_MODE && <NotificationSettings userId={user.id} />}</div>;
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

function NotificationSettings({ userId }: { userId: string }) {
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [status, setStatus] = useState("");
  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((sub) => setSubscribed(Boolean(sub)))
      .catch(() => setSubscribed(false));
  }, []);

  const enable = async () => {
    setStatus("");
    try {
      if (!vapidKey) throw new Error("Push is not configured for this deployment.");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Notification permission was not granted.");
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) });
      await savePushSubscription(userId, subscription);
      setSubscribed(true);
      setStatus("Notifications enabled.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not enable notifications.");
    }
  };

  const disable = async () => {
    setStatus("");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await removePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setSubscribed(false);
      setStatus("Notifications turned off.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not turn off notifications.");
    }
  };

  const sendTest = async () => {
    setStatus("");
    try {
      const result = await sendTestPush("Crew+ test", "Notifications are working.");
      setStatus(`Sent to ${result.delivered} of ${result.of} device(s).`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not send test notification.");
    }
  };

  return <section className="panel card wide"><div className="section-head"><div><h3>Push notifications</h3><p className="muted">Get notified for time-sensitive reminders directly on this device.</p></div><span className={`pill ${subscribed ? "good" : "warn"}`}>{subscribed ? "Enabled" : "Off"}</span></div>{subscribed ? <div className="step-actions"><button onClick={sendTest}>Send test notification</button><button className="line" onClick={disable}>Turn off</button></div> : <button className="primary" onClick={enable}>Enable notifications</button>}{status && <p className="tiny muted">{status}</p>}</section>;
}

type OnboardingDraft = Omit<OnboardingInput, "userId" | "hourlyWage" | "directDepositSignedAt" | "hoursTrackingSignedAt"> & { hourlyWage: string };

function onboardingDraft(): OnboardingDraft {
  return {
    dateOfBirth: "", address: "", city: "", postalCode: "", sin: "", driversLicenseNumber: "",
    allergiesMedical: "", hourlyWage: "", startDate: "", vacationPayAcknowledged: false,
    directDepositSignedName: "", hoursTrackingSignedName: "",
    directDepositFileName: "", driversLicenseFrontFileName: "", driversLicenseBackFileName: "",
    emergencyContactName: "", emergencyContactRelationship: "", emergencyContactPhone: "", emergencyContactEmail: "",
  };
}

function Onboarding({ state, user, setState }: { state: CrewState; user: Profile; setState: React.Dispatch<React.SetStateAction<CrewState>> }) {
  const canReviewAll = user.role === "admin";
  const own = (state.onboarding ?? []).find((item) => item.userId === user.id);
  const [draft, setDraft] = useState<OnboardingDraft>(onboardingDraft);
  const set = (patch: Partial<OnboardingDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const requiredComplete = Boolean(draft.dateOfBirth && draft.address.trim() && draft.city.trim() && draft.postalCode.trim() && draft.sin.trim() && draft.driversLicenseNumber.trim() && draft.startDate && Number(draft.hourlyWage) > 0 && draft.vacationPayAcknowledged && draft.directDepositSignedName.trim() && draft.hoursTrackingSignedName.trim() && draft.emergencyContactName.trim() && draft.emergencyContactPhone.trim());
  const submit = () => {
    const now = new Date().toISOString();
    setState((next) => submitOnboarding(next, user.id, { ...draft, userId: user.id, hourlyWage: Number(draft.hourlyWage), directDepositSignedAt: now, hoursTrackingSignedAt: now }, now));
  };

  if (own) {
    return <div className="grid two"><section className="panel card"><div className="section-head"><div><h3>Onboarding</h3><p className="muted">Submitted {own.completedAt.slice(0, 10)}. Contact HR to change anything.</p></div><span className="pill good">Complete</span></div></section>{canReviewAll && <OnboardingAdminList state={state} />}</div>;
  }

  return <div className="grid two"><section className="panel card wide onboarding-form"><div className="section-head"><div><h3>New Employee Form</h3><p className="muted">One-time onboarding. Visible only to admin/HR once submitted.</p></div><span className="pill">Admin/HR only</span></div><div className="incident-sections"><fieldset><legend>Contact Information</legend><div className="field-grid"><label>Date of birth<input type="date" value={draft.dateOfBirth} onChange={(event) => set({ dateOfBirth: event.target.value })} /></label><label className="wide-field">Address<input value={draft.address} onChange={(event) => set({ address: event.target.value })} /></label><label>City<input value={draft.city} onChange={(event) => set({ city: event.target.value })} /></label><label>Postal code<input value={draft.postalCode} onChange={(event) => set({ postalCode: event.target.value })} /></label><label>SIN<input value={draft.sin} onChange={(event) => set({ sin: event.target.value })} /></label><label>Driver's license number<input value={draft.driversLicenseNumber} onChange={(event) => set({ driversLicenseNumber: event.target.value })} /></label><label className="wide-field">Allergies / medical conditions<textarea value={draft.allergiesMedical} onChange={(event) => set({ allergiesMedical: event.target.value })} /></label></div></fieldset><fieldset><legend>Employment</legend><div className="field-grid"><label>First day of work<input type="date" value={draft.startDate} onChange={(event) => set({ startDate: event.target.value })} /></label><label>Hourly wage<input type="number" min="0" step="0.01" value={draft.hourlyWage} onChange={(event) => set({ hourlyWage: event.target.value })} /></label></div></fieldset><fieldset><legend>Payroll Details</legend><div className="field-stack"><label className="check"><input type="checkbox" checked={draft.vacationPayAcknowledged} onChange={(event) => set({ vacationPayAcknowledged: event.target.checked })} /> I understand that vacation pay is paid on each paycheck.</label><label>I authorize Van-Isle Coating &amp; Sealants to pay me by direct deposit. Sign here<input value={draft.directDepositSignedName} onChange={(event) => set({ directDepositSignedName: event.target.value })} placeholder="Type your full name to sign" /></label><label>Direct deposit form (from your bank)<input type="file" onChange={(event) => set({ directDepositFileName: event.target.files?.[0]?.name ?? "" })} /></label>{draft.directDepositFileName && <small className="muted">Selected: {draft.directDepositFileName}</small>}<label>I understand that I must track my hours daily by 5pm on the BuilderTrend App. Sign here<input value={draft.hoursTrackingSignedName} onChange={(event) => set({ hoursTrackingSignedName: event.target.value })} placeholder="Type your full name to sign" /></label></div></fieldset><fieldset><legend>Driver's License Photo</legend><div className="field-grid"><label>Front<input type="file" accept="image/*" onChange={(event) => set({ driversLicenseFrontFileName: event.target.files?.[0]?.name ?? "" })} /></label><label>Back<input type="file" accept="image/*" onChange={(event) => set({ driversLicenseBackFileName: event.target.files?.[0]?.name ?? "" })} /></label></div></fieldset><fieldset><legend>Emergency Contact</legend><div className="field-grid"><label>Name<input value={draft.emergencyContactName} onChange={(event) => set({ emergencyContactName: event.target.value })} /></label><label>Relationship<input value={draft.emergencyContactRelationship} onChange={(event) => set({ emergencyContactRelationship: event.target.value })} /></label><label>Phone<input type="tel" value={draft.emergencyContactPhone} onChange={(event) => set({ emergencyContactPhone: event.target.value })} /></label><label>Email<input type="email" value={draft.emergencyContactEmail} onChange={(event) => set({ emergencyContactEmail: event.target.value })} /></label></div></fieldset></div><button className="primary block" disabled={!requiredComplete} onClick={submit}>Submit onboarding</button></section>{canReviewAll && <OnboardingAdminList state={state} />}</div>;
}

function OnboardingAdminList({ state }: { state: CrewState }) {
  const records = state.onboarding ?? [];
  return <section className="panel card wide"><div className="section-head"><div><h3>Submitted Onboarding (Admin/HR)</h3><p className="muted">Only visible to admin/HR.</p></div><span className="pill">{records.length}</span></div>{records.length ? <div className="incident-list">{records.map((record) => <article className="incident-card" key={record.id}><div className="section-head"><h4>{nameOf(state, record.userId)}</h4><small>Submitted {record.completedAt.slice(0, 10)}</small></div><div className="facts"><span>Start {record.startDate}</span><span>${record.hourlyWage}/hr</span><span>DOB {record.dateOfBirth}</span></div><div className="line"><b>Address</b><span>{record.address}, {record.city} {record.postalCode}</span></div><div className="line"><b>SIN</b><span>{record.sin}</span></div><div className="line"><b>Driver's license</b><span>{record.driversLicenseNumber}</span></div>{record.allergiesMedical && <div className="line"><b>Allergies/medical</b><span>{record.allergiesMedical}</span></div>}<div className="line"><b>Emergency contact</b><span>{record.emergencyContactName} ({record.emergencyContactRelationship}) - {record.emergencyContactPhone}</span></div>{record.directDepositFileName && <div className="line"><b>Direct deposit form</b><span>{record.directDepositFileName}</span></div>}{(record.driversLicenseFrontFileName || record.driversLicenseBackFileName) && <div className="line"><b>License photos</b><span>{[record.driversLicenseFrontFileName, record.driversLicenseBackFileName].filter(Boolean).join(", ")}</span></div>}</article>)}</div> : <p className="empty-state">No onboarding submissions yet.</p>}</section>;
}

function Wallet({ state, user }: { state: CrewState; user: Profile }) {
  const quarter = quarterlyLeaderboard(state.pointsEvents, state.users, "2026-07");
  return <div className="grid two"><section className="panel card"><h3>One balance</h3><div className="wallet-grid"><div className="wallet-tile"><strong>{walletBalance(state.pointsEvents, user.id)}</strong><span>Wallet balance</span></div><div className="wallet-tile"><strong>${state.walletConfig.rewardDollarPerPoint.toFixed(2)}</strong><span>per point anchor</span></div></div></section><section className="panel card"><h3>Company leaderboard</h3>{leaderboard(state).map((row, index) => <div className="lb" key={row.user.id}><b>{index + 1}. {row.user.name}</b><span className="pill">{row.balance} pts</span></div>)}</section><section className="panel card"><h3>Quarter leaderboard</h3><p className="muted">Quarterly race resets; wallet balance carries over.</p>{quarter.slice(0, 5).map((row, index) => <div className="lb" key={row.user.id}><b>{index + 1}. {row.user.name}</b><span className="pill">{row.balance} pts</span></div>)}</section><section className="panel card wide"><h3>Ledger</h3><div className="ledger-list">{state.pointsEvents.slice(0, 12).map((event) => <div className="line" key={event.id}><b>{event.points > 0 ? "+" : ""}{event.points}</b><span>{event.reason}</span><small>{event.type} - {event.ts.slice(0, 10)}</small></div>)}</div></section></div>;
}

function Rituals({ state, user, setState }: { state: CrewState; user: Profile; setState: React.Dispatch<React.SetStateAction<CrewState>> }) {
  const pointsFor = (cadence: "daily" | "weekly" | "monthly") => rulePoints(state, cadence === "daily" ? "earn-daily" : cadence === "weekly" ? "earn-weekly" : "earn-monthly", 5);
  return <div className="library">{state.values.map((value) => <section className="panel card" key={value.id}><div className="section-head"><div><h3>{value.name}</h3><p>{value.wording}</p></div><span className="pill">Value</span></div><div className="ritual"><b>Weekly</b><span>{value.weeklyRitual}</span><button onClick={() => setState((next) => completeRitual(next, user.id, value.id, "weekly", "2026-W31"))}>Complete +{pointsFor("weekly")}</button></div></section>)}</div>;
}

function Reviews({ state, user, setState }: { state: CrewState; user: Profile; setState: React.Dispatch<React.SetStateAction<CrewState>> }) {
  const visible = canRunReviews(state, user) ? state.reviews : state.reviews.filter((review) => review.userId === user.id);
  const crewScale = user.branch === "field";
  const [openReviewId, setOpenReviewId] = useState<string | null>(null);
  const openReview = state.reviews.find((item) => item.id === openReviewId);
  const canManage = canRunReviews(state, user);
  return <div className="grid two"><section className="panel card wide"><div className="section-head"><h3>Review cadence</h3><span className="pill">{visible.length} visible</span></div>{visible.map((review) => {
    const isQuarterly = review.type === "quarterly";
    const isSubject = review.userId === user.id;
    const submission = isQuarterly ? employeeReviewSubmission(state, review) : undefined;
    return <div className="review-card" key={review.id}>
      <div><b>{nameOf(state, review.userId)} - {review.type}</b><small>{review.scheduledFor} - {review.status}</small></div>
      {review.status !== "completed" && isQuarterly && isSubject && !submission && <button onClick={() => setOpenReviewId(review.id)}>Complete self-assessment</button>}
      {review.status !== "completed" && isQuarterly && isSubject && submission && <span className="pill good">Self-assessment submitted</span>}
      {review.status !== "completed" && isQuarterly && !isSubject && canManage && submission && <button onClick={() => setOpenReviewId(review.id)}>Complete review</button>}
      {review.status !== "completed" && isQuarterly && !isSubject && canManage && !submission && <span className="pill warn">Waiting on self-assessment</span>}
      {review.status !== "completed" && !isQuarterly && canManage && <button onClick={() => setState((next) => { const subject = next.users.find((item) => item.id === review.userId); const ratings = subject?.branch === "field" ? { responsibilities: "meets" as const, values: "meets" as const, kpis: "meets" as const } : { responsibilities: 3 as const, values: 3 as const, kpis: 3 as const }; return completeReview(next, review.id, ratings); })}>Complete +{rulePoints(state, "earn-review", 5)}</button>}
    </div>;
  })}</section>
  {openReview && openReview.userId === user.id && !employeeReviewSubmission(state, openReview) && <QuarterlyReviewEmployeeForm state={state} user={user} review={openReview} setState={setState} onDone={() => setOpenReviewId(null)} />}
  {openReview && canManage && openReview.status !== "completed" && employeeReviewSubmission(state, openReview) && <QuarterlyReviewManagerForm state={state} manager={user} review={openReview} setState={setState} onDone={() => setOpenReviewId(null)} />}
  <section className="panel card"><h3>{crewScale ? "Crew scale" : "Office scale"}</h3>{crewScale ? <div className="seg review-scale"><button>Below</button><button className="on">Meets</button><button>Exceeds</button></div> : <div className="seg review-scale"><button>1</button><button>2</button><button className="on">3</button><button>4</button><button>5</button></div>}<p className="muted">Crew reviews use Below, Meets, and Exceeds. Office roles may use the optional 1-5 scale.</p></section><section className="panel card wide"><div className="section-head"><h3>KPIs</h3><span className="pill">{user.orgRole}</span></div>{state.kpis.filter((kpi) => kpi.role === user.orgRole).map((kpi) => <div className="line" key={kpi.id}><b>{kpi.name}</b><span>{kpi.target || "Target TBD"}</span><button onClick={() => setState((next) => awardKpiHit(next, user.id, kpi.id, "2026-Q3"))}>Mark hit +{rulePoints(state, "earn-kpi", 5)}</button></div>)}</section><section className="panel card wide"><h3>Between-review notes</h3>{state.reviewNotes.length ? state.reviewNotes.map((note) => <div className="line" key={note.id}><b>{nameOf(state, note.userId)}</b><span>{note.note}</span><small>{note.ts.slice(0, 10)}</small></div>) : <p className="empty-state">No lightweight notes yet.</p>}</section></div>;
}

function QuarterlyReviewEmployeeForm({ state, user, review, setState, onDone }: { state: CrewState; user: Profile; review: Review; setState: React.Dispatch<React.SetStateAction<CrewState>>; onDone: () => void }) {
  const form = state.forms.find((item) => item.id === "form-quarterly-scorecard");
  const questions = state.formQuestions.filter((item) => item.formId === form?.id).sort((a, b) => a.order - b.order);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const valid = questions.every((question) => !question.required || Boolean(responses[question.id]?.trim()));
  const submit = () => { setState((next) => submitQuarterlyReviewAnswers(next, user.id, review.id, responses)); onDone(); };
  return <section className="panel card wide"><div className="section-head"><div><h3>Quarterly self-assessment</h3><p className="muted">Complete at least 1 day before your review on {review.scheduledFor}. The results will be discussed with {nameOf(state, review.managerId)}.</p></div><button onClick={onDone}>Close</button></div><div className="swot-grid">{questions.map((question) => {
    const value = responses[question.id] ?? "";
    if (question.responseType === "Scale 1-5") {
      return <label key={question.id}>{question.question}<div className="seg review-scale">{[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} className={value === String(n) ? "on" : ""} onClick={() => setResponses((current) => ({ ...current, [question.id]: String(n) }))}>{n}</button>)}</div></label>;
    }
    if (question.responseType === "Checkbox" && question.options?.length) {
      return <label key={question.id}>{question.question}<div className="seg review-scale">{question.options.map((option) => <button type="button" key={option} className={value === option ? "on" : ""} onClick={() => setResponses((current) => ({ ...current, [question.id]: option }))}>{option}</button>)}</div></label>;
    }
    return <label key={question.id}>{question.question}<textarea value={value} onChange={(event) => setResponses((current) => ({ ...current, [question.id]: event.target.value }))} /></label>;
  })}</div><button className="primary block" disabled={!valid} onClick={submit}>Submit self-assessment</button></section>;
}

function QuarterlyReviewManagerForm({ state, manager, review, setState, onDone }: { state: CrewState; manager: Profile; review: Review; setState: React.Dispatch<React.SetStateAction<CrewState>>; onDone: () => void }) {
  const submission = employeeReviewSubmission(state, review);
  const form = state.forms.find((item) => item.id === "form-quarterly-scorecard");
  const questions = state.formQuestions.filter((item) => item.formId === form?.id).sort((a, b) => a.order - b.order);
  const [jobResponsibilities, setJobResponsibilities] = useState<Record<string, number>>({});
  const [jobComments, setJobComments] = useState("");
  const [kpiReview, setKpiReview] = useState<Record<string, { actual?: string; rating?: string }>>({});
  const [coreValues, setCoreValues] = useState({ helpful: false, clear: false, professional: false, examples: "" });
  const [career, setCareer] = useState({ wantToLearn: "", nextYear: "" });
  const [feedback, setFeedback] = useState({ slowsDown: "", wastesTime: "", easierJob: "", equipmentNeeded: "", sopsToImprove: "", ifOwnedCompany: "" });
  const [summary, setSummary] = useState({ wentWell: "", needsImprovement: "" });
  const [overallIndex, setOverallIndex] = useState(3);
  const jobComplete = JOB_RESPONSIBILITY_ITEMS.every((item) => (jobResponsibilities[item] ?? 0) > 0);
  const submit = () => {
    const detail: QuarterlyReviewDetail = {
      jobResponsibilities, jobResponsibilityComments: jobComments.trim() || undefined,
      kpiReview, coreValues: { ...coreValues, examples: coreValues.examples.trim() || undefined },
      careerDevelopment: career, feedbackForManagement: feedback, managerSummary: summary,
    };
    setState((next) => completeQuarterlyReview(next, manager.id, review.id, detail, overallIndex as 1 | 2 | 3 | 4 | 5));
    onDone();
  };
  return <section className="panel card wide"><div className="section-head"><div><h3>Complete quarterly review - {nameOf(state, review.userId)}</h3><p className="muted">Scheduled {review.scheduledFor}</p></div><button onClick={onDone}>Close</button></div><div className="incident-sections">
    <fieldset><legend>Employee self-assessment {submission ? `(submitted ${submission.submittedAt.slice(0, 10)})` : ""}</legend><div className="field-stack">{questions.map((question) => <div className="line" key={question.id}><b>{question.question}</b><span>{submission?.responses[question.id] || "-"}</span></div>)}</div></fieldset>
    <fieldset><legend>Review Job Description</legend><div className="field-grid">{JOB_RESPONSIBILITY_ITEMS.map((item) => <label key={item}>{item}<div className="seg review-scale">{[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} className={jobResponsibilities[item] === n ? "on" : ""} onClick={() => setJobResponsibilities((current) => ({ ...current, [item]: n }))}>{n}</button>)}</div></label>)}</div><label className="wide-field">Comments<textarea value={jobComments} onChange={(event) => setJobComments(event.target.value)} /></label></fieldset>
    <fieldset><legend>KPI Review</legend><div className="field-stack">{KPI_REVIEW_ITEMS.map(({ name, target }) => <div className="kpi-row" key={name}><b>{name}</b><span className="tiny muted">target {target}</span><input placeholder="Actual" value={kpiReview[name]?.actual ?? ""} onChange={(event) => setKpiReview((current) => ({ ...current, [name]: { ...current[name], actual: event.target.value } }))} /><select value={kpiReview[name]?.rating ?? ""} onChange={(event) => setKpiReview((current) => ({ ...current, [name]: { ...current[name], rating: event.target.value } }))}><option value="">Rating</option><option value="met">Met</option><option value="missed">Missed</option></select></div>)}</div></fieldset>
    <fieldset><legend>Living Our Core Values</legend><div className="field-stack"><label className="check"><input type="checkbox" checked={coreValues.helpful} onChange={(event) => setCoreValues((current) => ({ ...current, helpful: event.target.checked }))} /> Helpful</label><label className="check"><input type="checkbox" checked={coreValues.clear} onChange={(event) => setCoreValues((current) => ({ ...current, clear: event.target.checked }))} /> Clear</label><label className="check"><input type="checkbox" checked={coreValues.professional} onChange={(event) => setCoreValues((current) => ({ ...current, professional: event.target.checked }))} /> Professional</label><label className="wide-field">Examples - what did they do that demonstrates this?<textarea value={coreValues.examples} onChange={(event) => setCoreValues((current) => ({ ...current, examples: event.target.value }))} /></label></div></fieldset>
    <fieldset><legend>Career Development</legend><div className="field-stack"><label>What would you like to learn?<textarea value={career.wantToLearn} onChange={(event) => setCareer((current) => ({ ...current, wantToLearn: event.target.value }))} /></label><label>Where do you see yourself next year?<textarea value={career.nextYear} onChange={(event) => setCareer((current) => ({ ...current, nextYear: event.target.value }))} /></label></div></fieldset>
    <fieldset><legend>Feedback for Management</legend><div className="field-stack"><label>What slows you down?<textarea value={feedback.slowsDown} onChange={(event) => setFeedback((current) => ({ ...current, slowsDown: event.target.value }))} /></label><label>What wastes time?<textarea value={feedback.wastesTime} onChange={(event) => setFeedback((current) => ({ ...current, wastesTime: event.target.value }))} /></label><label>How can we make your job easier?<textarea value={feedback.easierJob} onChange={(event) => setFeedback((current) => ({ ...current, easierJob: event.target.value }))} /></label><label>What equipment do we need?<textarea value={feedback.equipmentNeeded} onChange={(event) => setFeedback((current) => ({ ...current, equipmentNeeded: event.target.value }))} /></label><label>What SOPs should we improve?<textarea value={feedback.sopsToImprove} onChange={(event) => setFeedback((current) => ({ ...current, sopsToImprove: event.target.value }))} /></label><label>If you owned the company, what would you change first?<textarea value={feedback.ifOwnedCompany} onChange={(event) => setFeedback((current) => ({ ...current, ifOwnedCompany: event.target.value }))} /></label></div></fieldset>
    <fieldset><legend>Overall Summary</legend><div className="field-stack"><label>What went well?<textarea value={summary.wentWell} onChange={(event) => setSummary((current) => ({ ...current, wentWell: event.target.value }))} /></label><label>What needs improvement?<textarea value={summary.needsImprovement} onChange={(event) => setSummary((current) => ({ ...current, needsImprovement: event.target.value }))} /></label></div></fieldset>
    <fieldset><legend>Overall Rating</legend><select value={overallIndex} onChange={(event) => setOverallIndex(Number(event.target.value))}>{OVERALL_RATING_LABELS.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}</select></fieldset>
  </div><button className="primary block" disabled={!jobComplete} onClick={submit}>Complete review +{rulePoints(state, "earn-review", 5)}</button></section>;
}

function Forms({ state, user, setState }: { state: CrewState; user: Profile; setState: React.Dispatch<React.SetStateAction<CrewState>> }) {
  const form = state.forms.find((item) => item.id === "form-swot");
  const questions = state.formQuestions.filter((item) => item.formId === form?.id).sort((a, b) => a.order - b.order);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const deadline = nextQuarterDeadline(new Date().toISOString().slice(0, 10));
  const existing = state.formSubmissions.find((item) => item.formId === form?.id && item.userId === user.id && item.periodKey === deadline);
  const valid = questions.every((question) => {
    const response = responses[question.id] ?? "";
    return (!question.required || Boolean(response.trim())) && (!question.wordLimit || wordCount(response) <= question.wordLimit);
  });
  return <div className="grid two"><section className="panel card wide"><div className="section-head"><div><h3>{form?.name ?? "Quarterly SWOT"}</h3><p className="muted">{form?.description}</p></div><div className="form-status"><span className="pill">Due {deadline}</span><span className={`pill ${existing ? "good" : "warn"}`}>{existing ? "Submitted" : "Open"}</span></div></div>{existing ? <div className="empty-state">Submitted {existing.submittedAt.slice(0, 10)}. Your next form opens for the following quarter.</div> : <div className="swot-grid">{questions.map((question) => { const value = responses[question.id] ?? ""; const count = wordCount(value); return <label key={question.id}>{question.question}<textarea value={value} onChange={(event) => setResponses((current) => ({ ...current, [question.id]: event.target.value }))} placeholder={`Describe ${question.question.toLowerCase()}...`} /><small className={question.wordLimit && count > question.wordLimit ? "error" : ""}>{count} / {question.wordLimit ?? 500} words</small></label>; })}</div>} {!existing && <button className="primary block" disabled={!valid} onClick={() => setState((next) => submitQuarterlySwot(next, user.id, responses))}>Submit SWOT +{rulePoints(state, "earn-swot", 5)}</button>}</section><section className="panel card wide"><h3>Quarterly deadlines</h3><div className="deadline-grid">{["March 31", "June 30", "September 30", "December 31"].map((date) => <span className="pill" key={date}>{date}</span>)}</div></section></div>;
}

function TimeOff({ state, user, setState }: { state: CrewState; user: Profile; setState: React.Dispatch<React.SetStateAction<CrewState>> }) {
  const year = new Date().getFullYear();
  const policy = state.timeOffPolicies.find((item) => item.year === year) ?? state.timeOffPolicies[0];
  const canViewTeam = user.role === "admin" || user.role === "manager";
  const visibleUsers = canViewTeam ? state.users.filter((item) => item.branch === "field" && item.status !== "Inactive") : [user];
  return <div className="time-off-page"><section className="panel card time-off-policy"><div className="section-head"><div><h3>{year} sick and vacation</h3><p className="muted">Balances renew January 1. Eligibility begins after 90 consecutive calendar days of employment.</p></div><span className="pill">Jan 1 - Dec 31</span></div><div className="facts"><span>{policy?.paidSickDays ?? 5} paid sick days</span><span>{policy?.unpaidSickDays ?? 3} unpaid sick days</span><span>Vacation allowance by employee</span></div><p className="toast warn">Vacation balance reminders use email and text. Sick-day usage reminders are not sent.</p></section><div className="library">{visibleUsers.map((item) => <TimeOffUserCard key={item.id} state={state} viewer={user} user={item} year={year} setState={setState} />)}</div></div>;
}

function TimeOffUserCard({ state, viewer, user, year, setState }: { state: CrewState; viewer: Profile; user: Profile; year: number; setState: React.Dispatch<React.SetStateAction<CrewState>> }) {
  const summary = timeOffSummary(state, user.id, year);
  const [kind, setKind] = useState<TimeOffKind>("vacation");
  const [days, setDays] = useState(1);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const canManageAllowance = viewer.role === "admin" || viewer.role === "manager";
  const eligible = Boolean(summary.eligibleFrom && date >= summary.eligibleFrom);
  const entries = state.timeOffEntries.filter((item) => item.userId === user.id && item.date.startsWith(String(year)));
  const setVacationAllowance = (value: number | undefined) => setState((next) => ({ ...next, users: next.users.map((item) => item.id === user.id ? { ...item, vacationDaysAnnual: value } : item) }));
  return <section className="panel card time-off-card"><div className="section-head"><div><h3>{user.name}</h3><small>{summary.eligibleFrom ? `Eligible from ${summary.eligibleFrom}` : "Hire date needed for eligibility"}</small></div><span className={`pill ${eligible ? "good" : "warn"}`}>{eligible ? "Eligible" : "Not eligible"}</span></div><div className="leave-balances"><div className="score-tile"><strong>{summary.paidSickRemaining}</strong><span>paid sick left</span></div><div className="score-tile"><strong>{summary.unpaidSickRemaining}</strong><span>unpaid sick left</span></div><div className="score-tile"><strong>{summary.vacationRemaining ?? "TBD"}</strong><span>vacation left</span></div></div>{canManageAllowance && <label>Annual vacation allowance<input type="number" min="0" step="0.5" value={user.vacationDaysAnnual ?? ""} placeholder="Client roster pending" onChange={(event) => setVacationAllowance(event.target.value === "" ? undefined : Number(event.target.value))} /></label>}<div className="time-off-entry"><select value={kind} onChange={(event) => setKind(event.target.value as TimeOffKind)}><option value="vacation">Vacation</option><option value="paid_sick">Paid sick</option><option value="unpaid_sick">Unpaid sick</option></select><input type="number" min="0.5" step="0.5" value={days} onChange={(event) => setDays(Number(event.target.value))} /><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note" /><button disabled={!eligible || (kind === "vacation" && summary.vacationRemaining == null)} onClick={() => { setState((next) => recordTimeOff(next, user.id, kind, days, date, note)); setNote(""); }}>Log time</button></div>{summary.vacationRemaining != null && <p className="vacation-reminder">Email/text: {vacationReminderText(state, user.id, year)}</p>}<div className="leave-history">{entries.map((entry) => <div className="line" key={entry.id}><b>{entry.kind.replaceAll("_", " ")}</b><span>{entry.days} day{entry.days === 1 ? "" : "s"}</span><small>{entry.date}{entry.note ? ` - ${entry.note}` : ""}</small></div>)}{entries.length === 0 && <p className="empty-state">No time-off usage logged for {year}.</p>}</div></section>;
}

function Incidents({ state, user, setState }: { state: CrewState; user: Profile; setState: React.Dispatch<React.SetStateAction<CrewState>> }) {
  const today = new Date().toISOString().slice(0, 10);
  const canViewAll = user.role === "admin" || user.role === "manager";
  const visibleReports = (state.incidentReports ?? []).filter((report) => canViewAll || report.reportedByUserId === user.id);
  const [draft, setDraft] = useState<IncidentReportDraft>(() => incidentDraft(user, today));
  const requiredComplete = Boolean(draft.employeeName.trim() && draft.employeeRole.trim() && draft.location.trim() && draft.dateOfIncident && draft.timeOfIncident && draft.incidentCause.trim() && draft.incidentDetails.trim() && draft.actionTaken.trim() && draft.reportedByName.trim() && draft.reportedByRole.trim());
  const set = (patch: Partial<IncidentReportDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const submit = () => {
    setState((next) => submitIncidentReport(next, user.id, { ...draft, photoFileNames: (draft.photoFileNames ?? []).filter(Boolean) }));
    setDraft(incidentDraft(user, today));
  };

  return <div className="incident-page"><section className="panel card wide incident-form"><div className="section-head"><div><h3>Damage and Incident Report</h3><p className="muted">Submit the simplified incident report for Crew Lead or Owner receipt confirmation.</p></div><span className="pill">Receipt required</span></div><div className="incident-sections"><fieldset><legend>Employee Details</legend><div className="field-grid"><label>Employee name<input value={draft.employeeName} onChange={(event) => set({ employeeName: event.target.value })} /></label><label>Employee role<input value={draft.employeeRole} onChange={(event) => set({ employeeRole: event.target.value })} /></label><label>Employee phone<input type="tel" value={draft.employeePhone ?? ""} onChange={(event) => set({ employeePhone: event.target.value })} /></label></div></fieldset><fieldset><legend>Incident Details</legend><div className="field-grid"><label className="wide-field">Location<input value={draft.location} onChange={(event) => set({ location: event.target.value })} /></label><label>Date of incident<input type="date" value={draft.dateOfIncident} onChange={(event) => set({ dateOfIncident: event.target.value })} /></label><label>Time of incident<input type="time" value={draft.timeOfIncident} onChange={(event) => set({ timeOfIncident: event.target.value })} /></label><label className="wide-field">Incident cause<input value={draft.incidentCause} onChange={(event) => set({ incidentCause: event.target.value })} /></label><label className="wide-field">Incident details<textarea value={draft.incidentDetails} onChange={(event) => set({ incidentDetails: event.target.value })} /></label><label className="wide-field">Action taken<textarea value={draft.actionTaken} onChange={(event) => set({ actionTaken: event.target.value })} /></label><label className="check"><input type="checkbox" checked={draft.policeNotified} onChange={(event) => set({ policeNotified: event.target.checked })} /> Police notified</label><label className="wide-field">Follow-up required<textarea value={draft.followUpRequired ?? ""} onChange={(event) => set({ followUpRequired: event.target.value })} /></label><label className="wide-field">Photo file<input type="file" onChange={(event) => set({ photoFileNames: event.target.files?.[0] ? [event.target.files[0].name] : [] })} /></label></div>{(draft.photoFileNames ?? []).length > 0 && <p className="muted">Selected: {(draft.photoFileNames ?? []).join(", ")}</p>}</fieldset><fieldset><legend>Reported By</legend><div className="field-grid"><label>Reported by name<input value={draft.reportedByName} onChange={(event) => set({ reportedByName: event.target.value })} /></label><label>Reported by role<input value={draft.reportedByRole} onChange={(event) => set({ reportedByRole: event.target.value })} /></label><label>Reported by phone<input type="tel" value={draft.reportedByPhone ?? ""} onChange={(event) => set({ reportedByPhone: event.target.value })} /></label></div></fieldset></div><button className="primary block" disabled={!requiredComplete} onClick={submit}>Submit report</button></section><section className="panel card wide"><div className="section-head"><div><h3>Submitted Reports</h3><p className="muted">{canViewAll ? "Manager/admin view shows all submitted reports." : "Crew view shows reports you submitted."}</p></div><span className="pill">{visibleReports.length} visible</span></div>{visibleReports.length ? <div className="incident-list">{visibleReports.map((report) => <IncidentReportCard key={report.id} state={state} report={report} user={user} setState={setState} />)}</div> : <p className="empty-state">No incident reports yet.</p>}</section></div>;
}

function IncidentReportCard({ state, report, user, setState }: { state: CrewState; report: IncidentReport; user: Profile; setState: React.Dispatch<React.SetStateAction<CrewState>> }) {
  const canConfirm = canConfirmIncidentReceipt(user);
  return <article className="incident-card"><div className="section-head"><div><h3>{report.employeeName}</h3><small>{report.dateOfIncident} at {report.timeOfIncident} - reported by {report.reportedByName}</small></div><span className={`pill ${report.confirmedAt ? "good" : "warn"}`}>{report.confirmedAt ? "Confirmed" : "Unconfirmed"}</span></div><div className="incident-summary"><div className="facts"><span>{report.employeeRole}</span><span>{report.location}</span><span>{report.policeNotified ? "Police notified" : "Police not notified"}</span></div><div className="line"><b>Cause</b><span>{report.incidentCause}</span></div><div className="line"><b>Details</b><span>{report.incidentDetails}</span></div><div className="line"><b>Action taken</b><span>{report.actionTaken}</span></div>{report.followUpRequired ? <div className="line"><b>Follow-up required</b><span>{report.followUpRequired}</span></div> : null}{report.photoFileNames?.length ? <div className="line"><b>Photos</b><span>{report.photoFileNames.join(", ")}</span></div> : null}</div><section className="receipt-box"><h4>Confirm Receipt</h4>{report.confirmedAt ? <p className="toast good">Confirmed by {report.confirmedByName} on {report.confirmedAt.slice(0, 10)}.</p> : canConfirm ? <button onClick={() => setState((next) => confirmIncidentReceipt(next, report.id, user.id))}>Confirm receipt</button> : <p className="empty-state">Awaiting Crew Lead or Owner confirmation.</p>}</section></article>;
}

function Bonus({ state, user, setState }: { state: CrewState; user: Profile; setState: React.Dispatch<React.SetStateAction<CrewState>> }) {
  const dollarsVisible = canSeeBonusDollars(state, user);
  const canManageComp = user.role === "admin";
  const comp = (state.compensation ?? []).find((item) => item.userId === user.id);
  const ratings = state.reviews.filter((review) => review.userId === user.id && review.status === "completed").flatMap((review) => Object.values(review.ratings).filter(Boolean) as ReviewRating[]);
  const trajectory = bonusTrajectory(ratings);
  const average = averageQuarterlyRating(state, user.id, state.bonusPeriods[0]?.year ?? 2026);
  const percent = bonusPercentForAverage(average);
  const updateComp = (patch: Parameters<typeof setCompensation>[3]) => setState((next) => setCompensation(next, next.currentUserId, user.id, patch));
  const today = new Date().toISOString().slice(0, 10);
  const showAdminBonusNotice = user.role === "admin" && bonusAdminReviewNoticeActive(today);
  const showEmployeeBonusNotice = bonusEmployeeNoticeActive(user, today);
  return <div className="grid two">{showAdminBonusNotice && <p className="toast warn">Performance reviews for qualifying employees should be completed before November 30.</p>}{showEmployeeBonusNotice && <p className="toast good">Your performance will be reviewed and scored for the bonus program this November.</p>}<section className="panel card hero-panel"><h3>{trajectory.toUpperCase()}</h3><p>Trajectory only. Bonus dollars stay admin/CFO-only.</p><div className="facts"><span>{state.bonusPeriods[0]?.year ?? 2026} period</span><span>{Math.round(percent * 100)}% cap</span></div></section>{canManageComp && <section className="panel card"><h3>Compensation (admin/HR only)</h3><div className="field-stack"><p className="muted">{state.bonusConfig.floorsCaps}</p><p className="muted">{state.bonusConfig.reviewAverageSource}</p><label>Gross annual wages<input value={comp?.grossAnnualWages ?? ""} placeholder="Pending client confirmation" onChange={(event) => updateComp({ grossAnnualWages: Number(event.target.value) || undefined })} /></label><label>Retention bonus amount<input value={comp?.retentionBonusAmount ?? ""} onChange={(event) => updateComp({ retentionBonusAmount: Number(event.target.value) || undefined })} /></label><label>Retention bonus pay-out date<input type="date" value={comp?.retentionBonusPayoutDate ?? ""} onChange={(event) => updateComp({ retentionBonusPayoutDate: event.target.value || undefined })} /></label><label>Cost of living increase<input value={comp?.costOfLivingIncrease ?? ""} onChange={(event) => updateComp({ costOfLivingIncrease: Number(event.target.value) || undefined })} /></label></div></section>}<section className="panel card wide"><div className="section-head"><h3>Dollar privacy</h3><span className="pill">{dollarsVisible ? "Admin/CFO" : "Private"}</span></div>{dollarsVisible ? <Metric label="Estimated share" value={`$${estimatedBonusDollars(state, user).toLocaleString("en-CA")}`} /> : <p className="empty-state">Your trajectory is visible, but bonus dollar amounts are admin/CFO-only.</p>}</section></div>;
}

function Compliance({ state, user, setState }: { state: CrewState; user: Profile; setState: React.Dispatch<React.SetStateAction<CrewState>> }) {
  const canViewTeam = user.role === "admin" || user.role === "manager" || canRunReviews(state, user);
  const visibleUsers = canViewTeam ? state.users.filter((item) => item.branch === "field" && item.status !== "Inactive") : [user];
  return <div className="compliance-page"><PolicyPanel state={state} user={user} setState={setState} /><div className="library">{visibleUsers.map((item) => <ComplianceUserCard key={item.id} state={state} user={item} setState={setState} />)}</div></div>;
}

function PolicyPanel({ state, user, setState }: { state: CrewState; user: Profile; setState: React.Dispatch<React.SetStateAction<CrewState>> }) {
  const policy = state.policyDocuments.find((item) => item.active);
  const year = new Date().getFullYear();
  const acknowledgment = state.policyAcknowledgments.find((item) => item.policyId === policy?.id && item.userId === user.id && item.year === year);
  const [read, setRead] = useState(false);
  const [signedName, setSignedName] = useState(user.name);
  if (!policy) return null;
  return <section className="panel card policy-panel"><div className="section-head"><div><h3>{policy.title}</h3><p className="muted">Read the full policy, then sign and date the annual acknowledgment.</p></div><div className="form-status"><span className="pill">Due {policyDueDate(policy, year)}</span><span className={`pill ${acknowledgment ? "good" : "warn"}`}>{acknowledgment ? "Signed" : "Action needed"}</span></div></div><a className="button-link" href={policy.fileUrl} target="_blank" rel="noreferrer">Open policy PDF</a>{acknowledgment ? <p className="toast good">Signed by {acknowledgment.signedName} on {acknowledgment.signedAt.slice(0, 10)}.</p> : <div className="policy-sign"><label className="check"><input type="checkbox" checked={read} onChange={(event) => setRead(event.target.checked)} />I have read the complete policy.</label><label>Electronic signature<input value={signedName} onChange={(event) => setSignedName(event.target.value)} /></label><button className="primary" disabled={!read || !signedName.trim()} onClick={() => setState((next) => acknowledgePolicy(next, policy.id, user.id, signedName))}>Sign and date</button></div>}</section>;
}

function ComplianceUserCard({ state, user, setState }: { state: CrewState; user: Profile; setState: React.Dispatch<React.SetStateAction<CrewState>> }) {
  const [certTypeId, setCertTypeId] = useState(state.certificationTypes[0]?.id ?? "");
  const certs = state.certifications.filter((cert) => cert.userId === user.id);
  const today = new Date().toISOString().slice(0, 10);
  const levelFor = (cert: Certification) => certAlertLevelFromType(cert, state.certificationTypes.find((type) => type.id === cert.certTypeId), today);
  const red = certs.filter((cert) => levelFor(cert) === "red").length;
  const amber = certs.filter((cert) => levelFor(cert) === "amber").length;
  const updateCert = (certId: string, patch: Partial<Certification>) => setState((next) => ({ ...next, certifications: next.certifications.map((cert) => cert.id === certId && cert.userId === user.id ? { ...cert, ...patch } : cert) }));
  const addCertification = () => {
    const type = state.certificationTypes.find((item) => item.id === certTypeId);
    if (!type) return;
    const cert: Certification = { id: `cert-${user.id}-${type.id}-${Date.now()}`, userId: user.id, certTypeId: type.id, name: type.name, issuingBody: type.issuingBody, status: "date_needed", note: "Crew-added certification; complete the fields and attach the certificate." };
    setState((next) => ({ ...next, certifications: [cert, ...next.certifications] }));
  };
  return <section className="panel card compliance-card"><div className="section-head"><div><h3>{user.name}</h3><div className="cert-summary"><span className="pill bad">{red} urgent</span><span className="pill warn">{amber} upcoming</span></div></div><button onClick={() => setState((next) => awardCertsCurrent(next, user.id, today.slice(0, 7)))}>Current +{rulePoints(state, "earn-certs", 5)}</button></div><div className="add-cert"><select value={certTypeId} onChange={(event) => setCertTypeId(event.target.value)}>{state.certificationTypes.map((type) => <option value={type.id} key={type.id}>{type.name}</option>)}</select><button onClick={addCertification}>Add certification</button></div><div className="cert-list">{certs.length ? certs.map((cert) => <div className="line cert-record" key={cert.id}><b>{cert.name}</b><span className={`pill ${toneForCert(levelFor(cert))}`}>{cert.status}</span><small>{cert.expiresAt ? `expires ${cert.expiresAt}` : cert.courseDate ? `course ${cert.courseDate}` : cert.note || "expiry date needed"}</small><div className="field-stack"><label>Course date<input type="date" value={cert.courseDate ?? ""} onChange={(event) => updateCert(cert.id, { courseDate: event.target.value })} /></label><label>Expiry date<input type="date" value={cert.expiresAt ?? ""} onChange={(event) => updateCert(cert.id, { expiresAt: event.target.value })} /></label><label>Certificate number<input value={cert.certificateNumber ?? ""} placeholder="Certificate #" onChange={(event) => updateCert(cert.id, { certificateNumber: event.target.value })} /></label><label>Certificate photo or PDF<input type="file" accept="image/*,.pdf" onChange={(event) => updateCert(cert.id, { certificatePhotoKey: event.target.files?.[0]?.name })} /></label>{cert.certificatePhotoKey && <small>{cert.certificatePhotoKey}</small>}<button onClick={() => setState((next) => awardCertDetail(next, cert.userId, cert.id))}>Save details +{rulePoints(state, "earn-cert-detail", 5)}</button></div></div>) : <p className="empty-state">No certifications yet. Add the first record above.</p>}</div></section>;
}

function Feedback({ state, user, setState }: { state: CrewState; user: Profile; setState: React.Dispatch<React.SetStateAction<CrewState>> }) {
  const [message, setMessage] = useState("");
  const [peerId, setPeerId] = useState(state.users.find((item) => item.id !== user.id)?.id ?? user.id);
  const [customer, setCustomer] = useState("");
  return <div className="grid two"><section className="panel card"><h3>Company feedback</h3><div className="feedback-form"><textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="What should we improve?" /><button disabled={!message.trim()} onClick={() => { setState((next) => submitFeedback(next, user.id, message)); setMessage(""); }}>Submit +{rulePoints(state, "earn-feedback", 5)}</button></div></section><section className="panel card"><h3>Peer recognition</h3><div className="feedback-form"><select value={peerId} onChange={(event) => setPeerId(event.target.value)}>{state.users.filter((item) => item.id !== user.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="What did they do?" /><button disabled={!message.trim()} onClick={() => { setState((next) => giveRecognition(next, user.id, peerId, message)); setMessage(""); }}>Send +{rulePoints(state, "earn-peer", 5)} to them</button></div></section><section className="panel card wide"><div className="section-head"><div><h3>Customer review QR / manual confirm</h3><p className="muted">Share {user.name}'s review link with the customer, then confirm after the review names them.</p></div><span className="pill good">Manual</span></div><div className="field-stack"><a className="button-link" href={state.config.googleReviewUrl} target="_blank" rel="noreferrer">Open {user.name}'s Google review link</a><input value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder="Customer or job name" /><div className="step-actions"><button disabled={!customer.trim()} onClick={() => { setState((next) => confirmCustomerReview(next, user.id, "google_5_star", customer)); setCustomer(""); }}>Confirm 5-star +{rulePoints(state, "earn-google", 200)}</button><button disabled={!customer.trim()} onClick={() => { setState((next) => confirmCustomerReview(next, user.id, "written_compliment", customer)); setCustomer(""); }}>Written compliment +{rulePoints(state, "earn-compliment", 5)}</button></div></div></section><section className="panel card wide"><h3>Recognition feed</h3><div className="feed-list">{state.recognitions.map((item) => <div className="line" key={item.id}><b>{nameOf(state, item.toUserId)}</b><span>{item.message}</span><small>from {nameOf(state, item.fromUserId)} - {item.ts.slice(0, 10)}</small></div>)}</div></section></div>;
}

function Rewards({ state, user, setState }: { state: CrewState; user: Profile; setState: React.Dispatch<React.SetStateAction<CrewState>> }) {
  const now = new Date().toISOString();
  const open = isRedemptionWindowOpen(now);
  return <div className="grid two"><section className="panel card wide"><div className="section-head"><div><h3>Catalog</h3><p className="muted">Redemptions open on Jan 31, Apr 30, Jul 31, and Oct 31. Points roll over.</p></div><span className="pill">${state.walletConfig.rewardDollarPerPoint.toFixed(2)} / point</span></div>{!open && <p className="toast warn">Redemption window closed. Next window: {nextRedemptionWindow(now)}.</p>}<div className="reward-grid">{state.rewards.filter((reward) => reward.active).map((reward) => <div className="reward" key={reward.id}><b>{reward.name}</b><span className="pill">{reward.points} pts</span><small>Implied ${impliedRewardValue(reward.points, state.walletConfig.rewardDollarPerPoint).toLocaleString("en-CA")} {reward.approxValue ? `· catalog ${reward.approxValue}` : ""}</small>{reward.note && <small>{reward.note}</small>}<button disabled={!open || !reward.points || walletBalance(state.pointsEvents, user.id) < reward.points} onClick={() => setState((next) => requestRedemption(next, user.id, reward.id, now))}>Request</button></div>)}</div></section><section className="panel card wide"><div className="section-head"><h3>Redemptions</h3><span className="pill warn">{state.redemptions.filter((item) => item.status === "requested").length} pending</span></div>{state.redemptions.length ? state.redemptions.map((item) => <div className="review-card" key={item.id}><div><b>{nameOf(state, item.userId)} - {rewardName(state, item.rewardId)}</b><small>{item.points} pts - {item.status}</small></div>{item.status === "requested" && canApproveRedemptions(state, user) && <button disabled={!open} onClick={() => setState((next) => approveRedemption(next, item.id, user.id, now))}>Approve redeem</button>}</div>) : <p className="empty-state">No reward requests yet.</p>}</section></div>;
}

function AdminIntake({ state, user, setState }: { state: CrewState; user: Profile; setState: React.Dispatch<React.SetStateAction<CrewState>> }) {
  const [tabName, setTabName] = useState("3. Team Members");
  const [csv, setCsv] = useState("");
  const [report, setReport] = useState("");
  const canEdit = hasRolePermission(state, user, "editConfig");
  const today = new Date().toISOString().slice(0, 10);
  const dueForFullAccess = user.role === "admin" ? newHireReviewsDue(state, today) : [];
  return <div className="grid two">{dueForFullAccess.length > 0 && <section className="panel card wide"><div className="section-head"><div><h3>New hire access reviews</h3><p className="muted">Three days in — grant full access, or leave restricted if it isn't working out.</p></div><span className="pill warn">{dueForFullAccess.length}</span></div>{dueForFullAccess.map((item) => <div className="line-item" key={item.id}><b>{item.name}</b><span className="tiny muted">restricted since {item.newHireUntil}</span><button onClick={() => setState((next) => promoteToFullAccess(next, item.id, user.id))}>Grant full access</button></div>)}</section>}{user.role === "admin" && <section className="panel card wide"><div className="section-head"><div><h3>Team roster status</h3><p className="muted">Mark someone inactive when they leave — their history stays intact, they just drop out of active team views.</p></div></div>{state.users.map((item) => <div className="line-item" key={item.id}><b>{item.name}</b><span className="tiny muted">{item.orgRole}</span><select value={item.status ?? "Active"} onChange={(event) => setState((next) => setEmploymentStatus(next, user.id, item.id, event.target.value as NonNullable<Profile["status"]>))}><option value="Active">Active</option><option value="Inactive">Inactive</option><option value="Leave">Leave</option></select></div>)}</section>}<section className="panel card wide"><div className="section-head"><div><h3>Data intake importer</h3><p className="muted">Paste CSV exported from one workbook tab. Re-run safely; points ledger rows are never imported or overwritten.</p></div><span className={`pill ${canEdit ? "good" : "bad"}`}>{canEdit ? "Admin" : "Read only"}</span></div><p className="toast warn">Confirm before changing suite brand: intake lists {state.config.intakeBrandPrimary} / {state.config.intakeBrandAccent}, app keeps {state.config.officialBrandPrimary} / {state.config.officialBrandAccent}.</p><div className="field-stack"><label>Tab name<select value={tabName} onChange={(event) => setTabName(event.target.value)}>{INTAKE_TAB_NAMES.map((name) => <option key={name}>{name}</option>)}</select></label><textarea value={csv} onChange={(event) => setCsv(event.target.value)} placeholder="Paste CSV rows here, including the header row..." /><button disabled={!canEdit || !csv.trim()} onClick={() => { const result = applyIntakeCsvTabs(state, [{ name: tabName, csv }]); setState(result.state); setReport(`${result.report.imported} imported, ${result.report.skipped.length} skipped. ${result.report.warnings.join(" ")}`); }}>Import tab</button>{report && <p className="toast good">{report}</p>}</div></section><section className="panel card"><h3>Workbook coverage</h3><Metric label="roles" value={state.rolePermissions.length} /><Metric label="cert types" value={state.certificationTypes.length} /><Metric label="forms" value={state.forms.length} /></section><section className="panel card"><h3>Later integrations</h3>{state.integrations.filter((item) => item.needed === "Later").map((item) => <div className="line" key={item.id}><b>{item.name}</b><span className="pill warn">Later</span><small>{item.details}</small></div>)}</section></div>;
}

function LoginScreen({ error, onLogin }: { error: string; onLogin: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  return <div className="login"><section className="panel card"><div className="brand login-brand"><div className="drop logo crew-mark">+</div><div><h1>Crew+</h1><p>Van Isle Water Proofing+</p></div></div><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error && <p className="error">{error}</p>}<button className="primary block" disabled={!email || !password || busy} onClick={() => { setBusy(true); onLogin(email, password).finally(() => setBusy(false)); }}>{busy ? "Signing in..." : "Sign in"}</button></section></div>;
}

function Splash({ text }: { text: string }) {
  return <div className="login"><section className="panel card"><div className="brand login-brand"><div className="drop logo crew-mark">+</div><div><h1>Crew+</h1><p>{text}</p></div></div></section></div>;
}

function Metric({ label, value }: { label: string; value: number | string }) {
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

function nameOf(state: CrewState, userId: string) {
  return state.users.find((user) => user.id === userId)?.name ?? "Team member";
}

function rewardName(state: CrewState, rewardId: string) {
  return state.rewards.find((reward) => reward.id === rewardId)?.name ?? "Reward";
}

type IncidentReportDraft = IncidentReportInput;

function incidentDraft(user: Profile, today: string): IncidentReportDraft {
  return {
    employeeName: user.name,
    employeeRole: user.orgRole,
    employeePhone: user.phone ?? "",
    location: "",
    dateOfIncident: today,
    timeOfIncident: "",
    incidentCause: "",
    incidentDetails: "",
    actionTaken: "",
    policeNotified: false,
    followUpRequired: "",
    photoFileNames: [],
    reportedByUserId: user.id,
    reportedByName: user.name,
    reportedByRole: user.orgRole,
    reportedByPhone: user.phone ?? "",
  };
}

function canConfirmIncidentReceipt(user: Profile) {
  return ["Crew Lead", "CEO / Owner", "CEO"].includes(user.orgRole);
}

function toneForCert(level: string) {
  if (level === "red") return "bad";
  if (level === "amber") return "warn";
  return "good";
}
