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

function num(value: string, fallback = 0) {
  const parsed = Number((value || "").replace(/[$,]/g, ""));
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
    const payload = body.flatMap((values, index) => {
      const record = Object.fromEntries(normalized.map((header, col) => [header, values[col] ?? ""]));
      const name = pick(record, ["name", "inventory", "material", "item"]);
      const category = categories[normalize(pick(record, ["category"]) || pick(record, ["service"]))];
      const unitInput = pick(record, ["unit", "unit (locked)", "locked unit"]) || "Unit";
      const unit = ["Unit", "Roll", "Drum", "Box", "Sausage"].find((value) => value.toLowerCase() === unitInput.trim().toLowerCase());
      const step = unit === "Drum" ? 0.25 : 1;
      const onHandRaw = pick(record, onHandAliases);
      if (!name) skipped.push({ row: index + 2, reason: "Missing material name" });
      else if (!category) skipped.push({ row: index + 2, reason: "Unknown category" });
      else if (!unit) skipped.push({ row: index + 2, reason: `Invalid locked unit '${unitInput}'. Use Unit, Roll, Drum, Box, or Sausage.` });
      else return [{
        name,
        category,
        unit,
        step,
        pack: pick(record, ["pack", "units per", "vendor", "secondary supplier"]),
        units_per_pallet: num(pick(record, ["units per pallet", "units_per_pallet"]), 0),
        cost: num(pick(record, ["cost", "unit cost ($)", "unit cost"]), 0),
        imported_on_hand: onHandRaw,
        strict_tracking: hasOnHandColumn ? Boolean(onHandRaw.trim()) : true,
        reorder_point: num(pick(record, ["reorder", "reorder point", "reorder at (3 remaining in inventory)"]), 3),
        bin: pick(record, ["bin", "warehouse location", "location"]),
      }];
      return [];
    });
    const names = payload.map((item) => item.name);
    const { data: existingRows, error: existingError } = names.length
      ? await supabase.from("materials").select("name,cost,previous_cost,price_changed_at,qty,strict_tracking").in("name", names)
      : { data: [], error: null };
    if (existingError) throw existingError;
    const existingByName = new Map((existingRows ?? []).map((item) => [item.name, item]));
    const now = new Date().toISOString();
    const rowsToSave = payload.map(({ imported_on_hand, ...item }) => {
      const existing = existingByName.get(item.name);
      const changed = existing && Number(existing.cost) !== item.cost;
      return {
        ...item,
        qty: existing ? Number(existing.qty) : num(imported_on_hand, 0),
        strict_tracking: hasOnHandColumn ? item.strict_tracking : existing?.strict_tracking ?? true,
        previous_cost: changed ? Number(existing.cost) : existing?.previous_cost ?? null,
        price_changed_at: changed ? now : existing?.price_changed_at ?? null,
      };
    });
    const { error } = await supabase.from("materials").upsert(rowsToSave, { onConflict: "name" });
    if (error) throw error;
    return Response.json({ imported: rowsToSave.length, skipped }, { headers: cors });
  } catch (err) {
    if (err instanceof Response) return err;
    return Response.json({ error: String(err?.message ?? err) }, { status: 500, headers: cors });
  }
});
