/**
 * Opening a submitted daily log and seeing what is in it, asked for by the
 * client on 20 November: "I can see that the report was created, but I cannot
 * see the specific details he entered."
 *
 * The materials are the part with no foreign key to follow - they are matched
 * back to the log by job, service and calendar day. These pin that the match
 * is narrow enough not to borrow another crew's lines.
 */
import { describe, expect, it } from "vitest";
import { materialsUsedOnLog } from "./business";
import type { DailyLog, Transaction } from "../types";

const log = { siteId: "s1", serviceId: "wp", date: "2026-11-19" } as unknown as DailyLog;
const tx = (over: Partial<Transaction> & { id: string }) =>
  ({ siteId: "s1", serviceId: "wp", ts: "2026-11-19T20:06:17.000Z", qty: 1, type: "use", userId: "u1", ...over } as Transaction);

describe("the materials on a daily log", () => {
  it("picks up the lines written with it", () => {
    const lines = [tx({ id: "a" }), tx({ id: "b" })];
    expect(materialsUsedOnLog(lines, log).map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("ignores the same job on another day", () => {
    const lines = [tx({ id: "a" }), tx({ id: "old", ts: "2026-11-18T20:06:17.000Z" })];
    expect(materialsUsedOnLog(lines, log).map((item) => item.id)).toEqual(["a"]);
  });

  it("ignores another job on the same day", () => {
    const lines = [tx({ id: "a" }), tx({ id: "other", siteId: "s2" })];
    expect(materialsUsedOnLog(lines, log).map((item) => item.id)).toEqual(["a"]);
  });

  it("does not cross two services logged on one job on one day", () => {
    // A crew can caulk and waterproof the same site the same day, and each
    // log must show only its own lines.
    const lines = [tx({ id: "wp" }), tx({ id: "clk", serviceId: "clk" })];
    expect(materialsUsedOnLog(lines, log).map((item) => item.id)).toEqual(["wp"]);
  });

  it("matches a back-dated log, because the line carries the date that was picked", () => {
    const backdated = { siteId: "s1", serviceId: "wp", date: "2026-10-20" } as unknown as DailyLog;
    const lines = [tx({ id: "back", ts: "2026-10-20T14:02:00.000Z" })];
    expect(materialsUsedOnLog(lines, backdated).map((item) => item.id)).toEqual(["back"]);
  });

  it("skips a line with no job, service or timestamp rather than guessing", () => {
    const lines = [
      tx({ id: "keep" }),
      tx({ id: "nosite", siteId: undefined }),
      tx({ id: "nosvc", serviceId: undefined }),
      tx({ id: "nots", ts: undefined as unknown as string }),
    ];
    expect(materialsUsedOnLog(lines, log).map((item) => item.id)).toEqual(["keep"]);
  });

  it("returns nothing rather than everything when the log has no lines", () => {
    expect(materialsUsedOnLog([tx({ id: "other", siteId: "s9" })], log)).toEqual([]);
  });
});
