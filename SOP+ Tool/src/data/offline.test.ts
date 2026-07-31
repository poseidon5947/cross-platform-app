import { describe, expect, it } from "vitest";
import { createSeedState } from "./seed";
import { drainRemoteMediaQueue } from "./offline";
import { addStep, attachMedia } from "../domain/sop";

describe("remote offline media drain", () => {
  it("uploads queued media and clears successful commands", async () => {
    let state = createSeedState();
    const sop = state.sops.find((item) => item.status === "assigned")!;
    state = addStep(state, sop.id, "Capture the staged material.");
    const step = state.steps.find((item) => item.sopId === sop.id)!;
    state = attachMedia(state, step.id, "photo", "site.jpg", false);

    const drained = await drainRemoteMediaQueue(state, {
      upload: async () => ({ storageKey: "sop/real/site.jpg", thumbnailUrl: "signed-url", size: 12 }),
    });

    expect(drained.offlineMediaQueue).toHaveLength(0);
    expect(drained.media.find((item) => item.stepId === step.id)?.syncStatus).toBe("synced");
    expect(drained.media.find((item) => item.stepId === step.id)?.storageKey).toBe("sop/real/site.jpg");
  });

  it("retains failed uploads for retry", async () => {
    let state = createSeedState();
    const sop = state.sops.find((item) => item.status === "assigned")!;
    state = addStep(state, sop.id, "Capture the hazard.");
    const step = state.steps.find((item) => item.sopId === sop.id)!;
    state = attachMedia(state, step.id, "photo", "hazard.jpg", false);

    const drained = await drainRemoteMediaQueue(state, {
      upload: async () => {
        throw new Error("offline");
      },
    });

    expect(drained.offlineMediaQueue).toHaveLength(1);
    expect(drained.offlineMediaQueue[0].status).toBe("failed");
  });
});
