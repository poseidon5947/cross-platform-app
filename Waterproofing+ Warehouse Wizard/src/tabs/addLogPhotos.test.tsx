// @vitest-environment jsdom
/**
 * Adding photos to a log that already exists.
 *
 * Jesse Dares, Crew Lead, 24 November: "I tried uploading photos, but the
 * system won't let me. There's no upload progress bar on the screen and when
 * I complete the log it shows no photos uploaded. Jon tried on his phone too."
 *
 * The 20 November work made the uploads concurrent and gave them a banner, and
 * it did work - a photo went up successfully at 05:46 that same morning. What
 * was left was the failure path, and it had no floor under it:
 *
 *   - the upload only started once the log row came back from the server, so
 *     on a weak signal there was a long silent stretch with no banner at all;
 *   - if that insert failed the log was queued and the files were dropped in
 *     silence, because the queue is JSON in localStorage and a File does not
 *     survive it;
 *   - and nothing, at any access level, could attach a photo to a log that
 *     already existed - the edit form has no photo field - so the app's own
 *     advice to "add them again" was impossible to follow, and re-submitting
 *     the whole log to carry the photos is what put duplicates in the data.
 *
 * The database was never the problem: daily_log_media's insert policy is
 * `uploaded_by = auth.uid()`, so the person who did the work has always been
 * allowed to attach to their own log. Only the screen was missing.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DailyLogDetail } from "./OperationsTabBoundary";
import type { AppState, DailyLog, User } from "../types";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const jesse = { id: "u-jesse", name: "Jesse", role: "crew" } as unknown as User;
const admin = { id: "u-pm", name: "David Holloway", role: "admin" } as unknown as User;

const log = {
  id: "dl-1", siteId: "s1", serviceId: "wp", date: "2026-11-24",
  workCompleted: "Sprayed north, west, and south walls", toDoNextTime: "Drain mat",
  completedByUserId: jesse.id, submittedByUserId: jesse.id, createdAt: "2026-11-24T20:06:00Z",
} as unknown as DailyLog;

const state = {
  materials: [], transactions: [], tools: [], trucks: [], users: [jesse, admin],
  sites: [{ id: "s1", name: "Kinetic Design-build Ltd:Discovery Street KDB-Waterproofing" }],
  services: [{ id: "wp", name: "Waterproofing" }],
  dailyLogs: [log], dailyLogMedia: [], pointsEvents: [],
} as unknown as AppState;

let host: HTMLDivElement; let root: Root; let added: Array<[string, string[]]>;

beforeEach(() => {
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); added = [];
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

const render = (role: string, withHandler = true) => {
  act(() => root.render(
    <DailyLogDetail
      state={state} log={log} role={role as never}
      addDailyLogPhotos={withHandler ? (id, files) => added.push([id, files.map((f) => f.name)]) : undefined}
    />,
  ));
  return host.textContent ?? "";
};

const picker = () => host.querySelector('input[type="file"]') as HTMLInputElement | null;

const pick = (names: string[]) => {
  const input = picker();
  if (!input) throw new Error("no file picker on the log");
  const files = names.map((n) => new File(["x"], n, { type: "image/jpeg" }));
  Object.defineProperty(input, "files", { value: files, configurable: true });
  act(() => { input.dispatchEvent(new Event("change", { bubbles: true })); });
};

describe("a log with no photos on it", () => {
  it("offers a way to add them", () => {
    const text = render("crew");
    expect(text).toContain("Nothing attached to this log.");
    expect(text).toContain("Add photos");
    expect(picker()).not.toBeNull();
  });

  it("hands the files up against that log", () => {
    render("crew");
    pick(["north-wall.jpg", "south-wall.jpg"]);
    expect(added).toEqual([["dl-1", ["north-wall.jpg", "south-wall.jpg"]]]);
  });

  it("lets the crew member who did the work fix their own log", () => {
    // The whole point: Jesse should not have to find a manager for this.
    render(jesse.role as string);
    pick(["retry.jpg"]);
    expect(added).toHaveLength(1);
  });

  it("works for the PM too", () => {
    render(admin.role as string);
    pick(["pm.jpg"]);
    expect(added).toEqual([["dl-1", ["pm.jpg"]]]);
  });

  it("tells people to stay on the screen, which is what actually loses photos", () => {
    expect(render("crew")).toContain("Stay on this screen until the banner at the top clears");
  });
});

describe("when no handler is supplied", () => {
  it("shows no picker at all rather than a dead control", () => {
    render("crew", false);
    expect(picker()).toBeNull();
    expect(host.textContent).not.toContain("Add photos");
  });
});

describe("picking nothing", () => {
  it("does not call out with an empty list", () => {
    render("crew");
    const input = picker()!;
    Object.defineProperty(input, "files", { value: [], configurable: true });
    act(() => { input.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(added).toEqual([]);
  });
});
