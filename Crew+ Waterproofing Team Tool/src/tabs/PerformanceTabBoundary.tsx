import { useState } from "react";
import { averageQuarterlyRating, awardKpiHit, bonusAdminReviewNoticeActive, bonusEmployeeNoticeActive, bonusPercentForAverage, bonusTrajectory, canRunReviews, canSeeBonusDollars, cashoutPromptActive, cashoutReward, completeQuarterlyReview, completeReview, completeRitual, confirmCustomerReview, employeeReviewSubmission, estimatedBonusDollars, giveRecognition, impliedRewardValue, JOB_RESPONSIBILITY_ITEMS, KPI_REVIEW_ITEMS, leaderboard, nextQuarterDeadline, nextRedemptionWindow, OVERALL_RATING_LABELS, quarterlyLeaderboard, quarterKey, canAwardKpiHit, kpiHitFor, ritualPeriodKey, shouldAward, requestCashout, rulePoints, setCompensation, submitFeedback, submitQuarterlyReviewAnswers, submitQuarterlySwot, walletBalance, wordCount } from "../domain/crew";
import type { Cadence, CrewState, Profile, QuarterlyReviewDetail, Review, ReviewRating } from "../types";
import { useToast } from "../components/Toast";
import { nameOf, Metric } from "../App";

type PerformanceTab = "wallet" | "rituals" | "reviews" | "forms" | "bonus" | "feedback";

export default function PerformanceTabBoundary({ activeTab, state, user, setState }: { activeTab: PerformanceTab; state: CrewState; user: Profile; setState: React.Dispatch<React.SetStateAction<CrewState>> }) {
  if (activeTab === "wallet") return <Wallet state={state} user={user} setState={setState} />;
  if (activeTab === "rituals") return <Rituals state={state} user={user} setState={setState} />;
  if (activeTab === "reviews") return <Reviews state={state} user={user} setState={setState} />;
  if (activeTab === "forms") return <Forms state={state} user={user} setState={setState} />;
  if (activeTab === "bonus") return <Bonus state={state} user={user} setState={setState} />;
  return <Feedback state={state} user={user} setState={setState} />;
}

function Wallet({ state, user, setState }: { state: CrewState; user: Profile; setState: React.Dispatch<React.SetStateAction<CrewState>> }) {
  const { showToast } = useToast();
  const quarter = quarterlyLeaderboard(state.pointsEvents, state.users, quarterKey());
  const now = new Date().toISOString();
  const balance = walletBalance(state.pointsEvents, user.id);
  const showCashoutPrompt = cashoutPromptActive(state, user.id, now);
  const dollarValue = impliedRewardValue(balance, state.walletConfig.rewardDollarPerPoint);
  const cashReward = cashoutReward(state);
  const pendingCashout = state.redemptions.find((item) => item.userId === user.id && item.rewardId === cashReward?.id && item.status === "requested");
  return <div className="grid two">
    {showCashoutPrompt && <section className="panel card wide hero-panel"><h3>You can cash out your rewards next payroll</h3><p>{balance} points is worth ${dollarValue.toLocaleString("en-CA")}. Requesting it now sends the total to admin for your next payroll as a bonus.</p><button className="primary" onClick={() => { setState((next) => requestCashout(next, user.id, now)); showToast("Cash-out requested — you'll see it on your next payroll"); }}>Request payout</button></section>}
    {pendingCashout && <section className="panel card wide"><p className="toast good">Cash-out requested for {pendingCashout.points} pts (${impliedRewardValue(pendingCashout.points, state.walletConfig.rewardDollarPerPoint).toLocaleString("en-CA")}) on {pendingCashout.requestedAt.slice(0, 10)}. Admin has been notified for next payroll.</p></section>}
    {!showCashoutPrompt && !pendingCashout && <p className="tiny muted">Points cash-out opens quarterly (next window {nextRedemptionWindow(now)}).</p>}
    <section className="panel card"><h3>One balance</h3><div className="wallet-grid"><div className="wallet-tile"><strong>{balance}</strong><span>Wallet balance</span></div><div className="wallet-tile"><strong>${state.walletConfig.rewardDollarPerPoint.toFixed(2)}</strong><span>per point anchor</span></div></div></section><section className="panel card"><h3>Company leaderboard</h3>{leaderboard(state).map((row, index) => <div className="lb" key={row.user.id}><b>{index + 1}. {row.user.name}</b><span className="pill">{row.balance} pts</span></div>)}</section><section className="panel card"><h3>Quarter leaderboard</h3><p className="muted">Quarterly race resets; wallet balance carries over.</p>{quarter.slice(0, 5).map((row, index) => <div className="lb" key={row.user.id}><b>{index + 1}. {row.user.name}</b><span className="pill">{row.balance} pts</span></div>)}</section><section className="panel card wide"><h3>Ledger</h3><div className="ledger-list">{[...state.pointsEvents].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 12).map((event) => <div className="line" key={event.id}><b>{event.points > 0 ? "+" : ""}{event.points}</b><span>{event.reason}</span><small>{event.type} - {event.ts.slice(0, 10)}</small></div>)}</div></section>
  </div>;
}

