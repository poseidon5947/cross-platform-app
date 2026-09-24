// @vitest-environment jsdom
/**
 * Live verification pass 4, section 6. Three things went wrong beyond the queue
 * being wiped on mount, and each has a test here:
 *
 *   - a background refetch replaced state with the server copy, so a task that
 *     was ticked and pending drew as unticked, and a deducted count jumped back;
 *   - a reload with no signal showed "Could not load data" because the only
 *     source of state was the server;
 *   - the daily-log sentences were sent straight to the server and had no queue,
 *     so with no signal they were simply gone.
 */
import { describe, expect, it, beforeEach } from "vitest";
import { createSeedState } from "./seed";
import { applyQueuedCommands, drainOfflineQueue } from "./offline";
import { validateMaterialsCsv } from "./csvImport";
import { loadSnapshot, saveSnapshot } from "../App";
import type { OfflineCommand } from "../types";

const ROW = "11111111-1111-4111-8111-111111111111";

describe("queued work is laid back over server state", () => {
  it("keeps a pending material deduction visible after a refetch", () => {
    const seed = createSeedState();
    const server = { ...seed, materials: seed.materials.map((m, i) => (i === 0 ? { ...m, qty: 104 } : m)) };
    const material = server.materials[0];
    const before = material.qty;
    const queue: OfflineCommand[] = [{
      id: "oq-1", type: "log_materials", queuedAt: "2026-09-24T10:00:00Z", rowIds: [ROW],
      transactions: [{ materialId: material.id, qty: 1, type: "use", userId: server.currentUserId }],
    }];
    const shown = applyQueuedCommands(server, queue);
    expect(shown.materials[0].qty).toBe(before - 1);
    expect(shown.transactions[0].id).toBe(ROW);
  });

  it("does not deduct twice once the server already has the row", () => {
    const seed = createSeedState();
    const server = { ...seed, materials: seed.materials.map((m, i) => (i === 0 ? { ...m, qty: 104 } : m)) };
    const material = server.materials[0];
    const queue: OfflineCommand[] = [{
      id: "oq-1", type: "log_materials", queuedAt: "2026-09-24T10:00:00Z", rowIds: [ROW],
      transactions: [{ materialId: material.id, qty: 1, type: "use", userId: server.currentUserId }],
    }];
    const synced = { ...server, transactions: [{ ...queue[0].type === "log_materials" ? queue[0].transactions[0] : ({} as never), id: ROW, ts: "" }, ...server.transactions] };
    const shown = applyQueuedCommands(synced, queue);
    expect(shown.materials[0].qty).toBe(server.materials[0].qty);
    expect(shown.transactions).toHaveLength(synced.transactions.length);
  });

  it("keeps a pending task tick visible, and only once", () => {
    const server = createSeedState();
    const task = server.truckTasks[0];
    const cmd: OfflineCommand = { id: "oq-2", type: "complete_task", userId: server.currentUserId, taskId: task.id, periodKey: "2026-09-24", queuedAt: "2026-09-24T10:00:00Z" };
    const once = applyQueuedCommands(server, [cmd]);
    const twice = applyQueuedCommands(once, [cmd]);
    const matches = (s: typeof server) => s.taskCompletions.filter((c) => c.taskId === task.id && c.periodKey === "2026-09-24" && c.userId === server.currentUserId);
    expect(matches(once)).toHaveLength(1);
    expect(matches(twice)).toHaveLength(1);
  });

  it("keeps a pending daily log and its points visible, without double counting", () => {
    const server = createSeedState();
    const log = { id: ROW, siteId: server.sites[0].id, serviceId: "wp" as const, date: "2026-09-24", workCompleted: "x", toDoNextTime: "y", completedByUserId: server.currentUserId, submittedByUserId: server.currentUserId, createdAt: "2026-09-24T10:00:00Z" };
    const event = { id: "pe-1", userId: server.currentUserId, type: "daily_log_entry" as const, points: 5, reason: "Daily log entry submitted", ref: `dailylog:${ROW}`, ts: log.createdAt };
    const cmd: OfflineCommand = { id: "oq-3", type: "daily_log", log, poolDelta: 0, event, queuedAt: log.createdAt };
    const once = applyQueuedCommands(server, [cmd]);
    expect(once.dailyLogs[0].id).toBe(ROW);
    expect(once.pointsEvents.filter((e) => e.id === "pe-1")).toHaveLength(1);
    const twice = applyQueuedCommands(once, [cmd]);
    expect(twice.dailyLogs.filter((l) => l.id === ROW)).toHaveLength(1);
    expect(twice.pointsEvents.filter((e) => e.id === "pe-1")).toHaveLength(1);
  });
});

describe("a daily log written offline is replayed", () => {
  it("is drained through the server like any other command", async () => {
    const sent: string[] = [];
    const cmd = { id: "oq-3", type: "daily_log", log: { id: ROW }, poolDelta: 0, queuedAt: "" } as unknown as OfflineCommand;
    const remaining = await drainOfflineQueue([cmd], {
      logMaterials: async () => {}, completeTask: async () => {}, saveTruckLog: async () => {},
      saveDailyLog: async (c) => { sent.push(c.log.id); },
    });
    expect(sent).toEqual([ROW]);
    expect(remaining).toEqual([]);
  });

  it("stays queued while the server is unreachable", async () => {
    const cmd = { id: "oq-3", type: "daily_log", log: { id: ROW }, poolDelta: 0, queuedAt: "" } as unknown as OfflineCommand;
    const remaining = await drainOfflineQueue([cmd], {
      logMaterials: async () => {}, completeTask: async () => {}, saveTruckLog: async () => {},
      saveDailyLog: async () => { throw new Error("offline"); },
    });
    expect(remaining).toHaveLength(1);
  });
});

describe("last synced snapshot", () => {
  beforeEach(() => localStorage.clear());

  it("comes back for the same person with an empty queue", () => {
    const state = createSeedState();
    saveSnapshot("u1", { ...state, offlineQueue: [{ id: "x", type: "complete_task", userId: "u1", taskId: "t", periodKey: "p", queuedAt: "" }] });
    const restored = loadSnapshot("u1");
    expect(restored?.materials).toHaveLength(state.materials.length);
    expect(restored?.offlineQueue).toEqual([]);
  });

  it("is not handed to a different person on the same device", () => {
    saveSnapshot("u1", createSeedState());
    expect(loadSnapshot("u2")).toBeNull();
  });

  it("is null when nothing was ever synced or the store is unreadable", () => {
    expect(loadSnapshot("u1")).toBeNull();
    localStorage.setItem("warehouse-wizard-last-sync-v1", "{nope");
    expect(loadSnapshot("u1")).toBeNull();
  });
});

describe("CSV import without a Category column", () => {
  it("updates a known material and names why a new one was skipped", () => {
    const state = createSeedState();
    const known = state.materials[0];
    const csv = ["Item,Unit,Cost,On hand", `${known.name},${known.unit},9.99,999`, "ZZ Probe,Unit,1.23,7"].join("\n");
    const report = validateMaterialsCsv(csv, state.materials);
    expect(report.imported).toBe(1);
    expect(report.materials[0].name).toBe(known.name);
    expect(report.materials[0].category).toBe(known.category);
    expect(report.materials[0].cost).toBe(9.99);
    expect(report.materials[0].qty).toBe(known.qty);
    expect(report.skipped).toEqual([{ row: 3, reason: "New material needs a Category column" }]);
  });
});
