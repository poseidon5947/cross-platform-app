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

const profileMap = process.env.CREW_PROFILE_MAP_JSON
  ? JSON.parse(process.env.CREW_PROFILE_MAP_JSON)
  : {
      u1: process.env.CREW_SEED_ADMIN_ID,
      u2: process.env.CREW_SEED_MANAGER_ID || process.env.CREW_SEED_ADMIN_ID,
      u3: process.env.CREW_SEED_CREW_ID,
    };

if (!profileMap.u1 || !profileMap.u2 || !profileMap.u3) {
  console.error("Set CREW_PROFILE_MAP_JSON for all 12 local ids, or at least CREW_SEED_ADMIN_ID, CREW_SEED_MANAGER_ID, and CREW_SEED_CREW_ID.");
  process.exit(1);
}

const source = fs.readFileSync(new URL("../src/data/seed.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const sandbox = { exports: {}, require: () => ({}) };
vm.runInNewContext(js, sandbox);
const state = sandbox.exports.createSeedState();
const supabase = createClient(url, serviceRole);

const mapUser = (localId) => profileMap[localId] || profileMap.u3;

async function upsert(table, rows, onConflict = "id") {
  if (!rows.length) return;
  const { error } = await supabase.from(table).upsert(rows, { onConflict });
  if (error) throw new Error(`${table}: ${error.message}`);
}

await upsert("profiles", state.users.filter((user) => profileMap[user.id]).map((user) => ({
  id: profileMap[user.id],
  employee_id: user.employeeId ?? null,
  first_name: user.firstName ?? null,
  last_name: user.lastName ?? null,
  name: user.name,
  email: user.email ?? `${user.id}@crew-plus.local`,
  role: user.role,
  color: user.color,
  org_role: user.orgRole,
  department: user.department ?? null,
  employment_status: user.status ?? null,
  branch: user.branch,
  manager_id: user.managerId ? mapUser(user.managerId) : null,
  reports_to: user.reportsTo ?? null,
  hire_date: user.hireDate ?? null,
  probation_end_date: user.probationEndDate ?? null,
  agreement_signed_date: user.agreementSignedDate ?? null,
  birthday: user.birthday ?? null,
  phone: user.phone ?? null,
  address: user.address ?? null,
  emergency_contact_name: user.emergencyContactName ?? null,
  emergency_contact_email: user.emergencyContactEmail ?? null,
  emergency_contact_phone: user.emergencyContactPhone ?? null,
  pay_band: user.payBand ?? null,
  bonus_role_weight: user.bonusRoleWeight ?? null,
})));

await upsert("crew_config", [{
  id: state.config.id,
  legal_name: state.config.legalName,
  display_name: state.config.displayName,
  app_name: state.config.appName,
  primary_admin_name: state.config.primaryAdminName,
  primary_admin_email: state.config.primaryAdminEmail,
  timezone: state.config.timezone,
  week_starts_on: state.config.weekStartsOn,
  share_logins: state.config.shareLogins,
  share_wallet: state.config.shareWallet,
  official_brand_primary: state.config.officialBrandPrimary,
  official_brand_accent: state.config.officialBrandAccent,
  intake_brand_primary: state.config.intakeBrandPrimary,
  intake_brand_accent: state.config.intakeBrandAccent,
  points_anchor: state.config.pointsAnchor,
  intake_points_anchor: state.config.intakePointsAnchor,
  google_review_url: state.config.googleReviewUrl,
  office_address: state.config.officeAddress ?? null,
  data_residency: state.config.dataResidency ?? null,
}]);

await upsert("crew_role_permission", state.rolePermissions.map((item) => ({
  org_role: item.orgRole,
  app_role: item.appRole,
  reports_to: item.reportsTo,
  permissions: item.permissions,
})), "org_role");

await upsert("crew_value", state.values.map((item) => ({
  id: cryptoId(item.id),
  name: item.name,
  wording: item.wording,
  daily_ritual: item.dailyRitual,
  weekly_ritual: item.weeklyRitual,
  monthly_ritual: item.monthlyRitual,
  exercise: item.exercise,
  active: item.active,
})));

await upsert("crew_value_ritual", state.valueRituals.map((item) => ({
  id: item.id,
  value_id: cryptoId(item.valueId),
  value_name: item.value,
  cadence: item.cadence,
  prompt: item.prompt,
  exercise: item.exercise,
  points: item.points,
  active: item.active,
})));

await upsert("crew_earning_rule", state.earningRules.map((item) => ({
  id: item.id,
  action: item.action,
  points: item.points,
  source: item.source,
  weekly_cap: item.weeklyCap ?? null,
  habit: item.habit,
  active: item.active,
})));

await upsert("crew_reward", state.rewards.map((item) => ({
  id: cryptoId(item.id),
  name: item.name,
  points: item.points,
  approx_value: item.approxValue ?? null,
  limit_stock: item.limitStock ?? null,
  active: item.active,
  note: item.note ?? null,
})));

await upsert("points_events", state.pointsEvents.map((item) => ({
  id: cryptoId(item.id),
  user_id: mapUser(item.userId),
  type: item.type,
  points: item.points,
  reason: item.reason,
  ref: item.ref,
  ts: item.ts,
})), "type,ref");

await upsert("crew_kpi", state.kpis.map((item) => ({
  id: cryptoId(item.id),
  org_role: item.role,
  name: item.name,
  description: item.description ?? "",
  unit: item.unit ?? "",
  target: item.target,
  period: item.period,
  data_source: item.dataSource ?? "",
  active: item.active,
})));

await upsert("crew_bonus_config", [{
  id: cryptoId(state.bonusConfig.id),
  profit_share_percent: state.bonusConfig.profitSharePercent,
  role_weights: state.bonusConfig.roleWeights,
  rating_factors: state.bonusConfig.ratingFactors,
  floors_caps: state.bonusConfig.floorsCaps,
  tenure_bump: state.bonusConfig.tenureBump,
  payout_timing: state.bonusConfig.payoutTiming ?? "December",
  quarterly_component: state.bonusConfig.quarterlyComponent ?? false,
  who_confirms_profit: state.bonusConfig.whoConfirmsProfit ?? "CFO",
  who_approves_payouts: state.bonusConfig.whoApprovesPayouts ?? "CEO",
}]);

await upsert("crew_bonus_role_weight", state.bonusRoleWeights.map((item) => ({
  org_role: item.orgRole,
  weight: item.weight ?? null,
  notes: item.notes ?? null,
})), "org_role");

await upsert("crew_bonus_period", state.bonusPeriods.map((item) => ({
  id: cryptoId(item.id),
  year: item.year,
  annual_profit: item.annualProfit,
  pool_percent: item.poolPercent,
  status: item.status,
})), "year");

await upsert("crew_certification", state.certifications.map((item) => ({
  id: cryptoId(item.id),
  user_id: mapUser(item.userId),
  cert_type_id: item.certTypeId ?? null,
  name: item.name,
  issuing_body: item.issuingBody ?? null,
  issued_at: item.issuedAt ?? null,
  expires_at: item.expiresAt ?? null,
  status: item.status,
  scan_file: item.scanFile ?? null,
  note: item.note ?? null,
})));

await upsert("crew_cert_type", state.certificationTypes.map((item) => ({
  id: item.id,
  name: item.name,
  category: item.category,
  issuing_body: item.issuingBody ?? null,
  validity_months: item.validityMonths ?? null,
  alert_lead_days: item.alertLeadDays,
  required_for_roles: item.requiredForRoles,
  notes: item.notes ?? null,
})));

await upsert("crew_review", state.reviews.map((item) => ({
  id: cryptoId(item.id),
  user_id: mapUser(item.userId),
  manager_id: mapUser(item.managerId),
  type: item.type,
  scheduled_for: item.scheduledFor,
  completed_at: item.completedAt ?? null,
  status: item.status,
  ratings: item.ratings,
  notes: item.notes,
  swot: item.swot ?? "",
})));

await upsert("crew_review_type", state.reviewTypes.map((item) => ({
  id: item.id,
  type: item.type,
  applies_to: item.appliesTo,
  cadence: item.cadence,
  rating_scale: item.ratingScale,
  purpose: item.purpose,
})));

await upsert("crew_rating_scale", state.ratingScale.map((item) => ({
  label: item.label,
  value: item.value,
  meaning: item.meaning,
  performance_factor: item.performanceFactor,
})), "label");

await upsert("crew_review_competency", state.reviewCompetencies.map((item) => ({
  id: item.id,
  competency: item.competency,
  applies_to_roles: item.appliesToRoles,
  description: item.description,
  weight_percent: item.weightPercent ?? null,
})));

await upsert("crew_job_description", state.jobDescriptions.map((item) => ({
  id: item.id,
  org_role: item.role,
  jd_version: item.version,
  responsibility: item.responsibility,
  required_certifications: item.requiredCertifications,
  linked_kpis: item.linkedKpis,
  reports_to: item.reportsTo,
})));

await upsert("crew_form", state.forms.map((item) => ({
  id: item.id,
  name: item.name,
  anonymous_allowed: item.anonymousAllowed,
})));

await upsert("crew_form_question", state.formQuestions.map((item) => ({
  id: item.id,
  form_id: item.formId,
  sort_order: item.order,
  question: item.question,
  response_type: item.responseType,
  required: item.required,
  anonymous_allowed: item.anonymousAllowed,
})));

await upsert("crew_integration_decision", state.integrations.map((item) => ({
  id: item.id,
  name: item.name,
  needed: item.needed,
  details: item.details,
})));

await upsert("crew_nudge", state.nudges.map((item) => ({
  id: item.id,
  user_id: item.userId ? mapUser(item.userId) : mapUser("u8"),
  type: item.type,
  name: item.name ?? item.title,
  trigger_type: item.triggerType ?? null,
  cadence: item.cadence ?? null,
  audience: item.audience ?? null,
  channel: item.channel ?? null,
  lead_time: item.leadTime ?? null,
  active: item.active ?? true,
  title: item.title,
  due_at: item.dueAt,
  read: item.read,
})));

console.log("Seeded Crew+ intake config, role matrix, roster, values/rituals, earning rules, rewards, KPIs, bonus config, cert types/roster, reviews, forms, nudges, and integration decisions.");

function cryptoId(value) {
  const hex = crypto.createHash("sha1").update(`crew-plus:${value}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
