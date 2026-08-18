import { useState } from "react";
import { addStep, canApprove, canEditSop, deleteStep, moveStep, requestChanges, submitForReview, updateStep } from "../domain/sop";
import type { MediaType, Role, SopItem, SopState } from "../types";
import { useToast } from "../components/Toast";
import { nameOf, SopRow, statusLabels } from "../App";

export function Library({ state, select }: { state: SopState; select: (id: string) => void }) {
  return <div className="library">{state.categories.map((category) => {
    const sops = state.sops.filter((sop) => sop.categoryId === category.id && sop.status !== "archived");
    return <section className="panel card" key={category.id}><h3>{category.name}</h3>{sops.map((sop) => <SopRow key={sop.id} state={state} sop={sop} onClick={() => select(sop.id)} />)}</section>;
  })}</div>;
}

export function Builder({ state, sop, role, setState, openEdit, approve, attachFile }: { state: SopState; sop: SopItem; role: Role; setState: React.Dispatch<React.SetStateAction<SopState>>; openEdit: () => void; approve: (sopId: string) => void; attachFile: (stepId: string, type: MediaType, file: File) => void }) {
  const { showToast } = useToast();
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [comments, setComments] = useState("");
  const category = state.categories.find((item) => item.id === sop.categoryId);
  const promptSet = state.promptSets.find((item) => item.id === category?.promptSetId);
  const steps = state.steps.filter((step) => step.sopId === sop.id).sort((a, b) => a.sortOrder - b.sortOrder);
  const manager = state.users.find((user) => user.role === "manager") ?? state.users[0];
  const published = sop.status === "published";
  const editable = canEditSop(role, state.currentUserId, sop);
  return (
    <div className="builder">
      <section className="panel card wide">
        <div className="builder-head">
          <div>
            <span className={`status ${sop.status}`}>{statusLabels[sop.status]}</span>
            <h3>{sop.title}</h3>
            <p>{sop.description}</p>
          </div>
          {editable && <button onClick={openEdit}>Edit fields</button>}
        </div>
        <div className="facts">
          <span>Category: {category?.name}</span>
          <span>Responsible: {nameOf(state, sop.assignedTo)}</span>
          <span>Photo: {sop.requiresPhoto ? "Expected" : "Optional"}</span>
          <span>Video: {sop.requiresVideo ? "Expected" : "Optional"}</span>
          {sop.dueDate && <span>Due: {sop.dueDate}</span>}
        </div>
      </section>

      <section className="panel card prompts">
        <h3>Thinking prompts</h3>
        {promptSet?.prompts.map((prompt) => <p key={prompt}>{prompt}</p>)}
      </section>

      <section className="panel card wide">
        <div className="section-head"><h3>{published ? "Published reference" : "Build steps"}</h3><span>{steps.length} steps</span></div>
        <div className="steps">
          {steps.map((step, index) => <div className="step" key={step.id}>
            <div className="step-num">{index + 1}</div>
            <div className="step-body">
              <textarea disabled={!editable} value={step.text} onChange={(event) => setState((next) => updateStep(next, step.id, event.target.value, step.note))} />
              <input disabled={!editable} value={step.note} onChange={(event) => setState((next) => updateStep(next, step.id, step.text, event.target.value))} placeholder="Short note or caption" />
              <MediaStrip state={state} stepId={step.id} />
              {editable && <div className="step-actions">
                <button onClick={() => setState((next) => moveStep(next, sop.id, step.id, -1))}>Up</button>
                <button onClick={() => setState((next) => moveStep(next, sop.id, step.id, 1))}>Down</button>
                <label className="upload">Photo<input type="file" accept="image/*" capture="environment" onChange={(event) => attachFromInput(event, "photo", step.id, attachFile)} /></label>
                <label className="upload">Video<input type="file" accept="video/*" capture="environment" onChange={(event) => attachFromInput(event, "video", step.id, attachFile)} /></label>
                <button className="danger" onClick={() => setState((next) => deleteStep(next, step.id))}>Delete</button>
              </div>}
            </div>
          </div>)}
        </div>
        {editable && <div className="add-step">
          <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Add the next step..." />
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note" />
          <button className="primary" disabled={!text.trim()} onClick={() => { setState((next) => addStep(next, sop.id, text, note)); setText(""); setNote(""); showToast("Step added"); }}>Add step</button>
        </div>}
        <div className="review-actions">
          {!published && editable && <button className="primary" disabled={!steps.length} onClick={() => { setState((next) => submitForReview(next, sop.id, manager.id)); showToast("SOP submitted for review"); }}>Submit for review</button>}
          {canApprove(role, state.permissions.crewLeadCanApprove) && sop.status === "in_review" && <button onClick={() => approve(sop.id)}>Approve +20</button>}
          {canApprove(role, state.permissions.crewLeadCanApprove) && sop.status === "in_review" && <><input value={comments} onChange={(event) => setComments(event.target.value)} placeholder="Change request comments" /><button onClick={() => { setState((next) => requestChanges(next, sop.id, comments || "Please revise and resubmit.", sop.assignedTo)); showToast("Changes requested", "warn"); }}>Request changes</button></>}
        </div>
      </section>
    </div>
  );
}

function MediaStrip({ state, stepId }: { state: SopState; stepId: string }) {
  const media = state.media.filter((item) => item.stepId === stepId);
  if (!media.length) return null;
  return <div className="media-strip">{media.map((item) => <button className="media" key={item.id} onClick={() => item.localUrl || item.thumbnailUrl ? window.open(item.localUrl || item.thumbnailUrl, "_blank") : undefined}><b>{item.type === "photo" ? "PHOTO" : "VIDEO"}</b><span>{item.syncStatus}</span>{item.thumbnailUrl || item.localUrl ? <small>Tap to expand</small> : null}</button>)}</div>;
}

function attachFromInput(event: React.ChangeEvent<HTMLInputElement>, type: MediaType, stepId: string, attachFile: (stepId: string, type: MediaType, file: File) => void) {
  const file = event.target.files?.[0];
  if (!file) return;
  attachFile(stepId, type, file);
  event.target.value = "";
}

type ContentTab = "library" | "build";

export default function ContentTabBoundary({ activeTab, state, sop, role, select, setState, openEdit, approve, attachFile }: {
  activeTab: ContentTab;
  state: SopState;
  sop?: SopItem;
  role: Role;
  select: (id: string) => void;
  setState: React.Dispatch<React.SetStateAction<SopState>>;
  openEdit: () => void;
  approve: (sopId: string) => void;
  attachFile: (stepId: string, type: MediaType, file: File) => void;
}) {
  if (activeTab === "library") return <Library state={state} select={select} />;
  if (!sop) return null;
  return <Builder state={state} sop={sop} role={role} setState={setState} openEdit={openEdit} approve={approve} attachFile={attachFile} />;
}