function Rituals({ state, user, setState }: { state: CrewState; user: Profile; setState: React.Dispatch<React.SetStateAction<CrewState>> }) {
  const { showToast } = useToast();
  const pointsFor = (cadence: "daily" | "weekly" | "monthly") => rulePoints(state, cadence === "daily" ? "earn-daily" : cadence === "weekly" ? "earn-weekly" : "earn-monthly", 5);
  // Daily and monthly rituals have prompts in crew_value_ritual and their own
  // earning rules, but only the weekly one was ever rendered, so two thirds of the
  // ritual points were unreachable. A cadence is shown when it has a prompt.
  const cadences: { key: Cadence; label: string; prompt: (value: CrewState["values"][number]) => string }[] = [
    { key: "daily", label: "Daily", prompt: (value) => value.dailyRitual },
    { key: "weekly", label: "Weekly", prompt: (value) => value.weeklyRitual },
    { key: "monthly", label: "Monthly", prompt: (value) => value.monthlyRitual },
  ];
  const complete = (valueId: string, cadence: Cadence) => {
    const periodKey = ritualPeriodKey(cadence);
    const ref = `ritual:${user.id}:${valueId}:${cadence}:${periodKey}`;
    // completeRitual returns the state untouched when this period is already
    // claimed. Without this check the button just went dead and said nothing.
    if (!shouldAward(state.pointsEvents, ref, "crew_habit_ritual")) {
      showToast("Already completed for this period — it opens again next time round.", "warn");
      return;
    }
    setState((next) => completeRitual(next, user.id, valueId, cadence, periodKey));
    showToast(`Nice work. +${pointsFor(cadence)} points.`);
  };
  return <div className="library">{state.values.map((value) => <section className="panel card" key={value.id}><div className="section-head"><div><h3>{value.name}</h3><p>{value.wording}</p></div><span className="pill">Value</span></div>
    {cadences.filter((cadence) => cadence.prompt(value)).map((cadence) => {
      const done = !shouldAward(state.pointsEvents, `ritual:${user.id}:${value.id}:${cadence.key}:${ritualPeriodKey(cadence.key)}`, "crew_habit_ritual");
      return <div className="ritual" key={cadence.key}><b>{cadence.label}</b><span>{cadence.prompt(value)}</span>
        {done ? <span className="pill good">Done</span> : <button onClick={() => complete(value.id, cadence.key)}>Complete +{pointsFor(cadence.key)}</button>}
      </div>;
    })}
  </section>)}</div>;
}

