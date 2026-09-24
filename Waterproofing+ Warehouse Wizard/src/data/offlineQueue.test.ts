// @vitest-environment jsdom
/**
 * Work logged with no signal sits in the offline queue until it can be sent. It
 * used to live only in React state, and loadRemoteState returns an empty queue -
 * so a reload, or just a background refetch, silently threw away work the app had
 * already promised would "sync when connection returns".
 */
import { describe, expect, it, beforeEach } from "vitest";
import { loadOfflineQueue, saveOfflineQueue } from "../App";
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
