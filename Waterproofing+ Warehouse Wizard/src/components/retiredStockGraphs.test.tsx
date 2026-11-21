// @vitest-environment jsdom
/**
 * The fourth place `Material.active` was read but not honoured - and the one
 * that reaches the CFO.
 *
 * Retiring a product took it off the Inventory tab (see retiredMaterial.test)
 * but the graph panels still read `state.materials` whole, so a retired
 * product kept counting toward total inventory value, "SKUs tracked", the
 * out-of-stock count, and the reorder list the ordering forecast is built on.
 *
 * On 21 November the live effect was one stat off by one, because only one
 * product was retired and it sat above its reorder point. The reason to pin it
 * down is what happens next: a retired product sitting at zero joins both the
 * out-of-stock tile and the reorder list, and a retired product with a cost
 * inflates a dollar figure the CFO reconciles against.
 *
 * Losses are deliberately not filtered - see the comment on Losses30dGraph.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { GraphModal } from "./GraphModal";
import type { AppState, Material } from "../types";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mat = (over: Partial<Material> & { id: string }) =>
  ({ name: over.id, category: "waterproofing", unit: "Drum", qty: 0, reorderPoint: 3, cost: 0, bin: "", pack: "", step: 1, unitsPerPallet: 0, ...over } as Material);

// One lot of stock entered twice; the pail is the retired copy.
const drum = mat({ id: "drum", name: "TremProof TP 260 55 Gallon Drum", qty: 17, cost: 100 });
const pail = mat({ id: "pail", name: "TREMPROOF 260 5 gallon pail", qty: 17, cost: 100, active: false });
// A retired product at zero: the shape that pollutes both the reorder list and the out-of-stock tile.
const emptyRetired = mat({ id: "gone", name: "Discontinued primer", qty: 0, cost: 50, active: false });

const stateWith = (materials: Material[]) =>
  ({ materials, transactions: [], tools: [], users: [], trucks: [], truckTasks: [], dailyLogs: [], pointsEvents: [], sites: [] } as unknown as AppState);

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const render = (state: AppState, type: "inventory_stock" | "reorder_alert") => {
  act(() => root.render(<GraphModal type={type} state={state} onClose={() => {}} />));
  return host.textContent ?? "";
};

describe("the inventory graph panel", () => {
  it("counts a retired product out of SKUs tracked", () => {
    const text = render(stateWith([drum, pail]), "inventory_stock");
    expect(text).toContain("SKUs tracked");
    // One lot of stock, entered twice, retired once: one SKU, not two.
    const tracked = host.querySelectorAll(".gm-stat-val");
    expect(Array.from(tracked).map((n) => n.textContent)).toContain("1");
  });

  it("leaves a retired product's quantity out of total inventory value", () => {
    // 17 drums at $100 is $1,700 of stock, not $3,400 counted under both names.
    expect(render(stateWith([drum, pail]), "inventory_stock")).toContain("1,700");
  });

  it("does not count a retired product as out of stock", () => {
    const text = render(stateWith([drum, emptyRetired]), "inventory_stock");
    // The only live product has 17 on hand, so nothing is out of stock.
    const vals = Array.from(host.querySelectorAll(".gm-stat-val")).map((n) => n.textContent);
    expect(text).toContain("Out of stock");
    expect(vals.filter((v) => v === "1").length).toBe(1); // SKUs tracked only
  });

  it("still counts a product with no flag at all", () => {
    // Every row predating the column reads as live, not retired.
    expect(Array.from(host.querySelectorAll(".gm-stat-val")).map((n) => n.textContent)).not.toContain("0");
    render(stateWith([mat({ id: "plain", qty: 4, cost: 10 })]), "inventory_stock");
    expect(Array.from(host.querySelectorAll(".gm-stat-val")).map((n) => n.textContent)).toContain("1");
  });
});

describe("the reorder list", () => {
  it("does not ask anyone to order a retired product", () => {
    const text = render(stateWith([drum, emptyRetired]), "reorder_alert");
    expect(text).not.toContain("Discontinued primer");
  });

  it("still lists a live product that is below its reorder point", () => {
    const low = mat({ id: "low", name: "Dymonic 100 Black", qty: 1, reorderPoint: 10, cost: 20 });
    expect(render(stateWith([low, emptyRetired]), "reorder_alert")).toContain("Dymonic 100 Black");
  });
});
