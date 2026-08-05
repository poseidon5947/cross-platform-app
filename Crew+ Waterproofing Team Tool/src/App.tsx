import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createSeedState } from "./data/seed";
import { applyIntakeCsvTabs } from "./data/intakeImport";
import { getCurrentSession, loadRemoteState, signInWithPassword, signOut } from "./data/repo";
import { acknowledgePolicy, approveRedemption, awardCertDetail, awardCertsCurrent, awardKpiHit, bonusPercentForAverage, bonusTrajectory, canApproveRedemptions, canRunReviews, canSeeBonusDollars, certAlertLevelFromType, completeReview, completeRitual, confirmCustomerReview, estimatedBonusDollars, giveRecognition, hasRolePermission, impliedRewardValue, isRedemptionWindowOpen, averageQuarterlyRating, leaderboard, nextQuarterDeadline, nextRedemptionWindow, policyDueDate, quarterlyLeaderboard, recordTimeOff, requestRedemption, rulePoints, submitFeedback, submitQuarterlySwot, timeOffSummary, vacationReminderText, walletBalance, wordCount } from "./domain/crew";
import type { Certification, CrewState, Profile, ReviewRating, TimeOffKind } from "./types";
import { isSupabaseConfigured } from "./integrations/supabase";

const STORAGE_KEY = "crew-plus-state-v1";
const REMOTE_MODE = isSupabaseConfigured();
const DEMO_PICKER = !REMOTE_MODE || import.meta.env.VITE_DEMO_MODE === "true";
type Tab = "home" | "profile" | "wallet" | "rituals" | "reviews" | "forms" | "timeoff" | "bonus" | "certs" | "rewards" | "feedback" | "admin";
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
  const balance = walletBalance(state.pointsEvents, currentUser.id);
  const certsVisibleToUser = currentUser.role === "admin" || currentUser.role === "manager" ? state.certifications : state.certifications.filter((cert) => cert.userId === currentUser.id);
  const certAlerts = certsVisibleToUser.filter((cert) => certAlertLevelFromType(cert, state.certificationTypes?.find((type) => type.id === cert.certTypeId), new Date().toISOString().slice(0, 10)) !== "green");
  const pendingRedemptions = state.redemptions.filter((item) => item.status === "requested").length;

  return (
    <div className="shell app">
      <aside className="rail">
        <div className="brand">
          <div className="drop logo crew-mark">+</div>
          <div><h1>Crew+</h1><p>People & Performance</p></div>
        </div>
        <nav>
          {(["home", "profile", "wallet", "rituals", "reviews", "forms", "timeoff", "bonus", "certs", "rewards", "feedback", "admin"] as const).map((item) => (
            <button key={item} className={tab === item ? "on" : ""} onClick={() => setTab(item)}><span className="nav-label">{titleFor(item)}</span>{item === "rewards" && pendingRedemptions ? <span className="nav-count">{pendingRedemptions}</span> : null}</button>
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
          <div><h2>{titleFor(tab)}</h2><p>One wallet, one leaderboard, values, reviews, bonus trajectory, and compliance.</p></div>
          <div className="top-actions">
            {remote.error && <span className="chip warn">{remote.error}</span>}
            {(!currentUser.address?.trim() || !currentUser.emergencyContactName?.trim() || !currentUser.emergencyContactPhone?.trim()) && <button onClick={() => setTab("profile")}>Complete profile</button>}
            <span className="chip good">{balance} pts</span>
            <span className="chip warn">{certAlerts.length} compliance flags</span>
          </div>
        </header>

        {tab === "home" && <Home state={state} user={currentUser} setTab={setTab} />}
        {tab === "profile" && <ProfileScreen state={state} user={currentUser} setState={setState} />}
        {tab === "wallet" && <Wallet state={state} user={currentUser} />}
        {tab === "rituals" && <Rituals state={state} user={currentUser} setState={setState} />}
        {tab === "reviews" && <Reviews state={state} user={currentUser} setState={setState} />}
        {tab === "forms" && <Forms state={state} user={currentUser} setState={setState} />}
        {tab === "timeoff" && <TimeOff state={state} user={currentUser} setState={setState} />}
        {tab === "bonus" && <Bonus state={state} user={currentUser} setState={setState} />}
        {tab === "certs" && <Compliance state={state} user={currentUser} setState={setState} />}
        {tab === "rewards" && <Rewards state={state} user={currentUser} setState={setState} />}
        {tab === "feedback" && <Feedback state={state} user={currentUser} setState={setState} />}
        {tab === "admin" && <AdminIntake state={state} user={currentUser} setState={setState} />}
      </main>

      <footer className="mobile-nav">
        {(["home", "profile", "timeoff", "forms", "certs"] as const).map((item) => <button key={item} className={tab === item ? "on" : ""} onClick={() => setTab(item)}>{titleFor(item)}</button>)}
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

  const setState: React.Dispatch<React.SetStateAction<CrewState>> = () => setError("Remote writes use Edge Functions/RPC in production; demo edits stay local.");

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
  return <div className="grid two"><section className="panel card"><div className="section-head"><div><h3>My details</h3><p className="muted">Keep your current address and contact details up to date.</p></div><span className={`pill ${complete ? "good" : "warn"}`}>{complete ? "Complete" : "Action needed"}</span></div><div className="field-stack"><label>Address<textarea value={user.address ?? ""} onChange={(event) => update({ address: event.target.value })} placeholder="Current home address" /></label><label>Phone<input type="tel" value={user.phone ?? ""} onChange={(event) => update({ phone: event.target.value })} /></label><label>Email<input type="email" value={user.email ?? ""} onChange={(event) => update({ email: event.target.value })} /></label></div></section><section className="panel card"><h3>Emergency contact</h3><div className="field-stack"><label>Name<input value={user.emergencyContactName ?? ""} onChange={(event) => update({ emergencyContactName: event.target.value })} /></label><label>Phone<input type="tel" value={user.emergencyContactPhone ?? ""} onChange={(event) => update({ emergencyContactPhone: event.target.value })} /></label><label>Email<input type="email" value={user.emergencyContactEmail ?? ""} onChange={(event) => update({ emergencyContactEmail: event.target.value })} /></label></div></section></div>;
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
  return <div className="grid two"><section className="panel card wide"><div className="section-head"><h3>Review cadence</h3><span className="pill">{visible.length} visible</span></div>{visible.map((review) => <div className="review-card" key={review.id}><div><b>{nameOf(state, review.userId)} - {review.type}</b><small>{review.scheduledFor} - {review.status}</small></div>{review.status !== "completed" && canRunReviews(state, user) && <button onClick={() => setState((next) => { const subject = next.users.find((item) => item.id === review.userId); const ratings = subject?.branch === "field" ? { responsibilities: "meets" as const, values: "meets" as const, kpis: "meets" as const } : { responsibilities: 3 as const, values: 3 as const, kpis: 3 as const }; return completeReview(next, review.id, ratings); })}>Complete +{rulePoints(state, "earn-review", 5)}</button>}</div>)}</section><section className="panel card"><h3>{crewScale ? "Crew scale" : "Office scale"}</h3>{crewScale ? <div className="seg review-scale"><button>Below</button><button className="on">Meets</button><button>Exceeds</button></div> : <div className="seg review-scale"><button>1</button><button>2</button><button className="on">3</button><button>4</button><button>5</button></div>}<p className="muted">Crew reviews use Below, Meets, and Exceeds. Office roles may use the optional 1-5 scale.</p></section><section className="panel card wide"><div className="section-head"><h3>KPIs</h3><span className="pill">{user.orgRole}</span></div>{state.kpis.filter((kpi) => kpi.role === user.orgRole).map((kpi) => <div className="line" key={kpi.id}><b>{kpi.name}</b><span>{kpi.target || "Target TBD"}</span><button onClick={() => setState((next) => awardKpiHit(next, user.id, kpi.id, "2026-Q3"))}>Mark hit +{rulePoints(state, "earn-kpi", 5)}</button></div>)}</section><section className="panel card wide"><h3>Between-review notes</h3>{state.reviewNotes.length ? state.reviewNotes.map((note) => <div className="line" key={note.id}><b>{nameOf(state, note.userId)}</b><span>{note.note}</span><small>{note.ts.slice(0, 10)}</small></div>) : <p className="empty-state">No lightweight notes yet.</p>}</section></div>;
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
  const visibleUsers = canViewTeam ? state.users.filter((item) => item.branch === "field") : [user];
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

function Bonus({ state, user, setState }: { state: CrewState; user: Profile; setState: React.Dispatch<React.SetStateAction<CrewState>> }) {
  const dollarsVisible = canSeeBonusDollars(state, user);
  const ratings = state.reviews.filter((review) => review.userId === user.id && review.status === "completed").flatMap((review) => Object.values(review.ratings).filter(Boolean) as ReviewRating[]);
  const trajectory = bonusTrajectory(ratings);
  const average = averageQuarterlyRating(state, user.id, state.bonusPeriods[0]?.year ?? 2026);
  const percent = bonusPercentForAverage(average);
  return <div className="grid two"><section className="panel card hero-panel"><h3>{trajectory.toUpperCase()}</h3><p>Trajectory only. Bonus dollars stay admin/CFO-only.</p><div className="facts"><span>{state.bonusPeriods[0]?.year ?? 2026} period</span><span>{Math.round(percent * 100)}% cap</span></div></section><section className="panel card"><h3>Bonus model</h3><div className="field-stack"><p className="muted">{state.bonusConfig.floorsCaps}</p><p className="muted">{state.bonusConfig.reviewAverageSource}</p><label>Gross annual wages<input value={user.grossAnnualWages ?? ""} placeholder="Pending client confirmation" onChange={(event) => setState((next) => ({ ...next, users: next.users.map((item) => item.id === user.id ? { ...item, grossAnnualWages: Number(event.target.value) || undefined } : item) }))} /></label></div></section><section className="panel card wide"><div className="section-head"><h3>Dollar privacy</h3><span className="pill">{dollarsVisible ? "Admin/CFO" : "Private"}</span></div>{dollarsVisible ? <Metric label="Estimated share" value={`$${estimatedBonusDollars(state, user).toLocaleString("en-CA")}`} /> : <p className="empty-state">Your trajectory is visible, but bonus dollar amounts are admin/CFO-only.</p>}</section></div>;
}

function Compliance({ state, user, setState }: { state: CrewState; user: Profile; setState: React.Dispatch<React.SetStateAction<CrewState>> }) {
  const canViewTeam = user.role === "admin" || user.role === "manager" || canRunReviews(state, user);
  const visibleUsers = canViewTeam ? state.users.filter((item) => item.branch === "field") : [user];
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
  return <div className="grid two"><section className="panel card wide"><div className="section-head"><div><h3>Data intake importer</h3><p className="muted">Paste CSV exported from one workbook tab. Re-run safely; points ledger rows are never imported or overwritten.</p></div><span className={`pill ${canEdit ? "good" : "bad"}`}>{canEdit ? "Admin" : "Read only"}</span></div><p className="toast warn">Confirm before changing suite brand: intake lists {state.config.intakeBrandPrimary} / {state.config.intakeBrandAccent}, app keeps {state.config.officialBrandPrimary} / {state.config.officialBrandAccent}.</p><div className="field-stack"><label>Tab name<select value={tabName} onChange={(event) => setTabName(event.target.value)}>{INTAKE_TAB_NAMES.map((name) => <option key={name}>{name}</option>)}</select></label><textarea value={csv} onChange={(event) => setCsv(event.target.value)} placeholder="Paste CSV rows here, including the header row..." /><button disabled={!canEdit || !csv.trim()} onClick={() => { const result = applyIntakeCsvTabs(state, [{ name: tabName, csv }]); setState(result.state); setReport(`${result.report.imported} imported, ${result.report.skipped.length} skipped. ${result.report.warnings.join(" ")}`); }}>Import tab</button>{report && <p className="toast good">{report}</p>}</div></section><section className="panel card"><h3>Workbook coverage</h3><Metric label="roles" value={state.rolePermissions.length} /><Metric label="cert types" value={state.certificationTypes.length} /><Metric label="forms" value={state.forms.length} /></section><section className="panel card"><h3>Later integrations</h3>{state.integrations.filter((item) => item.needed === "Later").map((item) => <div className="line" key={item.id}><b>{item.name}</b><span className="pill warn">Later</span><small>{item.details}</small></div>)}</section></div>;
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
    integrations: state.integrations ?? defaults.integrations,
    permissions: { ...defaults.permissions, ...(state.permissions ?? {}) },
    walletConfig: { ...defaults.walletConfig, ...(state.walletConfig ?? {}) },
  };
}

function titleFor(tab: string) {
  if (tab === "home") return "Home";
  if (tab === "timeoff") return "Time Off";
  return tab[0].toUpperCase() + tab.slice(1);
}

function nameOf(state: CrewState, userId: string) {
  return state.users.find((user) => user.id === userId)?.name ?? "Team member";
}

function rewardName(state: CrewState, rewardId: string) {
  return state.rewards.find((reward) => reward.id === rewardId)?.name ?? "Reward";
}

function toneForCert(level: string) {
  if (level === "red") return "bad";
  if (level === "amber") return "warn";
  return "good";
}
