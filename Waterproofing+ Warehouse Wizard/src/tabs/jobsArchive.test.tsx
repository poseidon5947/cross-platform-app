// @vitest-environment jsdom
/**
 * The Jobs tab, once a job can be archived.
 *
 * Asserted on what renders rather than on the props, because the quiet failure
 * is a later edit putting an archived job back into "Active jobs" - the list
 * the client opens this tab to read - with nothing on screen to say so.
 *
 * The third test is the one that matters for the data: archiving must never be
 * offered to someone who cannot save it. `setRecordActive` returns the rows it
 * changed and throws when there are none, so a crew member tapping Archive
 * would get an error toast and a list that had already moved the job - the
 * optimistic patch happens first.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import JobsTabBoundary from "./JobsTabBoundary";
import type { AppState, Site } from "../types";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const site = (over: Partial<Site> & { id: string; name: string }) =>
  ({ address: "", source: "manual", ...over } as Site);

const SITES = [
  site({ id: "live", name: "Spire - 2300 Douglas St" }),
  site({ id: "dated", name: "Chandos - NAC", endDate: "2026-01-31" }),
  site({ id: "away", name: "a. Travel Time", active: false }),
];

const stateWith = (sites: Site[]) => ({ sites } as unknown as AppState);

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

/** Render the tab and hand back a reader for each card's job names. */
function render(props: Partial<Parameters<typeof JobsTabBoundary>[0]> = {}) {
  const calls: Array<[string, boolean]> = [];
  act(() => {
    root.render(<JobsTabBoundary
      state={stateWith(SITES)}
      role="admin"
      saveSite={() => {}}
      setJobArchived={(id, archived) => calls.push([id, archived])}
      openSheet={() => {}}
      {...props}
    />);
  });
  const sections = [...host.querySelectorAll("section.card")];
  const names = (index: number) => [...sections[index].querySelectorAll(".mid > b")].map((node) => node.textContent);
  return { calls, sections, names, summaries: [...host.querySelectorAll("summary")].map((node) => node.textContent) };
}

describe("the Jobs tab with archiving", () => {
  it("keeps an archived job out of Active jobs", () => {
    const { names } = render();
    expect(names(0)).toEqual(["Spire - 2300 Douglas St"]);
  });

  it("files it under its own heading, not with the jobs that merely ended", () => {
    const { summaries } = render();
    expect(summaries).toEqual(["1 past job", "1 archived job"]);
  });

  it("offers no Archive button to a crew member", () => {
    const { sections } = render({ role: "crew" });
    const labels = [...sections[0].querySelectorAll("button")].map((node) => node.textContent);
    expect(labels).not.toContain("Archive");
  });

  it("archives the job that was tapped, and offers to bring an archived one back", () => {
    const { calls, sections } = render();
    const archive = [...sections[0].querySelectorAll("button")].find((node) => node.textContent === "Archive")!;
    act(() => { archive.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    expect(calls).toEqual([["live", true]]);

    const bringBack = [...sections[2].querySelectorAll("button")].find((node) => node.textContent === "Bring back")!;
    act(() => { bringBack.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    expect(calls).toEqual([["live", true], ["away", false]]);
  });

  it("drops the archived card entirely when nothing is archived", () => {
    const { summaries } = render({ state: stateWith(SITES.slice(0, 2)) });
    expect(summaries).toEqual(["1 past job"]);
  });
});