function Reviews({ state, user, setState }: { state: CrewState; user: Profile; setState: React.Dispatch<React.SetStateAction<CrewState>> }) {
  const visible = canRunReviews(state, user) ? state.reviews : state.reviews.filter((review) => review.userId === user.id);
  const crewScale = user.branch === "field";
  const { showToast } = useToast();
  const [openReviewId, setOpenReviewId] = useState<string | null>(null);
  const [draftRatings, setDraftRatings] = useState<Record<string, Partial<Review["ratings"]>>>({});
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
      {review.status !== "completed" && !isQuarterly && canManage && (() => {
        // Every non-quarterly review used to be filed as "meets"/3 no matter what
        // the manager thought - there was no control to say otherwise.
        const subjectScale = state.users.find((item) => item.id === review.userId)?.branch === "field";
        const options: ReviewRating[] = subjectScale ? ["below", "meets", "exceeds"] : [1, 2, 3, 4, 5];
        const draft = draftRatings[review.id] ?? {};
        const axes: { key: keyof Review["ratings"]; label: string }[] = [
          { key: "responsibilities", label: "Responsibilities" },
          { key: "values", label: "Values" },
          { key: "kpis", label: "KPIs" },
        ];
        const ready = axes.every((axis) => draft[axis.key] !== undefined);
        return <div className="review-rate">
          {axes.map((axis) => <div className="ritual" key={axis.key}>
            <b>{axis.label}</b>
            <div className="seg review-scale">{options.map((option) => <button key={String(option)} className={draft[axis.key] === option ? "on" : ""} aria-pressed={draft[axis.key] === option}
              onClick={() => setDraftRatings((current) => ({ ...current, [review.id]: { ...current[review.id], [axis.key]: option } }))}>{typeof option === "string" ? option[0].toUpperCase() + option.slice(1) : option}</button>)}</div>
          </div>)}
          <button disabled={!ready} onClick={() => { setState((next) => completeReview(next, review.id, draft as Review["ratings"])); showToast("Review completed."); }}>Complete +{rulePoints(state, "earn-review", 5)}</button>
          {!ready && <p className="tiny muted">Rate all three to complete this review.</p>}
        </div>;
      })()}
    </div>;
  })}</section>
  {openReview && openReview.userId === user.id && !employeeReviewSubmission(state, openReview) && <QuarterlyReviewEmployeeForm state={state} user={user} review={openReview} setState={setState} onDone={() => setOpenReviewId(null)} />}
  {openReview && canManage && openReview.status !== "completed" && employeeReviewSubmission(state, openReview) && <QuarterlyReviewManagerForm state={state} manager={user} review={openReview} setState={setState} onDone={() => setOpenReviewId(null)} />}
  <section className="panel card"><h3>{crewScale ? "Crew scale" : "Office scale"}</h3><div className="seg review-scale" role="img" aria-label={crewScale ? "Rating scale: Below, Meets, Exceeds" : "Rating scale: 1 to 5"}>{(crewScale ? ["Below", "Meets", "Exceeds"] : ["1", "2", "3", "4", "5"]).map((label) => <span key={label}>{label}</span>)}</div><p className="muted">Crew reviews use Below, Meets, and Exceeds. Office roles may use the optional 1-5 scale.</p></section><section className="panel card wide"><div className="section-head"><h3>KPIs</h3><span className="pill">{user.orgRole}</span></div>{state.kpis.filter((kpi) => kpi.role === user.orgRole).map((kpi) => {
    // The row used to render "Mark hit" unconditionally: it never showed whether
    // the KPI had been hit, so a successful click looked identical to no click at
    // all, before and after a reload. And crew saw a button the award function
    // refuses, which saved the result row and then rejected the points with 403.
    const hit = kpiHitFor(state, user.id, kpi.id, quarterKey());
    return <div className="line" key={kpi.id}><b>{kpi.name}</b><span>{kpi.target || "Target TBD"}</span>
      {hit ? <span className="pill good">Hit</span>
        : canAwardKpiHit(user) ? <button onClick={() => { setState((next) => awardKpiHit(next, user.id, kpi.id, quarterKey())); showToast(`KPI marked hit. +${rulePoints(state, "earn-kpi", 5)} points.`); }}>Mark hit +{rulePoints(state, "earn-kpi", 5)}</button>
        : <span className="pill">Not yet</span>}
    </div>;
  })}</section><section className="panel card wide"><h3>Between-review notes</h3>{state.reviewNotes.length ? state.reviewNotes.map((note) => <div className="line" key={note.id}><b>{nameOf(state, note.userId)}</b><span>{note.note}</span><small>{note.ts.slice(0, 10)}</small></div>) : <p className="empty-state">No lightweight notes yet.</p>}</section></div>;
}

