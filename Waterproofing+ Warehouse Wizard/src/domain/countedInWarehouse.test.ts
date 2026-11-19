/**
 * The client's truck load-in lists went in on 19 November and brought 79 new
 * products with them, most of it kit that lives on a vehicle rather than stock
 * on a shelf: Broom, Fire Extinguisher, Wrenches, 4' Level. They carry no
 * warehouse count, so `qty` is 0 and `stockStatus` calls every one of them
 * "Out" - 79 red rows on the Inventory tab, hiding the dozen products that
 * actually need ordering, and 79 lines on the reorder estimate the office would
 * have had to read past.
 *
 * `strictTracking: false` is the flag that already says "nobody counts this",
 * and the daily-log picker was the only place reading it. These tests pin the
 * rule down by name so the next person filtering a list of products has one
 * thing to call.
 */
import { describe, expect, it } from "vitest";
import { countedInWarehouse, reorderEstimate, stockStatus } from "./business";
import type { Material } from "../types";

const material = (patch: Partial<Material>): Material => ({
  id: "m1", name: "Thing", category: "consumables", unit: "Unit", step: 0.25,
  pack: "", unitsPerPallet: 0, cost: 0, qty: 0, reorderPoint: 0, bin: "",
  ...patch,
} as Material);

describe("what counts as warehouse stock", () => {
  it("counts a product nobody flagged, because the flag defaults to counted", () => {
    expect(countedInWarehouse(material({}))).toBe(true);
    expect(countedInWarehouse(material({ strictTracking: true }))).toBe(true);
  });

  it("leaves out truck kit that has no warehouse count", () => {
    expect(countedInWarehouse(material({ name: "Broom", strictTracking: false }))).toBe(false);
  });

  it("keeps a broom off the reorder estimate while it still reads as Out", () => {
    const broom = material({ id: "broom", name: "Broom", strictTracking: false });
    const drum = material({ id: "drum", name: "TremProof 260", qty: 0, reorderPoint: 4, cost: 900 });
    // Both look empty on their own...
    expect(stockStatus(broom).label).toBe("Out");
    expect(stockStatus(drum).label).toBe("Out");
    // ...but only the one the warehouse counts is something to buy.
    const estimate = reorderEstimate([broom, drum]);
    expect(estimate.lines.map((line) => line.materialId)).toEqual(["drum"]);
  });
});
