import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const categories: Record<string, string> = {
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
  "traffic coatings": "traffic_coatings",
  "termination & fasteners": "termination_fasteners",
  consumables: "consumables",
  "consumables & prep": "consumables",
  ppe: "ppe",
  shop: "shop",
};

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (ch === '"' && quoted && next === '"') { cell += '"'; i++; }
    else if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((ch === "\n" || ch === "\r") && !quoted) { if (ch === "\r" && next === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim()));
}

function pick(row: Record<string, string>, names: string[]) {
  for (const name of names) {
    const value = row[normalize(name)];
    if (value?.trim()) return value.trim();
  }
  return "";
}

// A blank cell is "not given", not zero. Number("") is 0 and 0 is finite, so
// the old version never reached its fallback: an empty Reorder cell became a
// reorder point of 0 and an empty Cost cell became $0.00.
function num(value: string, fallback = 0) {
  if (!value || !value.trim()) return fallback;
  const parsed = Number(value.replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function requireAdmin(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token = auth.replace("Bearer ", "");
  const { data: userResult, error } = await admin.auth.getUser(token);
  if (error || !userResult.user) throw new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });
  const { data: profile } = await admin.from("profiles").select("role").eq("id", userResult.user.id).single();
  if (profile?.role !== "admin") throw new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: cors });
  return admin;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return Response.json({ error: "POST a CSV file body." }, { status: 405, headers: cors });
  try {
    const supabase = await requireAdmin(req);
    const rows = parseCsv(await req.text());
    const [headers, ...body] = rows;
    if (!headers) return Response.json({ imported: 0, skipped: [{ row: 1, reason: "CSV is empty" }] }, { headers: cors });
    const normalized = headers.map(normalize);
    const onHandAliases = ["on hand", "on hand (current quantity)", "qty", "column j"];
    const hasOnHandColumn = normalized.some((header) => onHandAliases.includes(header));
    const skipped: Array<{ row: number; reason: string }> = [];
    const records = body.map((values) => Object.fromEntries(normalized.map((header, col) => [header, values[col] ?? ""])));
    const nameOf = (record: Record<string, string>) => pick(record, ["name", "inventory", "material", "item"]);
    // Which columns the sheet actually has. A column that is not in the file is
    // not written for an existing material - the live re-test imported a price
    // sheet with Item/Unit/Cost/On hand and it set Backer Rod's reorder point to
    // 0 and blanked "Vendor: Cascade", because the missing columns were being
    // written as empty. New materials still get sensible defaults below.
    const has = (aliases: string[]) => aliases.some((alias) => normalized.includes(normalize(alias)));
    const unitAliases = ["unit", "unit (locked)", "locked unit"];
    const packAliases = ["pack", "units per", "vendor", "secondary supplier"];
    const palletAliases = ["units per pallet", "units_per_pallet"];
    const costAliases = ["cost", "unit cost ($)", "unit cost"];
    const reorderAliases = ["reorder", "reorder point", "reorder at (3 remaining in inventory)"];
    const binAliases = ["bin", "warehouse location", "location"];
    const canonicalUnit = (input: string) => ["Unit", "Roll", "Drum", "Box", "Sausage"].find((value) => value.toLowerCase() === input.trim().toLowerCase());
    // Looked up before the rows are judged, so a sheet with no Category column -
    // the shape a price update usually arrives in - can still update materials
    // the warehouse already knows. Live verification sent exactly such a file and
    // every row came back "Unknown category". Only a genuinely new material needs
    // the column, because there is nothing else to take the category from.
    const allNames = [...new Set(records.map(nameOf).filter(Boolean))];
    const { data: existingRows, error: existingError } = allNames.length
      ? await supabase.from("materials").select("name,category,unit,cost,reorder_point,previous_cost,price_changed_at,strict_tracking").in("name", allNames)
      : { data: [], error: null };
    if (existingError) throw existingError;
    const existingByName = new Map((existingRows ?? []).map((item) => [item.name, item]));
    const payload = records.flatMap((record, index) => {
      const name = nameOf(record);
      const existing = existingByName.get(name);
      const categoryInput = pick(record, ["category"]) || pick(record, ["service"]);
      const category = categories[normalize(categoryInput)] ?? (categoryInput ? undefined : existing?.category);
      // No Unit column, or a blank cell: an existing material keeps its locked
      // unit; only a new one defaults to Unit.
      const unitInput = pick(record, unitAliases);
      const unit = unitInput ? canonicalUnit(unitInput) : (existing?.unit as string | undefined) ?? "Unit";
      const step = unit === "Drum" ? 0.25 : 1;
      const onHandRaw = pick(record, onHandAliases);
      if (!name) skipped.push({ row: index + 2, reason: "Missing material name" });
      else if (!category) skipped.push({ row: index + 2, reason: categoryInput ? `Unknown category '${categoryInput}'` : "New material needs a Category column" });
      else if (!unit) skipped.push({ row: index + 2, reason: `Invalid locked unit '${unitInput}'. Use Unit, Roll, Drum, Box, or Sausage.` });
      else return [{
        name,
        category,
        unit,
        step,
        // `undefined` means "column not in the sheet": dropped for updates,
        // defaulted for inserts.
        pack: has(packAliases) ? pick(record, packAliases) : undefined,
        units_per_pallet: has(palletAliases) ? num(pick(record, palletAliases), 0) : undefined,
        cost: has(costAliases) ? num(pick(record, costAliases), existing ? Number(existing.cost) : 0) : undefined,
        imported_on_hand: onHandRaw,
        strict_tracking: hasOnHandColumn ? Boolean(onHandRaw.trim()) : true,
        reorder_point: has(reorderAliases) ? num(pick(record, reorderAliases), existing ? Number(existing.reorder_point) : 3) : undefined,
        bin: has(binAliases) ? pick(record, binAliases) : undefined,
      }];
      return [];
    });
    const newDefaults = { pack: "", units_per_pallet: 0, cost: 0, reorder_point: 3, bin: "" };
    const present = (item: Record<string, unknown>) => Object.fromEntries(Object.entries(item).filter(([, value]) => value !== undefined));
    const now = new Date().toISOString();
    // An import must never move stock on hand. It used to read qty and write the
    // same value back in the upsert, which looks safe but is a read-then-write: a
    // crew member logging materials in the gap between the select above and the
    // write below had their deduction silently reverted, because the import put
    // the pre-deduction number back. transactions_apply_stock fires on its own, so
    // that gap is real whenever anyone is working while an import runs.
    //
    // Existing materials are updated without qty in the payload at all, so the
    // column is never written and there is nothing to race. Only genuinely new
    // materials get an opening quantity, and only from the sheet.
    const decorate = (item: Record<string, unknown>, existing: Record<string, unknown> | undefined) => {
      const changed = existing && item.cost !== undefined && Number(existing.cost) !== item.cost;
      return {
        ...item,
        strict_tracking: hasOnHandColumn ? item.strict_tracking : existing?.strict_tracking ?? true,
        previous_cost: changed ? Number(existing!.cost) : existing?.previous_cost ?? null,
        price_changed_at: changed ? now : existing?.price_changed_at ?? null,
      };
    };

    const newRows: Record<string, unknown>[] = [];
    const updates: Record<string, unknown>[] = [];
    for (const { imported_on_hand, ...item } of payload) {
      const existing = existingByName.get(item.name);
      if (existing) updates.push(present(decorate(item, existing)));
      else newRows.push({ ...newDefaults, ...present(decorate(item, undefined)), qty: num(imported_on_hand, 0) });
    }

    if (newRows.length) {
      const { error: insertError } = await supabase.from("materials").insert(newRows);
      if (insertError) throw insertError;
    }
    for (const row of updates) {
      const { name, ...fields } = row;
      const { error: updateError } = await supabase.from("materials").update(fields).eq("name", name);
      if (updateError) throw updateError;
    }
    return Response.json({ imported: newRows.length + updates.length, created: newRows.length, updated: updates.length, skipped }, { headers: cors });
  } catch (err) {
    if (err instanceof Response) return err;
    return Response.json({ error: String(err?.message ?? err) }, { status: 500, headers: cors });
  }
});
