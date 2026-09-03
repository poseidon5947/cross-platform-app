import { useState } from "react";
import { approveRedemption, canApproveRedemptions, hasRolePermission, impliedRewardValue, isRedemptionWindowOpen, newHireReviewsDue, nextRedemptionWindow, pendingPayrollCashouts, promoteToFullAccess, requestRedemption, rulePoints, setEmploymentStatus, walletBalance } from "../domain/crew";
import { applyIntakeCsvTabs } from "../data/intakeImport";
import type { CrewState, Profile } from "../types";
import { useToast } from "../components/Toast";
import { nameOf, Metric } from "../App";

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

type AdminTab = "rewards" | "admin";

export default function AdminTabBoundary({ activeTab, state, user, setState }: { activeTab: AdminTab; state: CrewState; user: Profile; setState: React.Dispatch<React.SetStateAction<CrewState>> }) {
  if (activeTab === "rewards") return <Rewards state={state} user={user} setState={setState} />;
  return <AdminIntake state={state} user={user} setState={setState} />;
}

function rewardName(state: CrewState, rewardId: string) {
  return state.rewards.find((reward) => reward.id === rewardId)?.name ?? "Reward";
}

function Rewards({ state, user, setState }: { state: CrewState; user: Profile; setState: React.Dispatch<React.SetStateAction<CrewState>> }) {
  const { showToast } = useToast();
  const now = new Date().toISOString();
  const open = isRedemptionWindowOpen(now);
  const cashouts = canApproveRedemptions(state, user) ? pendingPayrollCashouts(state) : [];
  const cashoutTotal = cashouts.reduce((sum, item) => sum + item.dollarValue, 0);
  return <div className="grid two">{cashouts.length > 0 && <section className="panel card wide hero-panel"><div className="section-head"><h3>Payroll cash-outs due</h3><span className="pill">${cashoutTotal.toLocaleString("en-CA")} total</span></div><p>Approve each request below to confirm it for the next payroll run.</p>{cashouts.map(({ redemption, dollarValue }) => <div className="line-item" key={redemption.id}><b>{nameOf(state, redemption.userId)}</b><span className="tiny muted">{redemption.points} pts</span><span className="tiny muted">${dollarValue.toLocaleString("en-CA")}</span></div>)}</section>}<section className="panel card wide"><div className="section-head"><div><h3>Catalog</h3><p className="muted">Redemptions open on Jan 31, Apr 30, Jul 31, and Oct 31. Points roll over.</p></div><span className="pill">${state.walletConfig.rewardDollarPerPoint.toFixed(2)} / point</span></div>{!open && <p className="toast warn">Redemption window closed. Next window: {nextRedemptionWindow(now)}.</p>}<div className="reward-grid">{state.rewards.filter((reward) => reward.active).map((reward) => <div className="reward" key={reward.id}><b>{reward.name}</b><span className="pill">{reward.points} pts</span><small>Implied ${impliedRewardValue(reward.points, state.walletConfig.rewardDollarPerPoint).toLocaleString("en-CA")} {reward.approxValue ? `· catalog ${reward.approxValue}` : ""}</small>{reward.note && <small>{reward.note}</small>}<button disabled={!open || !reward.points || walletBalance(state.pointsEvents, user.id) < reward.points} onClick={() => { setState((next) => requestRedemption(next, user.id, reward.id, now)); showToast("Reward requested"); }}>Request</button></div>)}</div></section><section className="panel card wide"><div className="section-head"><h3>Redemptions</h3><span className="pill warn">{state.redemptions.filter((item) => item.status === "requested").length} pending</span></div>{state.redemptions.length ? state.redemptions.map((item) => <div className="review-card" key={item.id}><div><b>{nameOf(state, item.userId)} - {rewardName(state, item.rewardId)}</b><small>{item.points} pts - {item.status}</small></div>{item.status === "requested" && canApproveRedemptions(state, user) && <button disabled={!open} onClick={() => { setState((next) => approveRedemption(next, item.id, user.id, now)); showToast("Redemption approved"); }}>Approve redeem</button>}</div>) : <p className="empty-state">No reward requests yet.</p>}</section></div>;
}

