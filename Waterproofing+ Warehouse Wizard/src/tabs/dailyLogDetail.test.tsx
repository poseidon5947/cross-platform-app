// @vitest-environment jsdom
/**
 * The full daily log, asked for by the client on 20 November: "I can see that
 * the report was created, but I cannot see the specific details he entered
 * (such as materials used or next steps)."
 *
 * The list only ever showed job, date, who, and one line of work completed, so
 * "to do next time" - which the crew are *required* to fill in - was written
 * every day and read by nobody.
 *
 * The assertion that matters is the third one: a field the crew left blank has
 * to say so. Rendering nothing for an empty field reproduces her complaint
 * exactly, because she still cannot tell whether he skipped it or the app is
 * hiding it.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AllDailyLogPhotos, DailyLogDetail } from "./OperationsTabBoundary";
import type { AppState, DailyLog } from "../types";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const log = {
  id: "log1", siteId: "s1", serviceId: "wp", date: "2026-11-19",
  materialsInstalled: "952", workCompleted: "Sprayed the east wall",
  challenges: "", weather: undefined, toDoNextTime: "Drain mat the areas sprayed today",
  completedByUserId: "u2", submittedByUserId: "u2", createdAt: "2026-11-19T20:06:17.000Z",
} as unknown as DailyLog;

const state = {
  sites: [{ id: "s1", name: "Knappett - 2550 Quadra" }],
  services: [{ id: "wp", name: "Waterproofing", short: "WP" }],
  users: [{ id: "u2", name: "Jesse Dares" }],
  materials: [{ id: "m1", name: "TremProof 260", unit: "Pail" }],
  transactions: [
    { id: "t1", materialId: "m1", qty: 3, type: "use", siteId: "s1", serviceId: "wp", userId: "u2", ts: "2026-11-19T20:06:17.000Z" },
    { id: "t2", materialId: "m1", qty: 9, type: "use", siteId: "s2", serviceId: "wp", userId: "u2", ts: "2026-11-19T20:06:17.000Z" },
  ],
  dailyLogMedia: [{ id: "md1", dailyLogId: "log1", kind: "photo", storageKey: "daily-logs/log1/a.jpg" }],
} as unknown as AppState;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => { root.unmount(); });
  host.remove();
});

function render(over: Partial<DailyLog> = {}) {
  act(() => { root.render(<DailyLogDetail state={state} log={{ ...log, ...over }} role="admin" />); });
  const labels = [...host.querySelectorAll("label.fld")].map((node) => node.textContent);
  const valueFor = (label: string) => {
    const node = [...host.querySelectorAll("label.fld")].find((item) => item.textContent === label);
    return node?.nextElementSibling?.textContent ?? null;
  };
  return { text: host.textContent ?? "", labels, valueFor };
}

describe("opening a submitted daily log", () => {
  it("shows every field the form asks for", () => {
    const { labels } = render();
    expect(labels).toEqual([
      "Quantity of materials installed",
      "Work completed",
      "Challenges",
      "Weather",
      "To do next time",
    ]);
  });

  it("shows what the crew actually wrote, including to-do next time", () => {
    const { valueFor } = render();
    expect(valueFor("Work completed")).toBe("Sprayed the east wall");
    expect(valueFor("To do next time")).toBe("Drain mat the areas sprayed today");
    expect(valueFor("Quantity of materials installed")).toBe("952");
  });

  it("says a blank field is blank rather than leaving it out", () => {
    const { valueFor } = render();
    expect(valueFor("Challenges")).toBe("Not entered");
    expect(valueFor("Weather")).toBe("Not entered");
  });

  it("treats whitespace as blank too", () => {
    expect(render({ challenges: "   " }).valueFor("Challenges")).toBe("Not entered");
  });

  it("lists the materials recorded against this log and no others", () => {
    // t2 is the same product and day on a DIFFERENT job, so its qty of 9 must
    // not appear. Asserted on the quantity cells, not the page text, because
    // "9" is also in the date.
    const { text } = render();
    expect(text).toContain("TremProof 260");
    const quantities = [...host.querySelectorAll(".qty")].map((node) => node.textContent);
    expect(quantities).toEqual(["3"]);
  });

  it("names who completed it", () => {
    expect(render().text).toContain("Jesse Dares");
  });

  it("says plainly when nothing was attached", () => {
    const { text } = render();
    expect(text).not.toContain("Nothing attached to this log.");
    act(() => {
      root.render(<DailyLogDetail state={{ ...state, dailyLogMedia: [] } as unknown as AppState} log={log} role="admin" />);
    });
    expect(host.textContent).toContain("Nothing attached to this log.");
  });

  it("says plainly when no materials were recorded", () => {
    act(() => {
      root.render(<DailyLogDetail state={{ ...state, transactions: [] } as unknown as AppState} log={log} role="admin" />);
    });
    expect(host.textContent).toContain("No material lines were recorded against this log.");
  });
});

/**
 * Editing and deleting, added 20 November. The one that matters is that a crew
 * member is never offered either: `updateDailyLog` throws "only a manager can
 * change a daily log" on an empty result, so a crew tap would patch the list
 * on screen and then fail against the database.
 */
