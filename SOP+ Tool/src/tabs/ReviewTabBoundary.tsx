import { canApprove } from "../domain/sop";
import type { Role, SopState } from "../types";
import { SopRow } from "../App";

export default function ReviewTabBoundary({ state, role, approve, select }: { state: SopState; role: Role; approve: (sopId: string) => void; select: (id: string) => void }) {
  const queue = state.sops.filter((sop) => sop.status === "in_review");
  return <section className="panel card wide"><h3>Submitted SOPs</h3>{queue.map((sop) => <div className="review-row" key={sop.id}><SopRow state={state} sop={sop} onClick={() => select(sop.id)} />{canApprove(role, state.permissions.crewLeadCanApprove) && <button onClick={() => approve(sop.id)}>Approve +20</button>}</div>)}{!queue.length && <p className="muted">Nothing waiting for review.</p>}</section>;
}
