/**
 * Archiving a job, asked for by the client on 19 November.
 *
 * The Jobs tab split Active from Past on the end date, which only sorts a job
 * somebody remembered to date: 39 of the 43 live jobs have no end date, so
 * "Active jobs" was every job ever opened and so was every Job dropdown the
 * crew pick from - "a. Travel Time" and "z. Crew Time Off" included.
 *
 * `active` was already on the row and already read by `siteFromRow`; nothing
 * ever set it or looked at it. These tests pin the two halves of the rule:
 * an archived job leaves the lists people choose from, and it stays reachable
 * everywhere its name is already recorded.
 */
import { describe, expect, it } from "vitest";
import { jobChoices, jobIsArchived, onFleet, unarchivedJobs } from "./business";
import type { Site, Truck } from "../types";

const site = (over: Partial<Site> & { id: string }) =>
  ({ name: over.id, address: "", source: "manual", ...over } as Site);

const live = site({ id: "live" });
const travel = site({ id: "travel", name: "a. Travel Time", active: false });
const finished = site({ id: "finished", active: false });

describe("archiving a job", () => {
  it("treats only an explicit false as archived, so an older row without the column stays live", () => {
    expect(jobIsArchived(site({ id: "a" }))).toBe(false);
    expect(jobIsArchived(site({ id: "b", active: true }))).toBe(false);
    expect(jobIsArchived(site({ id: "c", active: false }))).toBe(true);
  });

  it("drops archived jobs out of the list a picker offers", () => {
    expect(unarchivedJobs([live, travel, finished]).map((item) => item.id)).toEqual(["live"]);
  });

  it("keeps the job that is already chosen, even once it is archived", () => {
    // A tool signed out to a job that was archived afterwards. Dropping it
    // would leave the select blank over a value that is still set.
    expect(jobChoices([live, finished], "finished").map((item) => item.id)).toEqual(["live", "finished"]);
    // ...and only that one.
    expect(jobChoices([live, travel, finished], "finished").map((item) => item.id)).toEqual(["live", "finished"]);
  });

  it("offers nothing extra when what is chosen is a live job", () => {
    expect(jobChoices([live, finished], "live").map((item) => item.id)).toEqual(["live"]);
  });

  it("does not archive anything by itself when no job is chosen yet", () => {
    expect(jobChoices([live, finished], undefined).map((item) => item.id)).toEqual(["live"]);
  });

  it("never removes a job from the underlying list, so past logs can still name it", () => {
    const sites = [live, travel, finished];
    unarchivedJobs(sites);
    jobChoices(sites, "live");
    expect(sites.map((item) => item.id)).toEqual(["live", "travel", "finished"]);
  });
});

/**
 * The same rule for vehicles, which had the same gap: the F150 was marked
 * inactive on 19 November when its plate moved to the Maverick, and stayed in
 * the Fleet list anyway because nothing read the flag.
 */
describe("a retired vehicle", () => {
  const truck = (over: Partial<Truck> & { id: string }) => ({ name: over.id, km: 0, ...over } as Truck);
  const maverick = truck({ id: "t106", name: "Ford Maverick (2026)" });
  const f150 = truck({ id: "f150", name: "Ford F150 (2011)", active: false });

  it("is off the fleet list", () => {
    expect(onFleet([maverick, f150]).map((item) => item.id)).toEqual(["t106"]);
  });

  it("is still shown on a log that was already pointing at it", () => {
    expect(onFleet([maverick, f150], "f150").map((item) => item.id)).toEqual(["t106", "f150"]);
  });

  it("leaves a vehicle with no flag at all in the fleet", () => {
    expect(onFleet([truck({ id: "t101" })]).map((item) => item.id)).toEqual(["t101"]);
  });
});
