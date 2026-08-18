import { createSeedState } from "../data/seed";
import type { SopState } from "../types";
import { useToast } from "../components/Toast";
import { Metric, REMOTE_MODE } from "../App";

function labelize(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

export default function AdminTabBoundary({ state, setState }: { state: SopState; setState: React.Dispatch<React.SetStateAction<SopState>> }) {
  const { showToast } = useToast();
  const total = state.pointsEvents.filter((event) => event.type === "sop_completed").reduce((sum, event) => sum + event.points, 0);
  return <div className="grid two"><section className="panel card"><h3>Permissions</h3>{Object.entries(state.permissions).map(([key, value]) => <label className="check" key={key}><input type="checkbox" checked={value} onChange={(event) => { setState((next) => ({ ...next, permissions: { ...next.permissions, [key]: event.target.checked } })); showToast("Permission updated"); }} /> {labelize(key)}</label>)}</section><section className="panel card"><h3>Shared points ledger</h3><Metric label="SOP points awarded" value={total} /><Metric label="Award events" value={state.pointsEvents.filter((event) => event.type === "sop_completed").length} /></section><section className="panel card wide"><h3>Notifications</h3>{state.notifications.slice(0, 8).map((note) => <div className="note" key={note.id}><b>{note.title}</b><span>{note.body}</span></div>)}{!REMOTE_MODE && <button className="danger" onClick={() => setState(createSeedState())}>Reset demo data</button>}</section></div>;
}