function AdminIntake({ state, user, setState }: { state: CrewState; user: Profile; setState: React.Dispatch<React.SetStateAction<CrewState>> }) {
  const [tabName, setTabName] = useState("3. Team Members");
  const [csv, setCsv] = useState("");
  const [report, setReport] = useState("");
  const canEdit = hasRolePermission(state, user, "editConfig");
  const today = new Date().toISOString().slice(0, 10);
  const dueForFullAccess = user.role === "admin" ? newHireReviewsDue(state, today) : [];
  return <div className="grid two">{dueForFullAccess.length > 0 && <section className="panel card wide"><div className="section-head"><div><h3>New hire access reviews</h3><p className="muted">Three days in — grant full access, or leave restricted if it isn't working out.</p></div><span className="pill warn">{dueForFullAccess.length}</span></div>{dueForFullAccess.map((item) => <div className="line-item" key={item.id}><b>{item.name}</b><span className="tiny muted">restricted since {item.newHireUntil}</span><button onClick={() => setState((next) => promoteToFullAccess(next, item.id, user.id))}>Grant full access</button></div>)}</section>}{user.role === "admin" && <section className="panel card wide"><div className="section-head"><div><h3>Team roster status</h3><p className="muted">Mark someone inactive when they leave — their history stays intact, they just drop out of active team views.</p></div></div>{state.users.map((item) => <div className="line-item" key={item.id}><b>{item.name}</b><span className="tiny muted">{item.orgRole}</span><select value={item.status === "Inactive" ? `Inactive:${item.terminationReason ?? "terminated"}` : (item.status ?? "Active")} onChange={(event) => { const raw = event.target.value; if (raw.startsWith("Inactive:")) { const reason = raw.split(":")[1] as NonNullable<Profile["terminationReason"]>; setState((next) => setEmploymentStatus(next, user.id, item.id, "Inactive", reason)); } else { setState((next) => setEmploymentStatus(next, user.id, item.id, raw as NonNullable<Profile["status"]>)); } }}><option value="Active">Active</option><option value="Inactive:voluntary">Inactive (quit)</option><option value="Inactive:terminated">Inactive (terminated)</option><option value="Leave">Leave</option></select></div>)}</section>}<section className="panel card wide"><div className="section-head"><div><h3>Data intake importer</h3><p className="muted">Paste CSV exported from one workbook tab. Re-run safely; points ledger rows are never imported or overwritten.</p></div><span className={`pill ${canEdit ? "good" : "bad"}`}>{canEdit ? "Admin" : "Read only"}</span></div><p className="toast warn">Confirm before changing suite brand: intake lists {state.config.intakeBrandPrimary} / {state.config.intakeBrandAccent}, app keeps {state.config.officialBrandPrimary} / {state.config.officialBrandAccent}.</p><div className="field-stack"><label>Tab name<select value={tabName} onChange={(event) => setTabName(event.target.value)}>{INTAKE_TAB_NAMES.map((name) => <option key={name}>{name}</option>)}</select></label><textarea value={csv} onChange={(event) => setCsv(event.target.value)} placeholder="Paste CSV rows here, including the header row..." /><button disabled={!canEdit || !csv.trim()} onClick={() => { const result = applyIntakeCsvTabs(state, [{ name: tabName, csv }]); setState(result.state); setReport(`${result.report.imported} imported, ${result.report.skipped.length} skipped. ${result.report.warnings.join(" ")}`); }}>Import tab</button>{report && <p className="toast good">{report}</p>}</div></section><section className="panel card"><h3>Workbook coverage</h3><Metric label="roles" value={state.rolePermissions.length} /><Metric label="cert types" value={state.certificationTypes.length} /><Metric label="forms" value={state.forms.length} /></section><section className="panel card"><h3>Later integrations</h3>{state.integrations.filter((item) => item.needed === "Later").map((item) => <div className="line" key={item.id}><b>{item.name}</b><span className="pill warn">Later</span><small>{item.details}</small></div>)}</section></div>;
}
