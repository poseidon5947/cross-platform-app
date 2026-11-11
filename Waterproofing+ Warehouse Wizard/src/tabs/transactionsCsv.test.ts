/**
 * The CFO reconciles from this file. Downloading it from the live tool showed
 * a value of 4974.2699999999995 where 1658.09 x 3 belongs, and a raw ISO
 * timestamp in the Date column, while the monthly log beside it was already
 * trimming the date and fixing money to two places.
 */
import { describe, expect, it } from "vitest";
import { transactionsCsv } from "./CfoTabBoundary";
import type { AppState } from "../types";

const state = {
  materials: [{ id: "m1", name: "TREMPROOF AMPHIBIA", unit: "Roll", cost: 1658.09, step: 0.25 }],
  sites: [{ id: "s1", name: "Kinetic - Duncan" }],
  services: [{ id: "wp", name: "Waterproofing" }],
  users: [{ id: "u1", name: "Tara" }],
  transactions: [{ id: "t1", ts: "2026-11-06T13:23:05.909+00:00", materialId: "m1", qty: 3, type: "use", siteId: "s1", serviceId: "wp", userId: "u1" }],
} as unknown as AppState;

const cells = (line: string) => line.split('","').map((c) => c.replace(/^"|"$/g, ""));

describe("the transactions export the CFO reconciles from", () => {
  it("carries money to two places instead of a float remainder", () => {
    const row = cells(transactionsCsv(state).split("\n")[1]);
    expect(row[9]).toBe("4974.27");
    expect(row[8]).toBe("1658.09");
  });

  it("gives the date alone, not an ISO timestamp", () => {
    const row = cells(transactionsCsv(state).split("\n")[1]);
    expect(row[0]).toBe("2026-11-06");
  });

  it("still names the column order the file is read by", () => {
    expect(transactionsCsv(state).split("\n")[0])
      .toBe("Date,Material,Action,Site,Service,Crew,Qty,Unit,UnitCost,Value,Status");
  });
});
