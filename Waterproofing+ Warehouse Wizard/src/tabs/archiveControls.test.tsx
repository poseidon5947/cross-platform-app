// @vitest-environment jsdom
/**
 * Archiving a product, tool or vehicle from inside the app.
 *
 * The guide the PM reads has said since 10 November: "A product you no longer
 * carry should be made INACTIVE, not deleted." There was no control to do it.
 * `retireRecord` existed in App.tsx and was wired to exactly one thing, the
 * Jobs tab; `removeRecord` was wired to nothing at all. So the honest answer
 * to "what do I do instead of deleting a product" was "ask the developer",
 * which is almost certainly why the team kept asking to delete things.
 *
 * Tools were also the fourth list to read `active` and not honour it, after
 * jobs, trucks and the Inventory tab - so a tool written off stayed on the
 * list people check out from.
 *
 * These pin both halves: the button is offered to the people who may use it,
 * the archived rows leave the working lists, and there is a way back.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import OperationsTabBoundary from "./OperationsTabBoundary";
import React from "react";
import type { AppState, Material, ToolItem, Truck, User } from "../types";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const material = (over: Partial<Material> & { id: string }) =>
  ({ name: over.id, category: "waterproofing", unit: "Drum", qty: 4, reorderPoint: 1, cost: 0, bin: "A1", pack: "", step: 0.25, unitsPerPallet: 0, strictTracking: true, ...over } as Material);
const tool = (over: Partial<ToolItem> & { id: string }) =>
  ({ name: over.id, serviceId: "wp", status: "in", condition: "good", ...over } as ToolItem);
const truck = (over: Partial<Truck> & { id: string }) =>
  ({ name: over.id, km: 1000, ...over } as Truck);

const live = material({ id: "live", name: "TremProof TP 260 55 Gallon Drum" });
const gone = material({ id: "gone", name: "TREMPROOF 260 5 gallon pail", active: false });
const liveTool = tool({ id: "t1", name: "Hilti TE 35 hammer drill" });
const goneTool = tool({ id: "t2", name: "Hot Air Welder", active: false });
const liveTruck = truck({ id: "v1", name: "Ford Maverick (2026)" });
const goneTruck = truck({ id: "v2", name: "Ford F150 (2011)", active: false });

const admin = { id: "u1", name: "David Holloway", role: "admin" } as unknown as User;
const crew = { id: "u2", name: "Jesse", role: "crew" } as unknown as User;

const stateWith = (over: Partial<AppState> = {}) => ({
  materials: [live, gone], tools: [liveTool, goneTool], trucks: [liveTruck, goneTruck],
  transactions: [], sites: [], services: [{ id: "wp", name: "Waterproofing" }], users: [admin, crew],
  dailyLogs: [], dailyLogMedia: [], pointsEvents: [], truckLogs: [], truckTasks: [], truckInventory: [],
  truckFiles: [], taskCompletions: [], maintenanceRequests: [], offlineQueue: [], crewPoolPoints: 0,
  ...over,
} as unknown as AppState);

let host: HTMLDivElement; let root: Root; let calls: Array<[string, string, boolean]>;
let sheets: Array<{ title: string; content: React.ReactNode }>;

beforeEach(() => {
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); calls = []; sheets = [];
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

const noop = () => {};
const render = (tab: string, user: User, state = stateWith()) => {
  act(() => root.render(
    <OperationsTabBoundary
      activeTab={tab as never} state={state} role={user.role as never} currentUser={user} userId={user.id}
      toggleTask={noop} openSheet={(sheet) => { if (sheet) sheets.push(sheet); }} saveMaterial={noop} setExactCount={noop} setTab={noop}
      submitTransactions={noop} submitDailyLog={noop} saveSite={noop} saveTool={noop} saveTruck={noop}
      saveTruckRecord={noop} setTruckInventory={noop} addTruckFile={noop} removeTruckFile={noop}
      saveTask={noop} removeTask={noop} submitMaintenance={noop} respondMaintenance={noop}
      editMaintenance={noop} editDailyLog={noop} removeDailyLog={noop}
      retireRecord={(table, id, active) => { calls.push([table, id, active]); }}
      onFocusHandled={noop}
    />,
  ));
  return host.textContent ?? "";
};
const click = (label: string) => {
  const btn = Array.from(host.querySelectorAll("button")).find((b) => (b.textContent ?? "").trim() === label);
  if (!btn) throw new Error(`no button "${label}". Buttons: ${Array.from(host.querySelectorAll("button")).map((b) => b.textContent).join(" | ")}`);
  act(() => { btn.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
};

describe("the tools list", () => {
  it("leaves out a tool that has been archived", () => {
    const text = render("tools", admin);
    expect(text).toContain("Hilti TE 35 hammer drill");
    expect(text).not.toContain("Hot Air Welder");
  });

  it("counts only the tools still owned", () => {
    render("tools", admin);
    // One tool on hand, not two.
    expect(host.textContent).toContain("of 1");
  });

  it("offers an Archived chip that finds the ones put away", () => {
    render("tools", admin);
    click("Archived 1");
    expect(host.textContent).toContain("Hot Air Welder");
  });
});

describe("the fleet", () => {
  it("offers Archive on a vehicle, and reports it", () => {
    render("trucks", admin);
    click("Archive");
    expect(calls).toEqual([["trucks", "v1", false]]);
  });

  it("lists an archived vehicle separately with a way back", () => {
    render("trucks", admin);
    expect(host.textContent).toContain("Archived vehicles");
    click("Bring back");
    expect(calls).toEqual([["trucks", "v2", true]]);
  });

  it("does not offer Archive to the crew", () => {
    render("trucks", crew);
    const labels = Array.from(host.querySelectorAll("button")).map((b) => (b.textContent ?? "").trim());
    expect(labels).not.toContain("Archive");
    expect(host.textContent).not.toContain("Archived vehicles");
  });
});

describe("the inventory list", () => {
  it("offers an Archived chip only once something is in it", () => {
    render("inventory", admin);
    expect(host.textContent).toContain("Archived 1");
    expect(host.textContent).not.toContain("TREMPROOF 260 5 gallon pail");
  });

  it("has no Archived chip when nothing is archived", () => {
    render("inventory", admin, stateWith({ materials: [live] }));
    expect(host.textContent).not.toContain("Archived");
  });
});


/** Open the sheet a row opens, and render it on its own, as the app does. */
const openRow = (label: string) => {
  const row = Array.from(host.querySelectorAll("div,button")).find((n) => (n.textContent ?? "").trim().startsWith(label));
  if (!row) throw new Error(`no row starting "${label}"`);
  act(() => { row.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
  const sheet = sheets[sheets.length - 1];
  if (!sheet) throw new Error("that row opened no sheet");
  act(() => root.render(<>{sheet.content}</>));
  return host.textContent ?? "";
};

describe("archiving a product", () => {
  it("offers Archive on the product card, and reports it", () => {
    render("inventory", admin);
    openRow("TremProof TP 260");
    click("Archive this product");
    expect(calls).toEqual([["materials", "live", false]]);
  });

  it("offers the way back on one already archived", () => {
    render("inventory", admin);
    click("Archived 1");
    openRow("TREMPROOF 260 5 gallon pail");
    click("Bring this product back");
    expect(calls).toEqual([["materials", "gone", true]]);
  });

  it("says plainly that the past does not move", () => {
    render("inventory", admin);
    const text = openRow("TremProof TP 260");
    expect(text).toContain("stays on every past log and report");
  });

  it("does not offer it to the crew", () => {
    render("inventory", crew);
    const text = openRow("TremProof TP 260");
    expect(text).not.toContain("Archive this product");
  });
});

describe("archiving a tool", () => {
  it("offers Archive on the tool card, and reports it", () => {
    render("tools", admin);
    openRow("Hilti TE 35 hammer drill");
    click("Archive this tool");
    expect(calls).toEqual([["tools", "t1", false]]);
  });
});