function QuarterlyReviewEmployeeForm({ state, user, review, setState, onDone }: { state: CrewState; user: Profile; review: Review; setState: React.Dispatch<React.SetStateAction<CrewState>>; onDone: () => void }) {
  const { showToast } = useToast();
  const form = state.forms.find((item) => item.id === "form-quarterly-scorecard");
  const questions = state.formQuestions.filter((item) => item.formId === form?.id).sort((a, b) => a.order - b.order);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const valid = questions.every((question) => !question.required || Boolean(responses[question.id]?.trim()));
  const submit = () => { setState((next) => submitQuarterlyReviewAnswers(next, user.id, review.id, responses)); showToast("Self-assessment submitted"); onDone(); };
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
  const { showToast } = useToast();
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
    showToast("Quarterly review completed");
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
  const { showToast } = useToast();
  const form = state.forms.find((item) => item.id === "form-swot");
  const questions = state.formQuestions.filter((item) => item.formId === form?.id).sort((a, b) => a.order - b.order);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const deadline = nextQuarterDeadline(new Date().toISOString().slice(0, 10));
  const existing = state.formSubmissions.find((item) => item.formId === form?.id && item.userId === user.id && item.periodKey === deadline);
  const valid = questions.every((question) => {
    const response = responses[question.id] ?? "";
    return (!question.required || Boolean(response.trim())) && (!question.wordLimit || wordCount(response) <= question.wordLimit);
  });
  return <div className="grid two"><section className="panel card wide"><div className="section-head"><div><h3>{form?.name ?? "Quarterly SWOT"}</h3><p className="muted">{form?.description}</p></div><div className="form-status"><span className="pill">Due {deadline}</span><span className={`pill ${existing ? "good" : "warn"}`}>{existing ? "Submitted" : "Open"}</span></div></div>{existing ? <div className="empty-state">Submitted {existing.submittedAt.slice(0, 10)}. Your next form opens for the following quarter.</div> : <div className="swot-grid">{questions.map((question) => { const value = responses[question.id] ?? ""; const count = wordCount(value); return <label key={question.id}>{question.question}<textarea value={value} onChange={(event) => setResponses((current) => ({ ...current, [question.id]: event.target.value }))} placeholder={`Describe ${question.question.toLowerCase()}...`} /><small className={question.wordLimit && count > question.wordLimit ? "error" : ""}>{count} / {question.wordLimit ?? 500} words</small></label>; })}</div>} {!existing && <button className="primary block" disabled={!valid} onClick={() => { setState((next) => submitQuarterlySwot(next, user.id, responses)); showToast("Quarterly SWOT submitted"); }}>Submit SWOT +{rulePoints(state, "earn-swot", 5)}</button>}</section><section className="panel card wide"><h3>Quarterly deadlines</h3><div className="deadline-grid">{["March 31", "June 30", "September 30", "December 31"].map((date) => <span className="pill" key={date}>{date}</span>)}</div></section></div>;
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
  return <div className="grid two">{showAdminBonusNotice && <p className="toast warn">Performance reviews for qualifying employees should be completed before November 30.</p>}{showEmployeeBonusNotice && <p className="toast good">Your performance will be reviewed and scored for the bonus program this November.</p>}<section className="panel card hero-panel"><h3>{trajectory.toUpperCase()}</h3><p>Trajectory only. Bonus dollars stay admin/CFO-only.</p><div className="facts"><span>{state.bonusPeriods[0]?.year ?? 2026} period</span><span>{Math.round(percent * 100)}% cap</span></div></section>{canManageComp && <section className="panel card"><h3>Compensation (admin/HR only)</h3><div className="field-stack"><p className="muted">{state.bonusConfig.floorsCaps}</p><p className="muted">{state.bonusConfig.reviewAverageSource}</p><label>Gross annual wages<input value={comp?.grossAnnualWages ?? ""} placeholder="Pending client confirmation" onChange={(event) => updateComp({ grossAnnualWages: Number(event.target.value) || undefined })} /></label><label>Starting hourly wage<input value={comp?.startingHourlyWage ?? ""} placeholder="$/hour when hired" onChange={(event) => updateComp({ startingHourlyWage: Number(event.target.value) || undefined })} /></label><label>Last increase date<input type="date" value={comp?.lastIncreaseDate ?? ""} onChange={(event) => updateComp({ lastIncreaseDate: event.target.value || undefined })} /></label><label>Last increase — new hourly wage<input value={comp?.lastIncreaseHourlyWage ?? ""} placeholder="$/hour after the raise" onChange={(event) => updateComp({ lastIncreaseHourlyWage: Number(event.target.value) || undefined })} /></label><label>Retention bonus amount<input value={comp?.retentionBonusAmount ?? ""} onChange={(event) => updateComp({ retentionBonusAmount: Number(event.target.value) || undefined })} /></label><label>Retention bonus pay-out date<input type="date" value={comp?.retentionBonusPayoutDate ?? ""} onChange={(event) => updateComp({ retentionBonusPayoutDate: event.target.value || undefined })} /></label><label>Cost of living increase<input value={comp?.costOfLivingIncrease ?? ""} onChange={(event) => updateComp({ costOfLivingIncrease: Number(event.target.value) || undefined })} /></label></div></section>}<section className="panel card wide"><div className="section-head"><h3>Dollar privacy</h3><span className="pill">{dollarsVisible ? "Admin/CFO" : "Private"}</span></div>{dollarsVisible ? <Metric label="Estimated share" value={`$${estimatedBonusDollars(state, user).toLocaleString("en-CA")}`} /> : <p className="empty-state">Your trajectory is visible, but bonus dollar amounts are admin/CFO-only.</p>}</section></div>;
}

