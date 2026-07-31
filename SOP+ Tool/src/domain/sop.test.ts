import { describe, expect, it } from "vitest";
import { createSeedState } from "../data/seed";
import { addStep, approveSop, attachMedia, drainOfflineMediaQueue, requestChanges, submitForReview } from "./sop";

describe("SOP lifecycle", () => {
  it("moves assigned SOPs through build, review, changes, and approval", () => {
    let state = createSeedState();
    const sop = state.sops.find((item) => item.status === "assigned")!;
    state = addStep(state, sop.id, "Stage materials and inspect access.", "", "2026-07-28T09:00:00Z");
    expect(state.sops.find((item) => item.id === sop.id)?.status).toBe("in_progress");

    state = submitForReview(state, sop.id, "u2", "2026-07-28T10:00:00Z");
    expect(state.sops.find((item) => item.id === sop.id)?.status).toBe("in_review");

    state = requestChanges(state, sop.id, "Add a weather go/no-go step.", sop.assignedTo, "2026-07-28T11:00:00Z");
    expect(state.sops.find((item) => item.id === sop.id)?.status).toBe("in_progress");

    state = submitForReview(state, sop.id, "u2", "2026-07-28T12:00:00Z");
    state = approveSop(state, sop.id, "u2", "2026-07-28T13:00:00Z");
    expect(state.sops.find((item) => item.id === sop.id)?.status).toBe("published");
  });

  it("awards exactly 20 points once per SOP", () => {
    let state = createSeedState();
    const sop = state.sops.find((item) => item.status === "assigned")!;
    state = approveSop(state, sop.id, "u2", "2026-07-28T13:00:00Z");
    state = approveSop(state, sop.id, "u2", "2026-07-28T14:00:00Z");
    const awards = state.pointsEvents.filter((event) => event.type === "sop_completed" && event.ref === sop.id);
    expect(awards).toHaveLength(1);
    expect(awards[0].points).toBe(20);
  });

  it("queues offline media and drains it on reconnect", () => {
    let state = createSeedState();
    const sop = state.sops.find((item) => item.status === "assigned")!;
    state = addStep(state, sop.id, "Photograph staged materials.");
    const step = state.steps.find((item) => item.sopId === sop.id)!;
    state = attachMedia(state, step.id, "photo", "staged.jpg", false, "2026-07-28T09:05:00Z");
    expect(state.offlineMediaQueue).toHaveLength(1);
    expect(state.media[0].syncStatus).toBe("queued");
    state = drainOfflineMediaQueue(state);
    expect(state.media[0].syncStatus).toBe("synced");
    expect(state.offlineMediaQueue[0].status).toBe("synced");
  });
});
