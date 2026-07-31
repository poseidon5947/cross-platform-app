# Codex Prompt — Seed the demo from the REAL workbook inventory

> Paste into Codex, working in `D:\project\Canada\cross platform\Waterproofing+ Warehouse Wizard`.
> Small, data-focused change. Keep `npm run build` and `npm test` green. Do not touch unrelated features (Gas Station Check, tool check-in/out, QBO sync, theming) — those are reviewed and correct.

## Why

The client said the demo "still has the data from my first Claude example" and wants to see **their real inventory**. You already pulled the real **crew names** from the workbook's CREW tab, but the **material catalogue is still the old prototype data** (`Tremproof 260 (TP260)`, `Vulkem 350`, …). Replace it with the real items from the workbook so the demo (and the Supabase seed) reflect actual inventory.

## Source of truth

The workbook is in the repo:
`Waterproofing+ Warehouse Wizard/Waterproofing-Plus-Data-Warehouse-Wizard.xlsx`

Use the master inventory tab named **`Inventory (Pull B,C, D & G to o...)`** (sheetId 3) — it is the item master. Parse it directly (you can unzip the .xlsx and read `xl/worksheets/sheet3.xml` + `xl/sharedStrings.xml`, or use a lightweight xlsx read in the seed-generation step). Do **not** use `Inventory Log up to July 17` for the catalogue — that tab is a movement/usage **log**, not a stock list (optional: see "Nice to have" below).

### Column mapping (master tab header row)

| Workbook column | Maps to `Material` field | Rule |
|---|---|---|
| `Inventory` | `name` | required; skip rows with empty name |
| `Category` | `category` | normalize — see below (adds PPE + shop) |
| `Service` | (context only) | not a stored field; ignore or fold into `pack` note if useful |
| `Vendor` / `Secondary Supplier` | optional → append to `pack` note | e.g. `pack = "Vendor: Tremco"` when present |
| `Unit (locked)` | `unit` | if blank → default `"unit"` |
| `Units per` | `pack` | free text (e.g. `"33 units p/case"`, `"100"`) |
| `Unit Cost ($)` | `cost` | parse number; blank → 0 |
| `On Hand (current quantity)` | `qty` | blank → 0 |
| `Reorder At (3 remaining in inventory)` | `reorderPoint` | blank → **3** (the column's stated default) |
| `Warehouse Location` | `bin` | blank → `""` |

`step` is **not** in the sheet — derive it: `barrel` or `gallon` (or a name containing "drum"/"gallon") → `0.25`; `roll` or `litre` → `0.5`; everything else → `1`. (Keeps the client's quarter-quantity rule for barrels/gallons.)

### Category normalization — IMPORTANT (schema change required)

The real data uses more categories than the current `material_category` enum. Observed labels:
`Waterproofing`, `Caulking & Sealants`, `Traffic Coatings`, `Insulation`, `Crack Injection`, `Consumables & Prep`, **`PPE`**, **`shop`**.

1. Add **`ppe`** and **`shop`** to the `material_category` enum in `supabase/migrations/202607240001_initial_schema.sql` (this edits the committed migration — add a README note that an existing DB must `ALTER TYPE material_category ADD VALUE 'ppe';` / `'shop';` or be reset).
2. Add matching entries to the UI `categoryLabels` (in `src/data/seed.ts`) and to the category chips.
3. Extend the importer's category alias map (`src/data/csvImport.ts`) so these labels resolve:
   - `waterproofing` → `waterproofing`
   - `caulking & sealants` / `caulking` → `caulking`
   - `traffic coatings` → `traffic_coatings`
   - `insulation` → `insulation`
   - `crack injection` → `crack_injection`
   - `consumables & prep` → `consumables`
   - `ppe` → `ppe`
   - `shop` → `shop`
   - keep existing `drainage`, `termination & fasteners` aliases mapping to their enums (even though the master tab files drainmats/term bars under Waterproofing — leave the enums in place for the importer).

Normalize by lowercasing + trimming + collapsing whitespace before matching. Rows with an unmappable category should be **skipped and reported**, not silently dropped.

## What to change

1. **`src/data/seed.ts`** — replace the `materialRows` array with the real items parsed from the master tab. Keep the same row/tuple shape the file already uses. Assign stable ids (`m1`, `m2`, … in tab order). Handle blanks per the rules above.
2. **Migration + labels + importer aliases** — the category additions above.
3. **Bump the demo storage key** (e.g. `warehouse-wizard-state-v3` → next) so a returning browser loads the new seed instead of the cached old catalogue.
4. Keep `barrel`/`gallon` at `step 0.25`; leave the existing quarter-step tests passing (adjust the referenced ids if `m1`/`m33` no longer point at a barrel/gallon — pick real barrel and gallon items from the new catalogue and update the test ids accordingly).

## Data quality notes (expected, don't treat as errors)

The client is still finishing the upload, so many master rows have **blank unit, cost, and on-hand**. Import them anyway with the defaults above — the goal is showing the real item names/categories now; quantities and costs fill in later via the CSV importer (which never overwrites live `qty` in Supabase). Where `Unit (locked)` is blank, default to `"unit"` and it can be corrected in the app.

## Nice to have (only if quick)

Optionally seed a handful of recent **activity** rows from `Inventory Log up to July 17` (columns: Date, Inventory, Qty, Unit, Action, Job, Service, Crew Name) so the Home "recent activity" feed shows real usage. Map `Action` (`Used` → `use`, etc.), match `Inventory` to the seeded material by name, and `Crew Name` to the seeded crew. Skip any row that doesn't match cleanly. If this adds meaningful complexity, skip it — the catalogue is the priority.

## Verify

- `npm run build` and `npm test` green.
- Demo Inventory tab shows real items (e.g. `TremProof TP 260 55 Gallon Drum`, `Dow CWS (Grey)`, `CFI Panel 2"`, `Injection Ports…`, PPE items) instead of the old prototype list.
- Category chips include PPE and shop; filtering works.
- A barrel or gallon item logs in `.25` increments.
- Print the count of imported vs skipped rows in the seed-generation step (or a comment) so it's clear how many of the ~100+ master rows made it in and why any were skipped.
