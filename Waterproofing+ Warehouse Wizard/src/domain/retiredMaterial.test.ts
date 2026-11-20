/**
 * Retiring a product, which the catalogue did not honour.
 *
 * `Material.active` has been on the row and parsed by `materialFromRow` all
 * along, and exactly one picker read it - so a retired product stayed on the
 * Inventory tab with its quantity still counting toward the shelf.
 *
 * It came up on 21 November: the client confirmed "TREMPROOF 260 5 gallon
 * pail" and "TremProof TP 260 55 Gallon Drum" are one lot of stock entered
 * twice, 17 units counted under both names, with only one flagged Tremco for
 * billing back. Retiring the duplicate had to actually take it off the list
 * she reads the count from.
 *
 * Same shape as unarchivedJobs and onFleet - see those for the other two.
 */
import { describe, expect, it } from "vitest";
import { stockedMaterials } from "./business";
import type { Material } from "../types";

const mat = (over: Partial<Material> & { id: string }) =>
  ({ name: over.id, category: "waterproofing", unit: "Drum", qty: 0, ...over } as Material);

const drum = mat({ id: "drum", name: "TremProof TP 260 55 Gallon Drum", qty: 17, isTremco: true });
const pail = mat({ id: "pail", name: "TREMPROOF 260 5 gallon pail", qty: 17, active: false });
const older = mat({ id: "older" });

describe("a retired product", () => {
  it("is off the catalogue", () => {
    expect(stockedMaterials([drum, pail]).map((m) => m.id)).toEqual(["drum"]);
  });

  it("leaves a product with no flag at all in the catalogue", () => {
    // Every row predating the column reads as live, not retired.
    expect(stockedMaterials([older]).map((m) => m.id)).toEqual(["older"]);
  });

  it("treats only an explicit false as retired", () => {
    expect(stockedMaterials([mat({ id: "on", active: true })]).map((m) => m.id)).toEqual(["on"]);
  });

  it("takes its quantity off the shelf with it, which is the point", () => {
    const onHand = (list: Material[]) => stockedMaterials(list).reduce((sum, m) => sum + m.qty, 0);
    // 17 counted twice under two names reads as 34 until the duplicate goes.
    expect(onHand([drum, { ...pail, active: true }])).toBe(34);
    expect(onHand([drum, pail])).toBe(17);
  });

  it("never removes it from the underlying list, so past logs can still name it", () => {
    const all = [drum, pail];
    stockedMaterials(all);
    expect(all.map((m) => m.id)).toEqual(["drum", "pail"]);
  });
});
