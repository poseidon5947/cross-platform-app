import { useEffect, useState } from "react";
import { acknowledgePolicy, awardCertDetail, awardCertsCurrent, certAlertLevelFromType, confirmIncidentReceipt, policyDueDate, recordTimeOff, rulePoints, submitIncidentReport, submitOnboarding, timeOffSummary, vacationReminderText } from "../domain/crew";
import { removePushSubscription, savePushSubscription, sendTestPush } from "../data/repo";
import type { Certification, CrewState, IncidentReport, IncidentReportInput, OnboardingInput, Profile, TimeOffKind } from "../types";
import { useToast } from "../components/Toast";
import { nameOf, REMOTE_MODE } from "../App";

type WorkTab = "profile" | "onboarding" | "timeoff" | "incidents" | "certs";

function ImageFilePicker({ accept, value, onChange }: { accept?: string; value?: string; onChange: (file: File | null) => void }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(file && file.type.startsWith("image/") ? URL.createObjectURL(file) : null);
    onChange(file);
  };
  return <div className="file-picker">
    <input type="file" accept={accept} onChange={handleChange} />
    {previewUrl ? <img src={previewUrl} alt="Selected file preview" className="file-preview-thumb" /> : value ? <small className="muted">Selected: {value}</small> : null}
  </div>;
}

