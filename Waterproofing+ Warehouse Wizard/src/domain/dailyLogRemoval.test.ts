/**
 * Deleting a daily log, asked for on 20 November: "is it possible to edit or
 * delete daily logs if they are duplicates or contain incorrect information?"
 *
 * The duplicate case is the one with money in it. Submitting a log awards 5
 * points, and production already holds a known duplicate - David's 2 November
 * entry, filed twice 13 minutes apart. Deleting just the row would leave the
 * crew paid twice for one day and a points event pointing at a log that is no
 * longer there. 71 live points events reference a daily log this way.
 *
 * The award is reversed, not erased: the CFO reconciles off this ledger, so a
 * line that explains itself beats a line that vanished.
 */
import { describe, expect, it } from "vitest";
import { removeDailyLogEntry } from "./business";
import type { AppState, DailyLog, PointsEvent } from "../types";

const log = (id: string) => ({
  id, siteId: "s1", serviceId: "wp", date: "2026-11-02",
  workCompleted: "Sprayed", toDoNextTime: "Drain mat",
  completedByUserId: "u1", submittedByUserId: "u1", createdAt: "2026-11-03T13:00:00.000Z",
} as unknown as DailyLog);

const award = (logId: string, userId = "u1"): PointsEvent =>
  ({ id: `pe-${logId}`, userId, type: "daily_log_entry", points: 5, reason: "Daily log entry submitted", ref: `dailylog:${logId}`, ts: "2026-11-03T13:00:00.000Z" });

const stateWith = (logs: DailyLog[], events: PointsEvent[], pool = 80) =>
  ({ dailyLogs: logs, pointsEvents: events, crewPoolPoints: pool, users: [{ id: "u1", name: "David" }] } as unknown as AppState);

const NOW = "2026-11-20T18:00:00.000Z";

describe("deleting a daily log", () => {
  it("takes the entry out", () => {
    const next = removeDailyLogEntry(stateWith([log("a"), log("b")], [award("a"), award("b")]), "a", NOW);
    expect(next.dailyLogs.map((item) => item.id)).toEqual(["b"]);
  });

  it("reverses the 5 points it earned, against the person who earned them", () => {
    const next = removeDailyLogEntry(stateWith([log("a")], [award("a", "u1")]), "a", NOW);
    const reversal = next.pointsEvents.find((event) => event.ref === "dailylog-removed:a")!;
    expect(reversal.points).toBe(-5);
    expect(reversal.userId).toBe("u1");
    expect(reversal.type).toBe("manual_adjust");
    expect(reversal.reason).toBe("Daily log deleted");
  });

  it("leaves the original award in the ledger rather than erasing history", () => {
    const next = removeDailyLogEntry(stateWith([log("a")], [award("a")]), "a", NOW);
    expect(next.pointsEvents.some((event) => event.ref === "dailylog:a")).toBe(true);
    expect(next.pointsEvents).toHaveLength(2);
  });

  it("nets to zero for that log, so the duplicate costs nothing once removed", () => {
    const next = removeDailyLogEntry(stateWith([log("a")], [award("a")]), "a", NOW);
    const forLog = next.pointsEvents.filter((event) => event.ref.endsWith(":a"));
    expect(forLog.reduce((sum, event) => sum + event.points, 0)).toBe(0);
  });

  it("does not charge twice when a delete is retried", () => {
    const once = removeDailyLogEntry(stateWith([log("a")], [award("a")]), "a", NOW);
    const twice = removeDailyLogEntry({ ...once, dailyLogs: [log("a")] } as AppState, "a", NOW);
    expect(twice.pointsEvents.filter((event) => event.ref === "dailylog-removed:a")).toHaveLength(1);
    expect(twice.dailyLogs).toEqual([]);
  });

  it("takes the points back out of the crew pool when that is where they went", () => {
    // creditOrPool sends the award to the pool when the person has left.
    const next = removeDailyLogEntry(stateWith([log("a")], [], 80), "a", NOW);
    expect(next.crewPoolPoints).toBe(75);
    expect(next.pointsEvents).toEqual([]);
  });

  it("never drives the crew pool negative", () => {
    const next = removeDailyLogEntry(stateWith([log("a")], [], 2), "a", NOW);
    expect(next.crewPoolPoints).toBe(0);
  });

  it("does nothing at all for a log that is not there", () => {
    const state = stateWith([log("a")], [award("a")]);
    expect(removeDailyLogEntry(state, "missing", NOW)).toBe(state);
  });

  it("leaves other logs' points alone", () => {
    const next = removeDailyLogEntry(stateWith([log("a"), log("b")], [award("a"), award("b")]), "a", NOW);
    expect(next.pointsEvents.filter((event) => event.ref === "dailylog-removed:b")).toEqual([]);
  });
});