function Feedback({ state, user, setState }: { state: CrewState; user: Profile; setState: React.Dispatch<React.SetStateAction<CrewState>> }) {
  const { showToast } = useToast();
  // These were a single `message` shared by both textareas, so typing company
  // feedback also filled the peer recognition box and vice versa.
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [peerMessage, setPeerMessage] = useState("");
  const [peerId, setPeerId] = useState(state.users.find((item) => item.id !== user.id)?.id ?? user.id);
  const [customer, setCustomer] = useState("");
  const isAdmin = user.role === "admin";
  return <div className="grid two"><section className="panel card"><h3>Company feedback</h3><div className="feedback-form"><textarea value={feedbackMessage} onChange={(event) => setFeedbackMessage(event.target.value)} placeholder="What should we improve?" /><button disabled={!feedbackMessage.trim()} onClick={() => { setState((next) => submitFeedback(next, user.id, feedbackMessage)); setFeedbackMessage(""); showToast("Thanks - that's gone to the admin team."); }}>Submit +{rulePoints(state, "earn-feedback", 5)}</button></div></section><section className="panel card"><h3>Peer recognition</h3><div className="feedback-form"><select value={peerId} onChange={(event) => setPeerId(event.target.value)}>{state.users.filter((item) => item.id !== user.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><textarea value={peerMessage} onChange={(event) => setPeerMessage(event.target.value)} placeholder="What did they do?" /><button disabled={!peerMessage.trim()} onClick={() => { setState((next) => giveRecognition(next, user.id, peerId, peerMessage)); setPeerMessage(""); showToast("Sent."); }}>Send +{rulePoints(state, "earn-peer", 5)} to them</button></div></section><section className="panel card wide"><div className="section-head"><div><h3>Customer review QR / manual confirm</h3><p className="muted">Share {user.name}'s review link with the customer, then confirm after the review names them.</p></div><span className="pill good">Manual</span></div><div className="field-stack"><a className="button-link" href={state.config.googleReviewUrl} target="_blank" rel="noreferrer">Open {user.name}'s Google review link</a><input value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder="Customer or job name" /><div className="step-actions"><button disabled={!customer.trim()} onClick={() => { setState((next) => confirmCustomerReview(next, user.id, "google_5_star", customer)); setCustomer(""); }}>Confirm 5-star +{rulePoints(state, "earn-google", 200)}</button><button disabled={!customer.trim()} onClick={() => { setState((next) => confirmCustomerReview(next, user.id, "written_compliment", customer)); setCustomer(""); }}>Written compliment +{rulePoints(state, "earn-compliment", 5)}</button></div></div></section><section className="panel card wide"><div className="section-head"><div><h3>{isAdmin ? "Company feedback received" : "Your feedback"}</h3><p className="muted">{isAdmin ? "Everything submitted through the box above." : "Only you and the admin team can see what you sent."}</p></div><span className="pill">{isAdmin ? "Admin" : "Private"}</span></div><div className="feed-list">{state.feedbackEntries.length ? state.feedbackEntries.map((item) => <div className="line" key={item.id}><b>{isAdmin ? nameOf(state, item.userId) : "You"}</b><span>{item.message}</span><small>{item.ts.slice(0, 10)}</small></div>) : <p className="empty-state">No feedback submitted yet.</p>}</div></section><section className="panel card wide"><h3>Recognition feed</h3><div className="feed-list">{state.recognitions.map((item) => <div className="line" key={item.id}><b>{nameOf(state, item.toUserId)}</b><span>{item.message}</span><small>from {nameOf(state, item.fromUserId)} - {item.ts.slice(0, 10)}</small></div>)}</div></section></div>;
}
