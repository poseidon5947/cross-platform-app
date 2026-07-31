import { applyCostIncreaseFlag, id, normalizeMaterialUnit, stepForMaterialUnit } from "../domain/business";
import type { Category, ImportReport, Material } from "../types";

const categoryAliases: Record<string, Category> = {
  waterproofing: "waterproofing",
  "blindside waterproofing": "waterproofing",
  tanking: "waterproofing",
  conventional: "waterproofing",
  blindside: "waterproofing",
  drainage: "drainage",
  "drainage & protection": "drainage",
  caulking: "caulking",
  "caulking & sealants": "caulking",
  insulation: "insulation",
  "crack injection": "crack_injection",
  injection: "crack_injection",
  "traffic coatings": "traffic_coatings",
  traffic: "traffic_coatings",
  "termination & fasteners": "termination_fasteners",
  fasteners: "termination_fasteners",
  consumables: "consumables",
  "consumables & prep": "consumables",
  ppe: "ppe",
  shop: "shop",
};

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((item) => item.some((value) => value.trim()));
}

function pick(row: Record<string, string>, names: string[]) {
  for (const name of names) {
    const value = row[normalize(name)];
    if (value != null && value.trim() !== "") return value.trim();
  }
  return "";
}

function num(value: string, fallback = 0) {
  if (!value) return fallback;
  const parsed = Number(value.replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function categoryFrom(value: string): Category | null {
  return categoryAliases[normalize(value)] ?? null;
}

export function validateMaterialsCsv(text: string, existing: Material[] = []): ImportReport {
  const rows = parseCsv(text);
  const [headers, ...body] = rows;
  if (!headers) return { imported: 0, skipped: [{ row: 1, reason: "CSV is empty" }], materials: [] };
  const normalizedHeaders = headers.map(normalize);
  const materials: Material[] = [];
  const skipped: ImportReport["skipped"] = [];
  const existingByName = new Map(existing.map((material) => [normalize(material.name), material]));

  body.forEach((values, index) => {
    const record = Object.fromEntries(normalizedHeaders.map((header, col) => [header, values[col] ?? ""]));
    const name = pick(record, ["name", "inventory", "material", "item"]);
    const categoryLabel = pick(record, ["category"]);
    const category = categoryFrom(categoryLabel || pick(record, ["service"]));
    const unitRaw = pick(record, ["unit", "unit (locked)", "locked unit"]) || "Unit";
    const unit = normalizeMaterialUnit(unitRaw);

    if (!name) skipped.push({ row: index + 2, reason: "Missing material name" });
    else if (!category) skipped.push({ row: index + 2, reason: `Unknown category '${categoryLabel}'` });
    else if (!unit) skipped.push({ row: index + 2, reason: `Invalid locked unit '${unitRaw}'. Use Unit, Roll, Drum, Box, or Sausage.` });
    else {
      const existingMaterial = existingByName.get(normalize(name));
      materials.push(applyCostIncreaseFlag(existingMaterial, {
        id: existingMaterial?.id ?? (pick(record, ["inventory id", "sku", "id"]) || id("m")),
        name,
        category,
        unit,
        step: stepForMaterialUnit(unit),
        pack: pick(record, ["pack", "units per", "vendor", "secondary supplier"]),
        unitsPerPallet: num(pick(record, ["units per pallet", "units_per_pallet"]), 0),
        cost: num(pick(record, ["cost", "unit cost ($)", "unit cost"]), existingMaterial?.cost ?? 0),
        qty: existingMaterial?.qty ?? num(pick(record, ["on hand", "on hand (current quantity)", "qty"]), 0),
        reorderPoint: num(pick(record, ["reorder", "reorder point", "reorder at (3 remaining in inventory)"]), existingMaterial?.reorderPoint ?? 3),
        bin: pick(record, ["bin", "warehouse location", "location"]) || existingMaterial?.bin || "",
      }));
    }
  });

  return { imported: materials.length, skipped, materials };
}
