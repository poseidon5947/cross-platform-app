import { describe, expect, it } from "vitest";
import { drainOfflineQueue } from "../data/offline";
import { validateMaterialsCsv } from "../data/csvImport";
import { createSeedState } from "../data/seed";
import {
  applyTransactions,
  applyTruckLog,
  dailyProgress,
  evaluateDailyPoints,
  monthlyInventoryLogCsv,
  monthKey,
  periodKey,
  reorderEstimate,
  setExactCountDelta,
  signedQuantity,
  stockStatus,
  todayKey,
  weekKey,
} from "./business";

describe("stock math", () => {
  it("maps transaction types to signed stock movement", () => {
    expect(signedQuantity("use", 2)).toBe(-2);
    expect(signedQuantity("deliver", 2)).toBe(-2);
    expect(signedQuantity("loss", 2)).toBe(-2);
    expect(signedQuantity("receive", 2)).toBe(2);
    expect(signedQuantity("return", 2)).toBe(2);
    expect(signedQuantity("adjust", -2)).toBe(-2);
  });

  it("applies locked step movements without going below zero", () => {
    const state = createSeedState();
    const updated = applyTransactions(state.materials, [{ materialId: "m1", qty: 999, type: "use" }]);
    expect(updated.find((material) => material.id === "m1")?.qty).toBe(0);
  });

  it("supports quarter quantities for barrel and gallon materials", () => {
    const state = createSeedState();
    const barrel = state.materials.find((material) => material.id === "m69")!;
    const gallon = state.materials.find((material) => material.id === "m5")!;
    expect(barrel.step).toBe(0.25);
    expect(gallon.step).toBe(0.25);
    const updated = applyTransactions(state.materials, [{ materialId: barrel.id, qty: 0.25, type: "receive" }]);
    expect(updated.find((material) => material.id === barrel.id)?.qty).toBe(0.25);
  });

  it("uses the requested stock status thresholds", () => {
    expect(stockStatus({ qty: 0, reorderPoint: 10 }).label).toBe("Out");
    expect(stockStatus({ qty: 9, reorderPoint: 10 }).label).toBe("Reorder");
    expect(stockStatus({ qty: 11, reorderPoint: 10 }).label).toBe("Low");
    expect(stockStatus({ qty: 12, reorderPoint: 10 }).label).toBe("OK");
  });

  it("sets exact count using a signed adjust delta", () => {
    const state = createSeedState();
    const material = state.materials.find((item) => item.id === "m1")!;
    const delta = setExactCountDelta(material.qty, 4);
    const updated = applyTransactions(state.materials, [{ materialId: material.id, qty: delta, type: "adjust" }]);
    expect(delta).toBe(4);
    expect(updated.find((item) => item.id === "m1")?.qty).toBe(4);
  });
});

describe("truck logs", () => {
  it("updates truck mileage and auto-completes vehicle tasks", () => {
    const state = createSeedState();
    const result = applyTruckLog(state, {
      id: "tl1",
      truckId: "tr1",
      ts: new Date("2026-07-24T15:00:00Z").toISOString(),
      km: 184300,
      driverId: "c0",
      siteId: "s1",
      serviceId: "veh",
      oilChecked: true,
      fuelTopped: true,
      repairs: "",
    });
    expect(result.trucks.find((truck) => truck.id === "tr1")?.km).toBe(184300);
    expect(result.trucks.find((truck) => truck.id === "tr1")?.lastOil).toBe(184300);
    expect(result.taskCompletions.length).toBeGreaterThanOrEqual(2);
  });
});

describe("csv import validation", () => {
  it("accepts workbook-style material headers and preserves existing qty", () => {
    const state = createSeedState();
    const csv = [
      "Inventory,Category,Unit (locked),Unit Cost ($),On Hand (current quantity),Reorder At (3 remaining in inventory),Warehouse Location",
      '"TremProof TP 260 55 Gallon Drum",Waterproofing,Drum,$999.00,100,8,Yard 2',
      "Bad Row,Unknown,Unit,1,1,1,Bin",
    ].join("\n");
    const report = validateMaterialsCsv(csv, state.materials);
    expect(report.imported).toBe(1);
    expect(report.skipped).toHaveLength(1);
    expect(report.materials[0].qty).toBe(0);
    expect(report.materials[0].step).toBe(0.25);
    expect(report.materials[0].cost).toBe(999);
    expect(report.materials[0].previousCost).toBeLessThan(999);
  });

  it("rejects non-canonical locked units and keeps Roll to whole units", () => {
    const csv = [
      "Inventory,Category,Unit (locked),Unit Cost ($),On Hand (current quantity),Reorder At (3 remaining in inventory),Warehouse Location",
      "Roll Item,Waterproofing,Roll,$10.00,4,2,A1",
      "Pail Item,Waterproofing,pail,$10.00,4,2,A2",
    ].join("\n");
    const report = validateMaterialsCsv(csv);
    expect(report.imported).toBe(1);
    expect(report.materials[0]).toMatchObject({ unit: "Roll", step: 1 });
    expect(report.skipped[0].reason).toContain("Invalid locked unit");
  });

  it("records the original cost when an imported price decreases", () => {
    const existing = createSeedState().materials[0];
    const lowerCost = Math.max(0.01, existing.cost - 1);
    const csv = [
      "Inventory,Category,Unit (locked),Unit Cost ($),Reorder At (3 remaining in inventory),Warehouse Location",
      `"${existing.name}",Waterproofing,${existing.unit},${lowerCost},${existing.reorderPoint},${existing.bin}`,
    ].join("\n");
    const report = validateMaterialsCsv(csv, [existing]);
    expect(report.materials[0].previousCost).toBe(existing.cost);
    expect(report.materials[0].cost).toBe(lowerCost);
  });

  it("uses Column J / On Hand to select strict high-value inventory", () => {
    const csv = [
      "Inventory,Category,Unit (locked),Unit Cost ($),On Hand (current quantity),Reorder At (3 remaining in inventory),Warehouse Location",
      "High Value Drum,Waterproofing,Drum,500,2,1,A1",
      "Reference Item,Waterproofing,Unit,5,,1,A2",
    ].join("\n");
    const report = validateMaterialsCsv(csv);
    expect(report.materials.find((item) => item.name === "High Value Drum")?.strictTracking).toBe(true);
    expect(report.materials.find((item) => item.name === "Reference Item")?.strictTracking).toBe(false);
  });
});

