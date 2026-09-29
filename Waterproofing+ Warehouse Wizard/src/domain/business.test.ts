import { describe, expect, it } from "vitest";
import type { ServiceId } from "../types";
import { drainOfflineQueue } from "../data/offline";
import { validateMaterialsCsv } from "../data/csvImport";
import { createSeedState } from "../data/seed";
import {
  applyTransactions,
  applyTruckLog,
  combineDateWithNow,
  formatDate,
  addDays,
  canSeePrices,
  isCrewWorkDay,
  loadInProgress,
  nextLoadInDate,
  weekdayOf,
  materialsForService,
  formatDateTime,
  loginEmailFor,
  creditOrPool,
  dailyProgress,
  evaluateDailyPoints,
  isKmEntryTask,
  monthlyInventoryLogCsv,
  monthKey,
  periodKey,
  reorderEstimate,
  setExactCountDelta,
  signedQuantity,
  stockStatus,
  resolveNeedsReviewTransaction,
  submitDailyLog,
  submitMaintenanceRequest,
  todayKey,
  weekKey,
} from "./business";

describe("canSeePrices", () => {
  it("never shows the crew a price", () => {
    // The client's standing rule, and the one worth a test of its own.
    expect(canSeePrices("crew")).toBe(false);
  });

  it("shows finance the numbers it exists to read", () => {
    expect(canSeePrices("cfo")).toBe(true);
  });

  it("shows admins and managers", () => {
    expect(canSeePrices("admin")).toBe(true);
    expect(canSeePrices("manager")).toBe(true);
  });

  it("refuses anything it does not recognise", () => {
    expect(canSeePrices("")).toBe(false);
    expect(canSeePrices("contractor")).toBe(false);
  });
});

