import fs from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRole) {
  console.error("Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const managerId = process.env.SOP_SEED_MANAGER_ID;
const crewId = process.env.SOP_SEED_CREW_ID || managerId;
if (!managerId) {
  console.error("Set SOP_SEED_MANAGER_ID to an existing profiles.id. Optional: SOP_SEED_CREW_ID for assigned crew.");
  process.exit(1);
}

const source = fs.readFileSync(new URL("../src/data/seed.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const sandbox = { exports: {}, require: () => ({}) };
vm.runInNewContext(js, sandbox);
const state = sandbox.exports.createSeedState();
const supabase = createClient(url, serviceRole);

function uuid(localId) {
  const hex = crypto.createHash("sha1").update(`sop-plus:${localId}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const mapProfile = (value) => {
  if (!value) return null;
  if (value === "u1" || value === "u2") return managerId;
  return crewId;
};

async function upsert(table, rows, onConflict = "id") {
  if (!rows.length) return;
  const { error } = await supabase.from(table).upsert(rows, { onConflict });
  if (error) throw new Error(`${table}: ${error.message}`);
}

await upsert("prompt_set", state.promptSets.map((item) => ({
  id: uuid(item.id),
  name: item.name,
  prompts: item.prompts,
})));

await upsert("sop_category", state.categories.map((item) => ({
  id: uuid(item.id),
  name: item.name,
  sort_order: item.sortOrder,
  archived: item.archived,
  prompt_set_id: uuid(item.promptSetId),
})));

await upsert("sop", state.sops.map((item) => ({
  id: uuid(item.id),
  title: item.title,
  category_id: uuid(item.categoryId),
  description: item.description,
  status: item.status,
  assigned_to: mapProfile(item.assignedTo),
  created_by: mapProfile(item.createdBy),
  requires_photo: item.requiresPhoto,
  requires_video: item.requiresVideo,
  due_date: item.dueDate ?? null,
  submitted_at: item.submittedAt ?? null,
  approved_at: item.approvedAt ?? null,
  approved_by: mapProfile(item.approvedBy),
  review_comments: item.reviewComments ?? null,
  points_awarded: item.pointsAwarded,
  updated_at: item.updatedAt,
})));

await upsert("sop_step", state.steps.map((item) => ({
  id: uuid(item.id),
  sop_id: uuid(item.sopId),
  sort_order: item.sortOrder,
  text: item.text,
  note: item.note,
})));

console.log("Seeded SOP+ prompt sets, categories, SOP items, and starter steps.");
console.log("Used SOP_SEED_MANAGER_ID for manager-owned rows and SOP_SEED_CREW_ID for crew-assigned rows.");
