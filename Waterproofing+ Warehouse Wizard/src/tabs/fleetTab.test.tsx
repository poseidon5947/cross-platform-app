// @vitest-environment jsdom
/**
 * Trucks as its own tab, asked for by the client on 19 November: "Trucks not
 * appearing on admin portal - we asked for a separate section just for trucks."
 *
 * Nothing was hidden and no permission was wrong. The fleet rendered at the
 * bottom of the tab labelled "Tasks", under a progress ring, a six-way
 * frequency switcher, a "mark all done" button and up to 32 task checkboxes,
 * so on a phone it was never reached. Splitting it is only worth anything if
 * it stays split, and the quiet failure is a later edit putting the fleet back
 * below the checklists - which still renders, still typechecks, and is exactly
 * the bug she reported.
 *
 * So these assert the two tabs by what each one puts on screen: the Trucks tab
 * shows vehicles and no checklist, the Tasks tab shows the checklist and no
 * vehicles.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import OperationsTabBoundary from "./OperationsTabBoundary";
import type { AppState, Truck, TruckTask, User } from "../types";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const maverick = { id: "t106", name: "Ford Maverick (2026)", km: 1200 } as unknown as Truck;
const f150 = { id: "f150", name: "Ford F150 (2011)", km: 240000, active: false } as unknown as Truck;
const carFor = { id: "car", name: "Company Car", km: 5, showToCrew: false } as unknown as Truck;
const task = { id: "k1", text: "Check tire pressure", serviceId: "veh", section: "trucks", freq: "daily", timeOfDay: "start" } as unknown as TruckTask;
const admin = { id: "u1", name: "Tara Clark", role: "admin" } as unknown as User;

const state = {
  trucks: [maverick, f150, carFor],
  truckTasks: [task],
  taskCompletions: [],
  truckLogs: [],
  truckInventory: [{ truckId: "t106", materialId: "m1", qty: 2 }],
  maintenanceRequests: [],
  currentUserId: "u1",
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

const noop = () => {};

function render(activeTab: "trucks" | "tasks", role: "admin" | "crew" = "admin") {
  act(() => {
    root.render(<OperationsTabBoundary
      activeTab={activeTab} state={state} role={role} currentUser={admin} userId="u1"
      toggleTask={noop} openSheet={noop} saveMaterial={noop} setExactCount={noop} setTab={noop}
      submitTransactions={noop} submitDailyLog={noop} saveSite={noop} saveTool={noop}
      saveTruck={noop} saveTruckRecord={noop} setTruckInventory={noop} addTruckFile={noop}
      removeTruckFile={noop} saveTask={noop} removeTask={noop} submitMaintenance={noop}
      respondMaintenance={noop} editMaintenance={noop} onFocusHandled={noop}
    />);
  });
  const text = host.textContent ?? "";
  const headings = [...host.querySelectorAll("h2")].map((node) => node.textContent);
  const trucks = [...host.querySelectorAll(".truck-item .mid > div:first-child")].map((node) => node.textContent);
  return { text, headings, trucks };
}

describe("the Trucks tab", () => {
  it("puts the fleet on screen", () => {
    const { headings, trucks } = render("trucks");
    expect(headings).toContain("Fleet");
    expect(trucks).toContain("Ford Maverick (2026)");
  });

  it("does not bury it under the task checklist", () => {
    const { text } = render("trucks");
    expect(text).not.toContain("Check tire pressure");
    expect(text).not.toContain("Mark all shown done");
  });

  it("keeps the gas-station check and maintenance with the vehicles", () => {
    const { text, headings } = render("trucks");
    expect(text).toContain("Gas Station Check");
    expect(headings).toContain("Maintenance requests");
  });

  it("leaves a retired vehicle off the list", () => {
    // The F150's plate moved to the Maverick on 19 November - see onFleet.
    const { trucks } = render("trucks");
    expect(trucks).not.toContain("Ford F150 (2011)");
  });

  it("hides the company car from the crew but not from an admin", () => {
    expect(render("trucks", "admin").trucks).toContain("Company Car");
    expect(render("trucks", "crew").trucks).not.toContain("Company Car");
  });
});

describe("the Tasks tab", () => {
  it("still shows the truck checklist", () => {
    const { text } = render("tasks");
    expect(text).toContain("Check tire pressure");
    expect(text).toContain("Mark all shown done");
  });

  it("no longer carries the fleet", () => {
    const { headings, trucks } = render("tasks");
    expect(headings).not.toContain("Fleet");
    expect(trucks).toEqual([]);
  });

  it("keeps all three checklist sections", () => {
    const { text } = render("tasks");
    for (const label of ["Trucks", "Warehouse", "Services"]) {
      expect(text).toContain(label);
    }
  });
});
