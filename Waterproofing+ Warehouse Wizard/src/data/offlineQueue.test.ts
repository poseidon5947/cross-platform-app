// @vitest-environment jsdom
/**
 * Work logged with no signal sits in the offline queue until it can be sent. It
 * used to live only in React state, and loadRemoteState returns an empty queue -
 * so a reload, or just a background refetch, silently threw away work the app had
 * already promised would "sync when connection returns".
 */
import { describe, expect, it, beforeEach } from "vitest";
import { loadOfflineQueue, saveOfflineQueue } from "../App";
import { drainOfflineQueue } from "./offline";
import type { OfflineCommand } from "../types";

const cmd = (id: string): OfflineCommand => ({
  id, type: "complete_task", userId: "u1", taskId: "t1", periodKey: "2026-09-24", queuedAt: "2026-09-24T09:00:00Z",
} as OfflineCommand);

describe("offline queue storage", () => {
  beforeEach(() => localStorage.clear());

  it("survives a round trip", () => {
    saveOfflineQueue([cmd("oq-1"), cmd("oq-2")]);
    expect(loadOfflineQueue().map((c) => c.id)).toEqual(["oq-1", "oq-2"]);
  });

  it("starts empty when nothing was ever queued", () => {
    expect(loadOfflineQueue()).toEqual([]);
  });

  it("clears the store once everything has drained", () => {
    saveOfflineQueue([cmd("oq-1")]);
    saveOfflineQueue([]);
    expect(localStorage.getItem("warehouse-wizard-offline-queue-v1")).toBeNull();
    expect(loadOfflineQueue()).toEqual([]);
  });

  it("returns an empty queue rather than throwing on unreadable storage", () => {
    localStorage.setItem("warehouse-wizard-offline-queue-v1", "{not json");
    expect(loadOfflineQueue()).toEqual([]);
  });

  it("ignores a stored value that is not a list", () => {
    localStorage.setItem("warehouse-wizard-offline-queue-v1", '{"id":"oq-1"}');
    expect(loadOfflineQueue()).toEqual([]);
  });

  it("does not throw when the store refuses a write", () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error("QuotaExceededError"); };
    expect(() => saveOfflineQueue([cmd("oq-1")])).not.toThrow();
    Storage.prototype.setItem = original;
  });
});

/**
 * The queue outliving a restart means a command can come back after the server
 * already accepted it — the app having died in between. Stock moves through the
 * transactions_apply_stock trigger, so a replayed material log would deduct the
 * same material twice. These pin the ids that stop that.
 */
describe("a replayed command reuses its row ids", () => {
  it("keeps the same transaction ids across retries", async () => {
    const rowIds = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
    const command = { id: "oq-1", type: "log_materials", transactions: [{}, {}], rowIds, queuedAt: "" } as any;
    const sent: string[][] = [];
    const server = {
      logMaterials: async (c: any) => { sent.push(c.rowIds); throw new Error("still offline"); },
      completeTask: async () => {}, saveTruckLog: async () => {},
    };
    // fails, stays queued, and is retried with the identical ids
    let remaining = await drainOfflineQueue([command], server);
    expect(remaining).toHaveLength(1);
    remaining = await drainOfflineQueue(remaining, server);
    expect(sent).toEqual([rowIds, rowIds]);
  });

  it("drops a command once the server takes it", async () => {
    const command = { id: "oq-1", type: "log_materials", transactions: [{}], rowIds: ["x"], queuedAt: "" } as any;
    const remaining = await drainOfflineQueue([command], {
      logMaterials: async () => {}, completeTask: async () => {}, saveTruckLog: async () => {},
    });
    expect(remaining).toEqual([]);
  });

  it("keeps a truck log's row id across retries", async () => {
    const command = { id: "oq-2", type: "truck_log", log: {}, rowId: "abc", autoTaskIds: [], queuedAt: "" } as any;
    const seen: string[] = [];
    const server = {
      logMaterials: async () => {}, completeTask: async () => {},
      saveTruckLog: async (c: any) => { seen.push(c.rowId); throw new Error("offline"); },
    };
    const once = await drainOfflineQueue([command], server);
    await drainOfflineQueue(once, server);
    expect(seen).toEqual(["abc", "abc"]);
  });
});
