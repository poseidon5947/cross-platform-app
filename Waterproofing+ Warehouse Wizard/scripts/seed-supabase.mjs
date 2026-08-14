import vm from "node:vm";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRole) {
  console.error("Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

// Bundle seed.ts with its local imports (e.g. ./business.ts) resolved for
// real, rather than transpiling it in isolation with a stubbed require().
const bundle = await esbuild.build({
  entryPoints: [fileURLToPath(new URL("../src/data/seed.ts", import.meta.url))],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  target: "es2022",
});
const js = bundle.outputFiles[0].text;
const moduleObj = { exports: {} };
const sandbox = { exports: moduleObj.exports, module: moduleObj, require: () => ({}), console };
vm.createContext(sandbox);
vm.runInContext(js, sandbox);
const seedExports = moduleObj.exports.createSeedState ? moduleObj.exports : sandbox.exports;
const state = seedExports.createSeedState();
const supabase = createClient(url, serviceRole);

function uuid(localId) {
  const hex = crypto.createHash("sha1").update(`warehouse-wizard:${localId}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const idMap = new Map();
for (const collection of [state.materials, state.sites, state.tools, state.trucks, state.truckTasks, state.users]) {
  for (const item of collection) idMap.set(item.id, uuid(item.id));
}
const mapId = (value) => value ? idMap.get(value) ?? value : null;

async function upsert(table, rows, onConflict = "id") {
  if (!rows.length) return;
  const { error } = await supabase.from(table).upsert(rows, { onConflict });
  if (error) throw new Error(`${table}: ${error.message}`);
}

await upsert("services", state.services.map((s) => ({ id: s.id, name: s.name })));
await upsert("materials", state.materials.map((m) => ({
  id: uuid(m.id),
  name: m.name,
  category: m.category,
  unit: m.unit,
  step: m.step,
  pack: m.pack,
  units_per_pallet: m.unitsPerPallet,
  cost: m.cost,
  qty: m.qty,
  reorder_point: m.reorderPoint,
  bin: m.bin,
})));
await upsert("sites", state.sites.map((s) => ({ id: uuid(s.id), name: s.name, address: s.address, source: s.source })));
await upsert("tools", state.tools.map((t) => ({
  id: uuid(t.id),
  name: t.name,
  service_id: t.serviceId,
  battery: t.battery,
  status: t.status,
  condition: t.condition,
  last_charged: t.lastCharged ?? null,
  note: t.note ?? null,
  out_by: null, // demo seed user ids don't correspond to real auth.users rows
  out_job: mapId(t.outJob),
  out_service: t.outService ?? null,
  out_ts: t.outTs ?? null,
})));
await upsert("trucks", state.trucks.map((t) => ({ id: uuid(t.id), name: t.name, km: t.km, last_serviced: t.lastServiced, last_oil: t.lastOil })));
await upsert("truck_tasks", state.truckTasks.map((t) => ({
  id: uuid(t.id),
  text: t.text,
  service_id: t.serviceId,
  freq: t.freq,
  time_of_day: t.timeOfDay ?? null,
  required_for_daily_points: t.requiredForDailyPoints ?? true,
})));

console.log("Seeded services, materials, sites, tools, trucks, and truck tasks.");
console.log("Create Supabase Auth users first, then insert matching profiles rows for their auth.users UUIDs.");
