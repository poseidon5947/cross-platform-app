// @vitest-environment jsdom
/**
 * The sheet is handed to openSheet as an already-rendered element, so the
 * `state` prop it receives is frozen at the moment the sheet opened and never
 * refreshes while it is on screen.
 *
 * Reading the quantities straight off that frozen prop meant the live app did
 * this, against the real database, with no error shown: every "+" added one
 * step to the SAME stale number, so four taps still saved 0.25 and the box on
 * screen never moved off its opening value. The manager assigning stock to a
 * truck could not set any count at all.
 *
 * So this asserts the accumulation rather than the rendering: repeated taps
 * have to build on each other, come back down, stop at zero, and land on the
 * step instead of drifting (0.1 + 0.2).
 */
import { describe, expect, it, beforeEach } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { TruckInventorySheet } from "./OperationsTabBoundary";
import type { AppState, Material, Truck } from "../types";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const drum = { id: "m1", name: "Vulkem 350 SL", unit: "Drum", step: 0.25, category: "waterproofing", qty: 10, active: true } as unknown as Material;
const truck = { id: "t1", name: "Ford F150" } as unknown as Truck;
const stateWith = (lines: { truckId: string; materialId: string; qty: number }[]) =>
  ({ materials: [drum], truckInventory: lines } as unknown as AppState);

let host: HTMLDivElement;
beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); });

/** Mount the sheet, search so the row shows, and hand back the controls. */
function mount(state: AppState, saved: number[]) {
  const root = createRoot(host);
  act(() => { root.render(<TruckInventorySheet state={state} role="admin" truck={truck}
    setTruckInventory={(_t, _m, qty) => { saved.push(qty); }} />); });
  const search = host.querySelector<HTMLInputElement>('input[placeholder*="Search"]')!;
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(search, "Vulkem");
    search.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const box = host.querySelector(".qtybox")!;
  const buttons = [...box.querySelectorAll("button")];
  return {
    value: () => box.querySelector("input")!.value,
    plus: () => act(() => { buttons.find((b) => b.textContent === "+")!.dispatchEvent(new MouseEvent("click", { bubbles: true })); }),
    minus: () => act(() => { buttons.find((b) => b.textContent === "-")!.dispatchEvent(new MouseEvent("click", { bubbles: true })); }),
  };
}

describe("assigning stock to a truck", () => {
  it("builds the count up a step at a time instead of restating the first one", () => {
    const saved: number[] = [];
    const ui = mount(stateWith([]), saved);
    expect(ui.value()).toBe("0");
    ui.plus(); ui.plus(); ui.plus(); ui.plus();
    expect(ui.value()).toBe("1");
    // The regression: these were all 0.25.
    expect(saved).toEqual([0.25, 0.5, 0.75, 1]);
  });

  it("comes back down and stops at zero rather than going negative", () => {
    const saved: number[] = [];
    const ui = mount(stateWith([{ truckId: "t1", materialId: "m1", qty: 0.5 }]), saved);
    expect(ui.value()).toBe("0.5");
    ui.minus(); ui.minus(); ui.minus();
    expect(ui.value()).toBe("0");
    expect(saved).toEqual([0.25, 0, 0]);
  });

  it("opens on the count the vehicle already carries", () => {
    const ui = mount(stateWith([{ truckId: "t1", materialId: "m1", qty: 2.25 }]), []);
    expect(ui.value()).toBe("2.25");
  });

  it("lands on the step rather than drifting", () => {
    const saved: number[] = [];
    const ui = mount(stateWith([{ truckId: "t1", materialId: "m1", qty: 0.1 }]), saved);
    ui.plus();
    expect(ui.value()).toBe("0.25");
  });
});