describe("load-in scheduling", () => {
  it("adds calendar days without a timezone getting involved", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("steps over the November DST change cleanly", () => {
    // Vancouver leaves daylight time on 2026-11-01. Adding 24 hours to a Date
    // lands on the wrong day here; shifting the calendar day does not.
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02");
  });

  it("knows the crew work Monday to Saturday", () => {
    expect(weekdayOf("2026-10-04")).toBe(0);           // Sunday
    expect(isCrewWorkDay("2026-10-04")).toBe(false);
    expect(isCrewWorkDay("2026-10-03")).toBe(true);    // Saturday
    expect(isCrewWorkDay("2026-10-05")).toBe(true);    // Monday
  });

  it("skips the Saturday-night list, because nobody works Sunday", () => {
    // Friday evening -> Saturday morning
    expect(nextLoadInDate("2026-10-02")).toBe("2026-10-03");
    // Saturday evening -> Monday, not Sunday
    expect(nextLoadInDate("2026-10-03")).toBe("2026-10-05");
    // Sunday evening -> Monday
    expect(nextLoadInDate("2026-10-04")).toBe("2026-10-05");
  });

  it("counts what is loaded", () => {
    expect(loadInProgress([])).toEqual({ done: 0, total: 0, pct: 0, complete: false });
    expect(loadInProgress([{ doneAt: "x" }, {}])).toEqual({ done: 1, total: 2, pct: 50, complete: false });
    expect(loadInProgress([{ doneAt: "x" }, { doneAt: "y" }])).toEqual({ done: 2, total: 2, pct: 100, complete: true });
  });
});

describe("materialsForService", () => {
  const list = [
    { id: "a", serviceIds: ["wp"] as const },
    { id: "b", serviceIds: ["ins"] as const },
    { id: "c", serviceIds: ["wp", "ins"] as const },
    { id: "d" },
  ].map((m) => ({ ...m, serviceIds: m.serviceIds ? [...m.serviceIds] : undefined }));

  it("shows the items that service uses", () => {
    expect(materialsForService(list, "wp").map((m) => m.id)).toEqual(["a", "c", "d"]);
    expect(materialsForService(list, "ins").map((m) => m.id)).toEqual(["b", "c", "d"]);
  });

  it("keeps an unmapped material visible on every service", () => {
    // "d" has no service, so it must never vanish - PPE and consumables sit
    // here until someone assigns them.
    expect(materialsForService(list, "wp").map((m) => m.id)).toContain("d");
    expect(materialsForService(list, "trf").map((m) => m.id)).toContain("d");
  });

  it("keeps Caulking separate from the waterproofing trades", () => {
    // Caulking was missing from the app for months while being the second
    // busiest service on the client's own sheet, so its materials were
    // visible everywhere. A caulking crew should now get the caulking gun
    // items and the shared supplies, not the drain mat.
    const trades = [
      { id: "cws", serviceIds: ["clk"] },
      { id: "dymonic", serviceIds: ["clk", "wp"] },
      { id: "drainmat", serviceIds: ["wp"] },
      { id: "gloves" },
    ];
    expect(materialsForService(trades, "clk").map((m) => m.id)).toEqual(["cws", "dymonic", "gloves"]);
    expect(materialsForService(trades, "wp").map((m) => m.id)).toEqual(["dymonic", "drainmat", "gloves"]);
  });

  it("falls back to everything when nothing is mapped to that service", () => {
    // Better a long list than an empty one while the mapping is half filled.
    expect(materialsForService(list, "trf")).toHaveLength(4);
  });

  it("falls back to everything when nothing is mapped at all", () => {
    const none: Array<{ id: string; serviceIds?: ServiceId[] }> = [{ id: "x" }, { id: "y" }];
    expect(materialsForService(none, "wp")).toHaveLength(2);
  });
});

describe("formatDateTime", () => {
  it("adds the clock time to the date", () => {
    // 20:30 UTC is 1:30pm in Vancouver on the same day.
    expect(formatDateTime("2026-09-29T20:30:00Z")).toBe("09/29/2026 1:30 PM");
  });

  it("uses Vancouver time, so a late delivery is not filed tomorrow", () => {
    // 00:30 UTC on the 30th is still 5:30pm on the 29th in Vancouver.
    expect(formatDateTime("2026-09-30T00:30:00Z")).toBe("09/29/2026 5:30 PM");
  });

  it("gives nothing back for nothing", () => {
    expect(formatDateTime(undefined)).toBe("");
    expect(formatDateTime("not a date")).toBe("");
  });
});

describe("loginEmailFor", () => {
  it("turns a username from the sheet into the account address", () => {
    expect(loginEmailFor("jrogers")).toBe("jrogers@vanislecoatings.com");
  });

  it("strips a pasted space, which otherwise reads as a wrong password", () => {
    expect(loginEmailFor("  jrogers ")).toBe("jrogers@vanislecoatings.com");
  });

  it("lowercases what a phone keyboard capitalised", () => {
    expect(loginEmailFor("JRogers")).toBe("jrogers@vanislecoatings.com");
  });

  it("leaves a full address alone", () => {
    expect(loginEmailFor("ops@vanislecoatings.com")).toBe("ops@vanislecoatings.com");
    expect(loginEmailFor("someone@gmail.com")).toBe("someone@gmail.com");
  });

  it("gives nothing back for nothing", () => {
    expect(loginEmailFor("")).toBe("");
    expect(loginEmailFor("   ")).toBe("");
  });
});

describe("formatDate", () => {
  it("shows a calendar date as month/day/year", () => {
    expect(formatDate("2026-09-28")).toBe("09/28/2026");
  });

  it("does not shift a calendar date by a timezone", () => {
    // "2026-09-28" has no instant in it. Passing it through Date would make it
    // UTC midnight, which is the 27th in Vancouver - the bug that filed truck
    // logs against the wrong day. It must read the same in every zone.
    expect(formatDate("2026-01-01")).toBe("01/01/2026");
    expect(formatDate("2026-12-31")).toBe("12/31/2026");
  });

  it("formats a timestamp in Vancouver time, not UTC", () => {
    // 00:30 UTC on the 29th is still the evening of the 28th in Vancouver.
    expect(formatDate("2026-09-29T00:30:00Z")).toBe("09/28/2026");
  });

  it("returns an empty string for nothing and for junk", () => {
    expect(formatDate(undefined)).toBe("");
    expect(formatDate(null)).toBe("");
    expect(formatDate("")).toBe("");
    expect(formatDate("not a date")).toBe("");
  });
});

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

describe("backdated log entries", () => {
  it("combines a chosen date with the current wall-clock time, regardless of the caller's timezone", () => {
    const now = new Date("2026-08-30T21:14:07.500Z");
    const combined = combineDateWithNow("2026-08-28", now);
    // The calendar date must be exactly what was picked - never shifted by
    // the caller's local timezone, which is the bug this guards against.
    expect(combined.slice(0, 10)).toBe("2026-08-28");
    // The local wall-clock hour is carried over as-is (not timezone-converted).
    expect(new Date(combined).getUTCHours()).toBe(now.getHours());
  });

  it("falls back to now when no date is chosen", () => {
    const now = new Date("2026-08-30T21:14:07.500Z");
    expect(combineDateWithNow(undefined, now)).toBe(now.toISOString());
  });

  it("identifies the ending-KM daily vehicle task by text", () => {
    expect(isKmEntryTask({ freq: "daily", serviceId: "veh", text: "Record ending KM" })).toBe(true);
    expect(isKmEntryTask({ freq: "weekly", serviceId: "veh", text: "Record ending KM" })).toBe(false);
    expect(isKmEntryTask({ freq: "daily", serviceId: "wp", text: "Record ending KM" })).toBe(false);
    expect(isKmEntryTask({ freq: "daily", serviceId: "veh", text: "Check tire pressure" })).toBe(false);
  });
});

describe("maintenance requests", () => {
  it("accepts an optional deadline alongside the submitted date", () => {
    const state = createSeedState();
    const result = submitMaintenanceRequest(state, "c0", "truck", "tr1", "Ford F150", "Brake noise", "2026-09-05", "2026-08-28T12:00:00.000Z");
    const request = result.maintenanceRequests[0];
    expect(request.requestedAt).toBe("2026-08-28T12:00:00.000Z");
    expect(request.deadlineAt).toBe("2026-09-05");
  });

  it("leaves deadline unset when none is given", () => {
    const state = createSeedState();
    const result = submitMaintenanceRequest(state, "c0", "truck", "tr1", "Ford F150", "Brake noise");
    expect(result.maintenanceRequests[0].deadlineAt).toBeUndefined();
  });
});

describe("daily log", () => {
  it("submits a daily log entry and credits the completing crew member 5 points", () => {
    const state = createSeedState();
    const before = state.pointsEvents.length;
    const result = submitDailyLog(state, "c0", {
      siteId: "s1",
      serviceId: "wp",
      date: "2026-09-04",
      workCompleted: "Applied base coat to section A",
      toDoNextTime: "Finish section B",
      completedByUserId: "c0",
      submittedByUserId: "c0",
    });
    expect(result.dailyLogs).toHaveLength(1);
    expect(result.dailyLogs[0]).toMatchObject({ siteId: "s1", workCompleted: "Applied base coat to section A", completedByUserId: "c0" });
    expect(result.pointsEvents).toHaveLength(before + 1);
    expect(result.pointsEvents[0]).toMatchObject({ userId: "c0", points: 5, type: "daily_log_entry" });
    expect(result.crewPoolPoints).toBe(0);
  });

  it("rejects a submission missing required narrative fields", () => {
    const state = createSeedState();
    const result = submitDailyLog(state, "c0", {
      siteId: "s1",
      serviceId: "wp",
      date: "2026-09-04",
      workCompleted: "",
      toDoNextTime: "Finish section B",
      completedByUserId: "c0",
      submittedByUserId: "c0",
    });
    expect(result).toBe(state);
    expect(result.dailyLogs).toHaveLength(0);
  });

  it("routes points to the crew pool instead of an individual when they've departed", () => {
    let state = createSeedState();
    state = { ...state, users: state.users.map((user) => (user.id === "c0" ? { ...user, status: "Inactive" as const } : user)) };
    const result = creditOrPool(state, "c0", 5, "test", "ref:1");
    expect(result.crewPoolPoints).toBe(5);
    expect(result.pointsEvents).toHaveLength(state.pointsEvents.length);
  });
});

describe("needs-review transactions", () => {
  it("resolves a needs-review transaction and applies the stock delta for the first time", () => {
    let state = createSeedState();
    const material = state.materials.find((item) => item.id === "m1")!;
    const before = material.qty;
    state = {
      ...state,
      transactions: [{ id: "txr1", qty: 0, type: "use", userId: "c0", ts: "2026-08-05T00:00:00Z", needsReview: true, rawItemText: "2 d100", rawQtyText: "2" }, ...state.transactions],
    };
    const result = resolveNeedsReviewTransaction(state, "txr1", material.id, 2);
    const resolved = result.transactions.find((item) => item.id === "txr1")!;
    expect(resolved.needsReview).toBe(false);
    expect(resolved.materialId).toBe(material.id);
    expect(result.materials.find((item) => item.id === material.id)?.qty).toBe(Math.max(0, before - 2));
  });

  it("ignores a resolve attempt on a transaction that isn't flagged for review", () => {
    const state = createSeedState();
    const clean = state.transactions[0];
    const result = resolveNeedsReviewTransaction(state, clean.id, "m1", 5);
    expect(result).toBe(state);
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

  it("flags materials as Tremco from a Vendor column and preserves the flag when the column is absent", () => {
    const csv = [
      "Inventory,Category,Unit (locked),Vendor,Unit Cost ($),On Hand (current quantity),Reorder At (3 remaining in inventory),Warehouse Location",
      "TREMDrain 6000X,Waterproofing,Roll,Tremco,$264.26,12,3,Yard 2",
      "T50 staples,Waterproofing,Box,RONA,$16.19,1,3,A1",
    ].join("\n");
    const first = validateMaterialsCsv(csv, []);
    expect(first.materials.find((m) => m.name === "TREMDrain 6000X")?.isTremco).toBe(true);
    expect(first.materials.find((m) => m.name === "T50 staples")?.isTremco).toBe(false);

    const reimportCsvWithoutVendor = [
      "Inventory,Category,Unit (locked),Unit Cost ($),On Hand (current quantity),Reorder At (3 remaining in inventory),Warehouse Location",
      "TREMDrain 6000X,Waterproofing,Roll,$288.57,12,3,Yard 2",
    ].join("\n");
    const second = validateMaterialsCsv(reimportCsvWithoutVendor, first.materials);
    expect(second.materials[0].isTremco).toBe(true);
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
      saveDailyLog: async () => { calls.push("daily"); },
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
      saveDailyLog: async () => {},
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

describe("daily period keys use Vancouver time, not UTC", () => {
  it("still reads as the same day after 5pm Pacific, when UTC has rolled over", () => {
    // 2026-09-24 18:30 Pacific (PDT, UTC-7) is already 2026-09-25 in UTC.
    // A truck log submitted at the end of a shift used to auto-complete its tasks
    // under the UTC date, so they were filed against tomorrow and the UI - which
    // asks todayKey() - still showed them outstanding.
    const evening = new Date("2026-09-25T01:30:00Z");
    expect(evening.toISOString().slice(0, 10)).toBe("2026-09-25");
    expect(todayKey(evening)).toBe("2026-09-24");
  });

  it("agrees with UTC during the working day", () => {
    const midday = new Date("2026-09-24T19:00:00Z"); // 12:00 Pacific
    expect(todayKey(midday)).toBe("2026-09-24");
  });

  it("keys a daily task to the same Vancouver day all evening", () => {
    const beforeFive = new Date("2026-09-24T23:00:00Z"); // 16:00 Pacific
    const afterFive = new Date("2026-09-25T02:00:00Z");  // 19:00 Pacific
    expect(periodKey("daily", beforeFive)).toBe(periodKey("daily", afterFive));
  });
});
