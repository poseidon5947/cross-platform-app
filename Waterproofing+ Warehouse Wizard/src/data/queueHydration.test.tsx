// @vitest-environment jsdom
/**
 * Live verification pass 4 found offline work still being lost, although the
 * storage helpers themselves were correct and tested. The fault was in the mount
 * sequence, which those tests never exercised:
 *
 *   1. the save effect ran on mount with an empty queue and CLEARED the store,
 *   2. the restore hung off remoteState, which never arrives while offline.
 *
 * So this harness reproduces the sequence rather than the helpers: save a queue,
 * mount fresh, and assert the queue is both in state and still in the store.
 */
import { describe, expect, it, beforeEach } from "vitest";
import { useEffect, useRef, useState, act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { loadOfflineQueue, saveOfflineQueue } from "../App";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const KEY = "warehouse-wizard-offline-queue-v1";
const cmd = (id: string) => ({ id, type: "complete_task", userId: "u1", taskId: "t1", periodKey: "2026-09-24", queuedAt: "" }) as any;

/** The App's shape: hydrate at first render, save on change, skip the first run. */
function Harness({ onQueue }: { onQueue: (q: unknown[]) => void }) {
  const [queue, setQueue] = useState(() => loadOfflineQueue());
  const hydrated = useRef(false);
  useEffect(() => {
    if (!hydrated.current) { hydrated.current = true; return; }
    saveOfflineQueue(queue as any);
  }, [queue]);
  useEffect(() => { onQueue(queue); }, [queue, onQueue]);
  return <button onClick={() => setQueue([])}>drain</button>;
}

async function mount() {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const seen: unknown[][] = [];
  const root = createRoot(host);
  await act(async () => { root.render(<StrictMode><Harness onQueue={(q) => seen.push(q)} /></StrictMode>); });
  return { host, root, seen };
}

describe("offline queue survives a reload", () => {
  beforeEach(() => localStorage.clear());

  it("is in state on the first render, with nothing arriving from the server", async () => {
    saveOfflineQueue([cmd("oq-1")]);
    const { seen, root } = await mount();
    expect((seen[0] as any[]).map((c) => c.id)).toEqual(["oq-1"]);
    await act(async () => { root.unmount(); });
  });

  it("REGRESSION: mounting must not clear the stored queue", async () => {
    saveOfflineQueue([cmd("oq-1")]);
    const { root } = await mount();
    // This is precisely what broke in production: the store was empty here.
    expect(localStorage.getItem(KEY)).not.toBeNull();
    expect(loadOfflineQueue().map((c) => c.id)).toEqual(["oq-1"]);
    await act(async () => { root.unmount(); });
  });

  it("survives repeated reloads while still offline", async () => {
    saveOfflineQueue([cmd("oq-1"), cmd("oq-2")]);
    for (let reload = 0; reload < 3; reload++) {
      const { root, seen } = await mount();
      expect((seen[0] as any[])).toHaveLength(2);
      await act(async () => { root.unmount(); });
    }
    expect(loadOfflineQueue()).toHaveLength(2);
  });

  it("still clears the store once the queue genuinely drains", async () => {
    saveOfflineQueue([cmd("oq-1")]);
    const { host, root } = await mount();
    await act(async () => { host.querySelector("button")!.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    expect(localStorage.getItem(KEY)).toBeNull();
    await act(async () => { root.unmount(); });
  });
});