export default function WorkTabBoundary({ activeTab, state, user, setState }: { activeTab: WorkTab; state: CrewState; user: Profile; setState: React.Dispatch<React.SetStateAction<CrewState>> }) {
  if (activeTab === "profile") return <ProfileScreen state={state} user={user} setState={setState} />;
  if (activeTab === "onboarding") return <Onboarding state={state} user={user} setState={setState} />;
  if (activeTab === "timeoff") return <TimeOff state={state} user={user} setState={setState} />;
  if (activeTab === "incidents") return <Incidents state={state} user={user} setState={setState} />;
  return <Compliance state={state} user={user} setState={setState} />;
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
  const { showToast } = useToast();
  const canReviewAll = user.role === "admin";
  const own = (state.onboarding ?? []).find((item) => item.userId === user.id);
  const [draft, setDraft] = useState<OnboardingDraft>(onboardingDraft);
  const set = (patch: Partial<OnboardingDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const requiredComplete = Boolean(draft.dateOfBirth && draft.address.trim() && draft.city.trim() && draft.postalCode.trim() && draft.sin.trim() && draft.driversLicenseNumber.trim() && draft.startDate && Number(draft.hourlyWage) > 0 && draft.vacationPayAcknowledged && draft.directDepositSignedName.trim() && draft.hoursTrackingSignedName.trim() && draft.emergencyContactName.trim() && draft.emergencyContactPhone.trim());
  const submit = () => {
    const now = new Date().toISOString();
    setState((next) => submitOnboarding(next, user.id, { ...draft, userId: user.id, hourlyWage: Number(draft.hourlyWage), directDepositSignedAt: now, hoursTrackingSignedAt: now }, now));
    showToast("Onboarding submitted");
  };

  if (own) {
    return <div className="grid two"><section className="panel card"><div className="section-head"><div><h3>Onboarding</h3><p className="muted">Submitted {own.completedAt.slice(0, 10)}. Contact HR to change anything.</p></div><span className="pill good">Complete</span></div></section>{canReviewAll && <OnboardingAdminList state={state} />}</div>;
  }

  return <div className="grid two"><section className="panel card wide onboarding-form"><div className="section-head"><div><h3>New Employee Form</h3><p className="muted">One-time onboarding. Visible only to admin/HR once submitted.</p></div><span className="pill">Admin/HR only</span></div><div className="incident-sections"><fieldset><legend>Contact Information</legend><div className="field-grid"><label>Date of birth<input type="date" value={draft.dateOfBirth} onChange={(event) => set({ dateOfBirth: event.target.value })} /></label><label className="wide-field">Address<input value={draft.address} onChange={(event) => set({ address: event.target.value })} /></label><label>City<input value={draft.city} onChange={(event) => set({ city: event.target.value })} /></label><label>Postal code<input value={draft.postalCode} onChange={(event) => set({ postalCode: event.target.value })} /></label><label>SIN<input value={draft.sin} onChange={(event) => set({ sin: event.target.value })} /></label><label>Driver's license number<input value={draft.driversLicenseNumber} onChange={(event) => set({ driversLicenseNumber: event.target.value })} /></label><label className="wide-field">Allergies / medical conditions<textarea value={draft.allergiesMedical} onChange={(event) => set({ allergiesMedical: event.target.value })} /></label></div></fieldset><fieldset><legend>Employment</legend><div className="field-grid"><label>First day of work<input type="date" value={draft.startDate} onChange={(event) => set({ startDate: event.target.value })} /></label><label>Hourly wage<input type="number" min="0" step="0.01" value={draft.hourlyWage} onChange={(event) => set({ hourlyWage: event.target.value })} /></label></div></fieldset><fieldset><legend>Payroll Details</legend><div className="field-stack"><label className="check"><input type="checkbox" checked={draft.vacationPayAcknowledged} onChange={(event) => set({ vacationPayAcknowledged: event.target.checked })} /> I understand that vacation pay is paid on each paycheck.</label><label>I authorize Van-Isle Coating &amp; Sealants to pay me by direct deposit. Sign here<input value={draft.directDepositSignedName} onChange={(event) => set({ directDepositSignedName: event.target.value })} placeholder="Type your full name to sign" /></label><label>Direct deposit form (from your bank)<ImageFilePicker value={draft.directDepositFileName} onChange={(file) => set({ directDepositFileName: file?.name ?? "" })} /></label><label>I understand that I must track my hours daily by 5pm on the BuilderTrend App. Sign here<input value={draft.hoursTrackingSignedName} onChange={(event) => set({ hoursTrackingSignedName: event.target.value })} placeholder="Type your full name to sign" /></label></div></fieldset><fieldset><legend>Driver's License Photo</legend><div className="field-grid"><label>Front<ImageFilePicker accept="image/*" value={draft.driversLicenseFrontFileName} onChange={(file) => set({ driversLicenseFrontFileName: file?.name ?? "" })} /></label><label>Back<ImageFilePicker accept="image/*" value={draft.driversLicenseBackFileName} onChange={(file) => set({ driversLicenseBackFileName: file?.name ?? "" })} /></label></div></fieldset><fieldset><legend>Emergency Contact</legend><div className="field-grid"><label>Name<input value={draft.emergencyContactName} onChange={(event) => set({ emergencyContactName: event.target.value })} /></label><label>Relationship<input value={draft.emergencyContactRelationship} onChange={(event) => set({ emergencyContactRelationship: event.target.value })} /></label><label>Phone<input type="tel" value={draft.emergencyContactPhone} onChange={(event) => set({ emergencyContactPhone: event.target.value })} /></label><label>Email<input type="email" value={draft.emergencyContactEmail} onChange={(event) => set({ emergencyContactEmail: event.target.value })} /></label></div></fieldset></div><button className="primary block" disabled={!requiredComplete} onClick={submit}>Submit onboarding</button></section>{canReviewAll && <OnboardingAdminList state={state} />}</div>;
}

function OnboardingAdminList({ state }: { state: CrewState }) {
  const records = state.onboarding ?? [];
  return <section className="panel card wide"><div className="section-head"><div><h3>Submitted Onboarding (Admin/HR)</h3><p className="muted">Only visible to admin/HR.</p></div><span className="pill">{records.length}</span></div>{records.length ? <div className="incident-list">{records.map((record) => <article className="incident-card" key={record.id}><div className="section-head"><h4>{nameOf(state, record.userId)}</h4><small>Submitted {record.completedAt.slice(0, 10)}</small></div><div className="facts"><span>Start {record.startDate}</span><span>${record.hourlyWage}/hr</span><span>DOB {record.dateOfBirth}</span></div><div className="line"><b>Address</b><span>{record.address}, {record.city} {record.postalCode}</span></div><div className="line"><b>SIN</b><span>{record.sin}</span></div><div className="line"><b>Driver's license</b><span>{record.driversLicenseNumber}</span></div>{record.allergiesMedical && <div className="line"><b>Allergies/medical</b><span>{record.allergiesMedical}</span></div>}<div className="line"><b>Emergency contact</b><span>{record.emergencyContactName} ({record.emergencyContactRelationship}) - {record.emergencyContactPhone}</span></div>{record.directDepositFileName && <div className="line"><b>Direct deposit form</b><span>{record.directDepositFileName}</span></div>}{(record.driversLicenseFrontFileName || record.driversLicenseBackFileName) && <div className="line"><b>License photos</b><span>{[record.driversLicenseFrontFileName, record.driversLicenseBackFileName].filter(Boolean).join(", ")}</span></div>}</article>)}</div> : <p className="empty-state">No onboarding submissions yet.</p>}</section>;
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

function Incidents({ state, user, setState }: { state: CrewState; user: Profile; setState: React.Dispatch<React.SetStateAction<CrewState>> }) {
  const { showToast } = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const canViewAll = user.role === "admin" || user.role === "manager";
  const visibleReports = (state.incidentReports ?? []).filter((report) => canViewAll || report.reportedByUserId === user.id);
  const [draft, setDraft] = useState<IncidentReportDraft>(() => incidentDraft(user, today));
  const requiredComplete = Boolean(draft.employeeName.trim() && draft.employeeRole.trim() && draft.location.trim() && draft.dateOfIncident && draft.timeOfIncident && draft.incidentCause.trim() && draft.incidentDetails.trim() && draft.actionTaken.trim() && draft.reportedByName.trim() && draft.reportedByRole.trim());
  const set = (patch: Partial<IncidentReportDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const submit = () => {
    setState((next) => submitIncidentReport(next, user.id, { ...draft, photoFileNames: (draft.photoFileNames ?? []).filter(Boolean) }));
    showToast("Incident report submitted");
    setDraft(incidentDraft(user, today));
  };

  return <div className="incident-page"><section className="panel card wide incident-form"><div className="section-head"><div><h3>Damage and Incident Report</h3><p className="muted">Submit the simplified incident report for Crew Lead or Owner receipt confirmation.</p></div><span className="pill">Receipt required</span></div><div className="incident-sections"><fieldset><legend>Employee Details</legend><div className="field-grid"><label>Employee name<input value={draft.employeeName} onChange={(event) => set({ employeeName: event.target.value })} /></label><label>Employee role<input value={draft.employeeRole} onChange={(event) => set({ employeeRole: event.target.value })} /></label><label>Employee phone<input type="tel" value={draft.employeePhone ?? ""} onChange={(event) => set({ employeePhone: event.target.value })} /></label></div></fieldset><fieldset><legend>Incident Details</legend><div className="field-grid"><label className="wide-field">Location<input value={draft.location} onChange={(event) => set({ location: event.target.value })} /></label><label>Date of incident<input type="date" value={draft.dateOfIncident} onChange={(event) => set({ dateOfIncident: event.target.value })} /></label><label>Time of incident<input type="time" value={draft.timeOfIncident} onChange={(event) => set({ timeOfIncident: event.target.value })} /></label><label className="wide-field">Incident cause<input value={draft.incidentCause} onChange={(event) => set({ incidentCause: event.target.value })} /></label><label className="wide-field">Incident details<textarea value={draft.incidentDetails} onChange={(event) => set({ incidentDetails: event.target.value })} /></label><label className="wide-field">Action taken<textarea value={draft.actionTaken} onChange={(event) => set({ actionTaken: event.target.value })} /></label><label className="check"><input type="checkbox" checked={draft.policeNotified} onChange={(event) => set({ policeNotified: event.target.checked })} /> Police notified</label><label className="wide-field">Follow-up required<textarea value={draft.followUpRequired ?? ""} onChange={(event) => set({ followUpRequired: event.target.value })} /></label><label className="wide-field">Photo file<ImageFilePicker value={draft.photoFileNames?.[0]} onChange={(file) => set({ photoFileNames: file ? [file.name] : [] })} /></label></div></fieldset><fieldset><legend>Reported By</legend><div className="field-grid"><label>Reported by name<input value={draft.reportedByName} onChange={(event) => set({ reportedByName: event.target.value })} /></label><label>Reported by role<input value={draft.reportedByRole} onChange={(event) => set({ reportedByRole: event.target.value })} /></label><label>Reported by phone<input type="tel" value={draft.reportedByPhone ?? ""} onChange={(event) => set({ reportedByPhone: event.target.value })} /></label></div></fieldset></div><button className="primary block" disabled={!requiredComplete} onClick={submit}>Submit report</button></section><section className="panel card wide"><div className="section-head"><div><h3>Submitted Reports</h3><p className="muted">{canViewAll ? "Manager/admin view shows all submitted reports." : "Crew view shows reports you submitted."}</p></div><span className="pill">{visibleReports.length} visible</span></div>{visibleReports.length ? <div className="incident-list">{visibleReports.map((report) => <IncidentReportCard key={report.id} state={state} report={report} user={user} setState={setState} />)}</div> : <p className="empty-state">No incident reports yet.</p>}</section></div>;
}

function IncidentReportCard({ state, report, user, setState }: { state: CrewState; report: IncidentReport; user: Profile; setState: React.Dispatch<React.SetStateAction<CrewState>> }) {
  const { showToast } = useToast();
  const canConfirm = canConfirmIncidentReceipt(user);
  return <article className="incident-card"><div className="section-head"><div><h3>{report.employeeName}</h3><small>{report.dateOfIncident} at {report.timeOfIncident} - reported by {report.reportedByName}</small></div><span className={`pill ${report.confirmedAt ? "good" : "warn"}`}>{report.confirmedAt ? "Confirmed" : "Unconfirmed"}</span></div><div className="incident-summary"><div className="facts"><span>{report.employeeRole}</span><span>{report.location}</span><span>{report.policeNotified ? "Police notified" : "Police not notified"}</span></div><div className="line"><b>Cause</b><span>{report.incidentCause}</span></div><div className="line"><b>Details</b><span>{report.incidentDetails}</span></div><div className="line"><b>Action taken</b><span>{report.actionTaken}</span></div>{report.followUpRequired ? <div className="line"><b>Follow-up required</b><span>{report.followUpRequired}</span></div> : null}{report.photoFileNames?.length ? <div className="line"><b>Photos</b><span>{report.photoFileNames.join(", ")}</span></div> : null}</div><section className="receipt-box"><h4>Confirm Receipt</h4>{report.confirmedAt ? <p className="toast good">Confirmed by {report.confirmedByName} on {report.confirmedAt.slice(0, 10)}.</p> : canConfirm ? <button onClick={() => { setState((next) => confirmIncidentReceipt(next, report.id, user.id)); showToast("Incident receipt confirmed"); }}>Confirm receipt</button> : <p className="empty-state">Awaiting Crew Lead or Owner confirmation.</p>}</section></article>;
}

function toneForCert(level: string) {
  if (level === "red") return "bad";
  if (level === "amber") return "warn";
  return "good";
}

function Compliance({ state, user, setState }: { state: CrewState; user: Profile; setState: React.Dispatch<React.SetStateAction<CrewState>> }) {
  const canViewTeam = user.role === "admin" || user.role === "manager";
  const visibleUsers = canViewTeam ? state.users.filter((item) => item.branch === "field" && item.status !== "Inactive") : [user];
  return <div className="compliance-page"><PolicyPanel state={state} user={user} setState={setState} /><div className="library">{visibleUsers.map((item) => <ComplianceUserCard key={item.id} state={state} user={item} setState={setState} />)}</div></div>;
}

function PolicyPanel({ state, user, setState }: { state: CrewState; user: Profile; setState: React.Dispatch<React.SetStateAction<CrewState>> }) {
  const { showToast } = useToast();
  const policy = state.policyDocuments.find((item) => item.active);
  const year = new Date().getFullYear();
  const acknowledgment = state.policyAcknowledgments.find((item) => item.policyId === policy?.id && item.userId === user.id && item.year === year);
  const [read, setRead] = useState(false);
  const [signedName, setSignedName] = useState(user.name);
  if (!policy) return null;
  return <section className="panel card policy-panel"><div className="section-head"><div><h3>{policy.title}</h3><p className="muted">Read the full policy, then sign and date the annual acknowledgment.</p></div><div className="form-status"><span className="pill">Due {policyDueDate(policy, year)}</span><span className={`pill ${acknowledgment ? "good" : "warn"}`}>{acknowledgment ? "Signed" : "Action needed"}</span></div></div><a className="button-link" href={policy.fileUrl} target="_blank" rel="noreferrer">Open policy PDF</a>{acknowledgment ? <p className="toast good">Signed by {acknowledgment.signedName} on {acknowledgment.signedAt.slice(0, 10)}.</p> : <div className="policy-sign"><label className="check"><input type="checkbox" checked={read} onChange={(event) => setRead(event.target.checked)} />I have read the complete policy.</label><label>Electronic signature<input value={signedName} onChange={(event) => setSignedName(event.target.value)} /></label><button className="primary" disabled={!read || !signedName.trim()} onClick={() => { setState((next) => acknowledgePolicy(next, policy.id, user.id, signedName)); showToast("Policy acknowledged"); }}>Sign and date</button></div>}</section>;
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
  return <section className="panel card compliance-card"><div className="section-head"><div><h3>{user.name}</h3><div className="cert-summary"><span className="pill bad">{red} urgent</span><span className="pill warn">{amber} upcoming</span></div></div><button onClick={() => setState((next) => awardCertsCurrent(next, user.id, today.slice(0, 7)))}>Current +{rulePoints(state, "earn-certs", 5)}</button></div><div className="add-cert"><select value={certTypeId} onChange={(event) => setCertTypeId(event.target.value)}>{state.certificationTypes.map((type) => <option value={type.id} key={type.id}>{type.name}</option>)}</select><button onClick={addCertification}>Add certification</button></div><div className="cert-list">{certs.length ? certs.map((cert) => <div className="line cert-record" key={cert.id}><b>{cert.name}</b><span className={`pill ${toneForCert(levelFor(cert))}`}>{cert.status}</span><small>{cert.expiresAt ? `expires ${cert.expiresAt}` : cert.courseDate ? `course ${cert.courseDate}` : cert.note || "expiry date needed"}</small><div className="field-stack"><label>Course date<input type="date" value={cert.courseDate ?? ""} onChange={(event) => updateCert(cert.id, { courseDate: event.target.value })} /></label><label>Expiry date<input type="date" value={cert.expiresAt ?? ""} onChange={(event) => updateCert(cert.id, { expiresAt: event.target.value })} /></label><label>Certificate number<input value={cert.certificateNumber ?? ""} placeholder="Certificate #" onChange={(event) => updateCert(cert.id, { certificateNumber: event.target.value })} /></label><label>Certificate photo or PDF<ImageFilePicker accept="image/*,.pdf" value={cert.certificatePhotoKey} onChange={(file) => updateCert(cert.id, { certificatePhotoKey: file?.name })} /></label><button onClick={() => setState((next) => awardCertDetail(next, cert.userId, cert.id))}>Save details +{rulePoints(state, "earn-cert-detail", 5)}</button></div></div>) : <p className="empty-state">No certifications yet. Add the first record above.</p>}</div></section>;
}