describe("offline queue", () => {
  it("drains queued commands in order and clears successful commands", async () => {
    const calls: string[] = [];
    const queue = [
      { id: "a", type: "log_materials" as const, transactions: [], queuedAt: "now" },
      { id: "b", type: "complete_task" as const, userId: "c0", taskId: "k1", periodKey: "2026-07-24", queuedAt: "now" },
    ];
    const remaining = await drainOfflineQueue(queue, {
      logMaterials: async () => { calls.push("log"); },
      completeTask: async () => { calls.push("task"); },
      saveTruckLog: async () => { calls.push("truck"); },
    });
    expect(calls).toEqual(["log", "task"]);
    expect(remaining).toEqual([]);
  });

  it("retains a failed command for retry while clearing successful ones", async () => {
    const queue = [
      { id: "a", type: "log_materials" as const, transactions: [], queuedAt: "now" },
      { id: "b", type: "complete_task" as const, userId: "c0", taskId: "k1", periodKey: "2026-07-24", queuedAt: "now" },
    ];
    const remaining = await drainOfflineQueue(queue, {
      logMaterials: async () => {},
      completeTask: async () => { throw new Error("still offline"); },
      saveTruckLog: async () => {},
    });
    expect(remaining.map((command) => command.id)).toEqual(["b"]);
  });
});

describe("reorder estimates", () => {
  it("adds 20 percent buffer, GST, freight and pallet count", () => {
    const state = createSeedState();
    const estimate = reorderEstimate(state.materials.filter((material) => material.id === "m8"), 100);
    expect(estimate.lines[0]).toMatchObject({ suggestedQty: 4, pallets: 0 });
    expect(estimate.gst).toBeCloseTo(2.476);
    expect(estimate.total).toBeCloseTo(151.996);
  });
});

describe("period keys", () => {
  it("builds Vancouver day, week and month keys", () => {
    const date = new Date("2026-07-24T15:00:00Z");
    expect(todayKey(date)).toBe("2026-07-24");
    expect(weekKey(date)).toBe("2026-07-20");
    expect(monthKey(date)).toBe("2026-M07");
    expect(periodKey("daily", date)).toBe("2026-07-24");
  });
});

describe("points engine", () => {
  it("awards daily 100 percent once and adds a 5-day streak bonus", () => {
    const state = createSeedState();
    const userId = "c0";
    const date = new Date("2026-07-24T15:00:00Z");
    const ref = todayKey(date);
    const completions = state.truckTasks
      .filter((task) => task.freq === "daily")
      .map((task) => ({ id: `tc_${task.id}`, userId, taskId: task.id, periodKey: ref, completedAt: date.toISOString() }));
    const result = evaluateDailyPoints(
      {
        ...state,
        taskCompletions: completions,
        streaks: [{ userId, count: 4, last: "2026-07-23", awardedOn: null }],
      },
      userId,
      date,
    );
    expect(dailyProgress(state.truckTasks, completions, userId, date).pct).toBe(100);
    expect(result.events.map((event) => event.points)).toEqual([25, 25]);
    expect(result.streak.count).toBe(5);
  });

  it("does not require service packing-list tasks for daily points", () => {
    const state = createSeedState();
    const userId = "c0";
    const date = new Date("2026-07-24T15:00:00Z");
    const ref = todayKey(date);
    const requiredDaily = state.truckTasks.filter((task) => task.freq === "daily" && task.requiredForDailyPoints !== false);
    const packList = state.truckTasks.filter((task) => task.timeOfDay === "pack_list");
    const completions = requiredDaily.map((task) => ({ id: `tc_${task.id}`, userId, taskId: task.id, periodKey: ref, completedAt: date.toISOString() }));
    expect(packList.length).toBeGreaterThan(0);
    expect(dailyProgress(state.truckTasks, completions, userId, date)).toMatchObject({ pct: 100, total: requiredDaily.length });
  });

  it("reverses an award when the day is uncompleted", () => {
    const state = createSeedState();
    const userId = "c0";
    const date = new Date("2026-07-24T15:00:00Z");
    const result = evaluateDailyPoints(
      {
        ...state,
        pointsEvents: [{ id: "pe1", userId, type: "daily_100", points: 25, reason: "100%", ref: "2026-07-24", ts: date.toISOString() }],
        streaks: [{ userId, count: 1, last: "2026-07-24", awardedOn: null }],
      },
      userId,
      date,
    );
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({ type: "daily_100_reversal", points: -25 });
    expect(result.streak.count).toBe(0);
  });
});

describe("monthly inventory log export", () => {
  it("exports accounting-ready usage rows for the selected month", () => {
    const state = createSeedState();
    const csv = monthlyInventoryLogCsv(state, "2026-06");
    const lines = csv.split("\n");
    expect(lines[0]).toBe('"Date","Material","Quantity","Unit","Action","Job/Site","Service","Crew Member","Unit Cost","Value"');
    expect(lines).toHaveLength(4);
    expect(csv).toContain('"2026-06-01"');
    expect(csv).toContain('"use"');
    expect(csv).not.toContain("2026-07");
  });
});