describe("editing and deleting a log", () => {
  const noop = () => {};
  const asRole = (role: "admin" | "crew") => {
    act(() => {
      root.render(<DailyLogDetail state={state} log={log} role={role}
        editDailyLog={noop} removeDailyLog={noop} openSheet={noop} />);
    });
    return [...host.querySelectorAll("button")].map((node) => node.textContent);
  };

  it("offers both to a manager", () => {
    const labels = asRole("admin");
    expect(labels).toContain("Edit this log");
    expect(labels).toContain("Delete this log");
  });

  it("offers neither to a crew member", () => {
    const labels = asRole("crew");
    expect(labels).not.toContain("Edit this log");
    expect(labels).not.toContain("Delete this log");
  });

  it("asks before deleting, and says what else goes with it", () => {
    const removed: string[] = [];
    act(() => {
      root.render(<DailyLogDetail state={state} log={log} role="admin"
        removeDailyLog={(id) => removed.push(id)} openSheet={noop} />);
    });
    const del = [...host.querySelectorAll("button")].find((node) => node.textContent === "Delete this log")!;
    act(() => { del.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    expect(removed).toEqual([]);
    expect(host.textContent).toContain("takes back the 5 points");
    expect(host.textContent).toContain("deletes 1 photo attached to it");

    const yes = [...host.querySelectorAll("button")].find((node) => node.textContent === "Yes, delete this log")!;
    act(() => { yes.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    expect(removed).toEqual(["log1"]);
  });

  it("can be backed out of", () => {
    const removed: string[] = [];
    act(() => {
      root.render(<DailyLogDetail state={state} log={log} role="admin"
        removeDailyLog={(id) => removed.push(id)} openSheet={noop} />);
    });
    const click = (label: string) => {
      const node = [...host.querySelectorAll("button")].find((item) => item.textContent === label)!;
      act(() => { node.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    };
    click("Delete this log");
    click("Keep it");
    expect(host.textContent).not.toContain("takes back the 5 points");
    expect(removed).toEqual([]);
  });
});

/**
 * Every photo in one place, asked for on 20 November: "access all pictures
 * that have been submitted through the daily logs in one folder, without
 * having to go through each individual daily log".
 */
describe("all daily log photos", () => {
  const galleryState = {
    ...state,
    dailyLogs: [
      { ...log, id: "log1", date: "2026-11-19" },
      { ...log, id: "log2", date: "2026-11-20", siteId: "s1" },
    ],
    dailyLogMedia: [
      { id: "m-old", dailyLogId: "log1", kind: "photo", storageKey: "a.jpg" },
      { id: "m-new", dailyLogId: "log2", kind: "photo", storageKey: "b.jpg" },
      { id: "m-orphan", dailyLogId: "gone", kind: "photo", storageKey: "c.jpg" },
    ],
  } as unknown as AppState;

  const renderGallery = (over?: AppState) => {
    act(() => { root.render(<AllDailyLogPhotos state={over ?? galleryState} />); });
    return host.textContent ?? "";
  };

  it("counts the files and the logs they came from, ignoring a deleted log's leftovers", () => {
    expect(renderGallery()).toContain("2 files across 2 logs");
  });

  it("labels each file with its job and date, so the list is searchable", () => {
    const text = renderGallery();
    expect(text).toContain("Knappett - 2550 Quadra");
    expect(text).toContain("11/20/2026");
    expect(text).toContain("11/19/2026");
  });

  it("puts the newest first", () => {
    renderGallery();
    const dates = [...host.querySelectorAll(".tiny.muted")]
      .map((node) => node.textContent ?? "")
      .filter((text) => text.includes("/2026"));
    expect(dates[0]).toContain("11/20/2026");
  });

  it("says so when nothing has been attached anywhere", () => {
    expect(renderGallery({ ...galleryState, dailyLogMedia: [] } as unknown as AppState))
      .toContain("No photos have been attached to a daily log yet.");
  });
});
