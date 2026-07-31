import { createSeedState } from "./seed";
import type { Certification, CertificationType, CrewState, EarningRule, IntegrationDecision, Kpi, Nudge, OrgRole, Profile, ReviewCompetency, ReviewTypeConfig, Reward, Role, RolePermission, ValueRitual } from "../types";

export interface IntakeTabInput {
  name: string;
  csv: string;
}

export interface IntakeImportReport {
  imported: number;
  skipped: Array<{ tab: string; row: number; reason: string }>;
  warnings: string[];
}

export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && next === "\n") i += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export function applyIntakeCsvTabs(state: CrewState, tabs: IntakeTabInput[]) {
  let next = { ...state, pointsEvents: state.pointsEvents };
  const report: IntakeImportReport = {
    imported: 0,
    skipped: [],
    warnings: [
      "Brand color conflict: intake says #1C5CAB / #12A37A; app keeps suite #14A2A4 / #1C1E20 until confirmed.",
    ],
  };

  for (const tab of tabs) {
    const rows = rowsToObjects(parseCsv(tab.csv));
    const key = normalized(tab.name);
    if (key.includes("company")) next = importConfig(next, rows, report, tab.name);
    else if (key.includes("roles") && key.includes("access")) next = importRoles(next, rows, report, tab.name);
    else if (key.includes("team")) next = importTeam(next, rows, report, tab.name);
    else if (key.includes("job descriptions")) next = importJobs(next, rows, report, tab.name);
    else if (key.includes("certification types")) next = importCertTypes(next, rows, report, tab.name);
    else if (key.includes("certifications")) next = importCertifications(next, rows, report, tab.name);
    else if (key.includes("values") && key.includes("rituals")) next = importValues(next, rows, report, tab.name);
    else if (key.includes("review structure")) next = importReviewTypes(next, rows, report, tab.name);
    else if (key.includes("review competencies")) next = importCompetencies(next, rows, report, tab.name);
    else if (key.includes("kpis by role")) next = importKpis(next, rows, report, tab.name);
    else if (key.includes("bonus program")) next = importBonus(next, rows, report);
    else if (key.includes("rewards") && key.includes("earning")) next = importEarning(next, rows, report, tab.name);
    else if (key.includes("rewards") && key.includes("catalog")) next = importCatalog(next, rows, report, tab.name);
    else if (key.includes("nudges") && key.includes("cadence")) next = importNudges(next, rows, report, tab.name);
    else if (key.includes("forms") && key.includes("swot")) next = importForms(next, rows, report, tab.name);
    else if (key.includes("integrations") && key.includes("tech")) next = importIntegrations(next, rows, report, tab.name);
    else report.skipped.push({ tab: tab.name, row: 0, reason: "No importer mapped for this tab yet" });
  }

  return { state: next, report };
}

function importRoles(state: CrewState, rows: Record<string, string>[], report: IntakeImportReport, tab: string): CrewState {
  const byRole = new Map(state.rolePermissions.map((item) => [item.orgRole, item]));
  rows.forEach((row, index) => {
    const role = normalizeRole(valueAt(row, "role name"));
    if (!role) return report.skipped.push({ tab, row: index + 2, reason: "Missing role name" });
    byRole.set(role, {
      orgRole: role,
      appRole: appRoleFor(role),
      reportsTo: valueAt(row, "reports to"),
      permissions: {
        viewOwnData: yes(valueAt(row, "view own data")),
        viewOthersProfiles: scope(valueAt(row, "view others' profiles")),
        viewProbation: yes(valueAt(row, "view probationary period")),
        viewCompensation: yes(valueAt(row, "view compensation")),
        viewBonusDollars: ["CFO", "Operations / Admin", "CEO / Owner", "Operations", "CEO"].includes(role) && yes(valueAt(row, "view bonus $")),
        viewWriteUps: yes(valueAt(row, "view write-ups")),
        manageReviews: yes(valueAt(row, "manage reviews")),
        editConfig: yes(valueAt(row, "edit config")),
        editEmergencyContact: yes(valueAt(row, "edit emergency contact")),
        editAddress: yes(valueAt(row, "edit address")),
        exportReports: yes(valueAt(row, "export reports")),
      },
    } as RolePermission);
    report.imported += 1;
  });
  return { ...state, rolePermissions: Array.from(byRole.values()), permissions: { ...state.permissions, rolePermissions: Array.from(byRole.values()) } };
}

export function createStateFromIntakeCsvTabs(tabs: IntakeTabInput[]) {
  return applyIntakeCsvTabs(createSeedState(), tabs);
}

function importConfig(state: CrewState, rows: Record<string, string>[], report: IntakeImportReport, tab: string): CrewState {
  const byField = new Map(rows.map((row) => [valueAt(row, "field").toLowerCase(), valueAt(row, "your input")]));
  report.imported += byField.size;
  return {
    ...state,
    config: {
      ...state.config,
      legalName: byField.get("company legal name") || state.config.legalName,
      displayName: normalizeDisplayName(byField.get("company display name") || state.config.displayName),
      appName: byField.get("app name") || state.config.appName,
      primaryAdminName: byField.get("primary admin contact (name)") || state.config.primaryAdminName,
      primaryAdminEmail: byField.get("primary admin email") || state.config.primaryAdminEmail,
      timezone: byField.get("timezone") || state.config.timezone,
      weekStartsOn: (byField.get("week starts on") === "Sunday" ? "Sunday" : "Monday"),
      shareLogins: yes(byField.get("share logins with waterproofing+?") ?? ""),
      shareWallet: yes(byField.get("share one points wallet with waterproofing+?") ?? ""),
      intakeBrandPrimary: byField.get("brand primary colour (hex)") || state.config.intakeBrandPrimary,
      intakeBrandAccent: byField.get("brand accent colour (hex)") || state.config.intakeBrandAccent,
      officeAddress: byField.get("office location / address") || state.config.officeAddress,
      dataResidency: byField.get("data residency preference") || state.config.dataResidency,
      pointsAnchor: 0.25,
      intakePointsAnchor: 0.25,
      googleReviewUrl: byField.get("google review url") || state.config.googleReviewUrl,
    },
    walletConfig: { ...state.walletConfig, rewardDollarPerPoint: 0.25 },
  };
}

function importTeam(state: CrewState, rows: Record<string, string>[], report: IntakeImportReport, tab: string): CrewState {
  const byEmployee = new Map(state.users.map((user) => [user.employeeId ?? user.id, user]));
  rows.forEach((row, index) => {
    const employeeId = valueAt(row, "employee id");
    const firstName = valueAt(row, "first name");
    const lastName = valueAt(row, "last name");
    if (!employeeId || !firstName) {
      report.skipped.push({ tab, row: index + 2, reason: "Missing employee id or first name" });
      return;
    }
    const orgRole = normalizeRole(valueAt(row, "role"));
    const existing = byEmployee.get(employeeId);
    byEmployee.set(employeeId, {
      ...(existing ?? { id: employeeId.toLowerCase(), color: "#14A2A4", branch: "field" as const, role: appRoleFor(orgRole), orgRole, name: firstName }),
      employeeId,
      firstName,
      lastName,
      name: valueAt(row, "display name") || firstName,
      orgRole,
      role: appRoleFor(orgRole),
      department: valueAt(row, "department"),
      branch: valueAt(row, "department").toLowerCase() === "office" ? "office" : "field",
      reportsTo: valueAt(row, "reports to"),
      status: (valueAt(row, "status") || "Active") as Profile["status"],
      hireDate: excelDateOrIso(valueAt(row, "start date")) || existing?.hireDate,
      probationEndDate: excelDateOrIso(valueAt(row, "probationary period end date (offer benefits)")) || existing?.probationEndDate,
      agreementSignedDate: excelDateOrIso(valueAt(row, "date employment agreement was signed")) || existing?.agreementSignedDate,
      birthday: birthday(valueAt(row, "birthday (mm-dd)")) || existing?.birthday,
      email: valueAt(row, "email") || existing?.email,
      phone: valueAt(row, "phone") || existing?.phone,
      address: valueAt(row, "address") || existing?.address,
      emergencyContactName: valueAt(row, "emergency contact name") || existing?.emergencyContactName,
      emergencyContactEmail: valueAt(row, "emergency contact email") || existing?.emergencyContactEmail,
      emergencyContactPhone: valueAt(row, "emergency contact phone") || existing?.emergencyContactPhone,
      payBand: valueAt(row, "[admin] pay band") || existing?.payBand,
      bonusRoleWeight: numberOrUndefined(valueAt(row, "[admin] bonus role weight")) ?? existing?.bonusRoleWeight,
    });
    report.imported += 1;
  });
  return { ...state, users: Array.from(byEmployee.values()) };
}

function importJobs(state: CrewState, rows: Record<string, string>[], report: IntakeImportReport, tab: string): CrewState {
  const byId = new Map(state.jobDescriptions.map((item) => [item.id, item]));
  rows.forEach((row, index) => {
    const role = normalizeRole(valueAt(row, "role"));
    const responsibility = valueAt(row, "responsibility (one per row)");
    if (!role || !responsibility) return report.skipped.push({ tab, row: index + 2, reason: "Missing role or responsibility" });
    const id = slug(`${role}-${responsibility}`);
    byId.set(id, { id, role, version: valueAt(row, "jd version"), responsibility, requiredCertifications: splitList(valueAt(row, "required certifications")), linkedKpis: splitList(valueAt(row, "linked kpi(s)")), reportsTo: valueAt(row, "reports to") });
    report.imported += 1;
  });
  return { ...state, jobDescriptions: Array.from(byId.values()) };
}

function importCertTypes(state: CrewState, rows: Record<string, string>[], report: IntakeImportReport, tab: string): CrewState {
  const byName = new Map(state.certificationTypes.map((item) => [normalized(item.name), item]));
  rows.forEach((row, index) => {
    const name = valueAt(row, "certification type");
    if (!name) return report.skipped.push({ tab, row: index + 2, reason: "Missing certification type" });
    byName.set(normalized(name), { id: byName.get(normalized(name))?.id ?? slug(`ct-${name}`), name, category: valueAt(row, "category"), issuingBody: valueAt(row, "typical issuing body") || undefined, validityMonths: numberOrUndefined(valueAt(row, "validity (months)")), alertLeadDays: splitList(valueAt(row, "alert lead (days)")).map(Number).filter((item) => Number.isFinite(item)), requiredForRoles: splitList(valueAt(row, "required for roles")), notes: valueAt(row, "notes") || undefined } as CertificationType);
    report.imported += 1;
  });
  return { ...state, certificationTypes: Array.from(byName.values()) };
}

function importCertifications(state: CrewState, rows: Record<string, string>[], report: IntakeImportReport, tab: string): CrewState {
  const byId = new Map(state.certifications.map((item) => [item.id, item]));
  rows.forEach((row, index) => {
    const employee = valueAt(row, "employee");
    const name = valueAt(row, "certification type");
    const user = findUserByDisplay(state, employee);
    if (!user || !name) return report.skipped.push({ tab, row: index + 2, reason: "Missing/unknown employee or certification" });
    const type = state.certificationTypes.find((item) => normalized(item.name) === normalized(name));
    const id = slug(`cert-${user.employeeId ?? user.id}-${name}`);
    byId.set(id, { id, userId: user.id, certTypeId: type?.id, name, issuingBody: valueAt(row, "issuing body") || undefined, issuedAt: excelDateOrIso(valueAt(row, "issue date")) || undefined, expiresAt: excelDateOrIso(valueAt(row, "expiry date")) || undefined, status: statusFor(valueAt(row, "status")), scanFile: valueAt(row, "certificate scan (file)") || undefined, note: valueAt(row, "notes") || undefined } as Certification);
    report.imported += 1;
  });
  return { ...state, certifications: Array.from(byId.values()) };
}

function importValues(state: CrewState, rows: Record<string, string>[], report: IntakeImportReport, tab: string): CrewState {
  const byId = new Map(state.valueRituals.map((item) => [item.id, item]));
  rows.forEach((row, index) => {
    const value = valueAt(row, "value");
    const cadence = valueAt(row, "cadence").toLowerCase() as ValueRitual["cadence"];
    if (!value || !["daily", "weekly", "monthly"].includes(cadence)) return report.skipped.push({ tab, row: index + 2, reason: "Missing value or cadence" });
    const valueId = state.values.find((item) => normalized(item.name) === normalized(value))?.id ?? slug(value);
    byId.set(`${valueId}-${cadence}`, { id: `${valueId}-${cadence}`, valueId, value, cadence, prompt: valueAt(row, "ritual / prompt text"), exercise: valueAt(row, "exercise"), points: Number(valueAt(row, "points")) || 0, active: yes(valueAt(row, "active")) });
    report.imported += 1;
  });
  return { ...state, valueRituals: Array.from(byId.values()) };
}

function importReviewTypes(state: CrewState, rows: Record<string, string>[], report: IntakeImportReport, tab: string): CrewState {
  const imported: ReviewTypeConfig[] = [];
  rows.forEach((row, index) => {
    const type = valueAt(row, "review type");
    if (!type || type.toLowerCase().includes("scale value")) return;
    imported.push({ id: slug(type), type, appliesTo: valueAt(row, "applies to"), cadence: valueAt(row, "timing / cadence"), ratingScale: valueAt(row, "rating scale"), purpose: valueAt(row, "purpose") });
    report.imported += 1;
  });
  return imported.length ? { ...state, reviewTypes: imported } : state;
}

function importCompetencies(state: CrewState, rows: Record<string, string>[], report: IntakeImportReport, tab: string): CrewState {
  const items: ReviewCompetency[] = [];
  rows.forEach((row, index) => {
    const competency = valueAt(row, "competency / benchmark");
    if (!competency) return report.skipped.push({ tab, row: index + 2, reason: "Missing competency" });
    items.push({ id: slug(competency), competency, appliesToRoles: splitList(valueAt(row, "applies to role(s)")), description: valueAt(row, "description"), weightPercent: numberOrUndefined(valueAt(row, "weight %")) });
    report.imported += 1;
  });
  return items.length ? { ...state, reviewCompetencies: items } : state;
}

function importKpis(state: CrewState, rows: Record<string, string>[], report: IntakeImportReport, tab: string): CrewState {
  const byId = new Map(state.kpis.map((item) => [item.id, item]));
  rows.forEach((row, index) => {
    const role = normalizeRole(valueAt(row, "role"));
    const name = valueAt(row, "kpi name");
    if (!role || !name) return report.skipped.push({ tab, row: index + 2, reason: "Missing role or KPI name" });
    const id = slug(`kpi-${role}-${name}`);
    byId.set(id, { id, role, name, description: valueAt(row, "description"), unit: valueAt(row, "unit"), target: valueAt(row, "target"), period: periodFor(valueAt(row, "cadence")), dataSource: valueAt(row, "data source"), active: yes(valueAt(row, "active")) } as Kpi);
    report.imported += 1;
  });
  return { ...state, kpis: Array.from(byId.values()) };
}

function importBonus(state: CrewState, rows: Record<string, string>[], report: IntakeImportReport): CrewState {
  const byParam = new Map(rows.map((row) => [valueAt(row, "parameter").toLowerCase() || valueAt(row, "role").toLowerCase(), valueAt(row, "your input") || valueAt(row, "weight")]));
  report.imported += byParam.size;
  return {
    ...state,
    bonusConfig: {
      ...state.bonusConfig,
      payoutTiming: byParam.get("payout timing") || state.bonusConfig.payoutTiming,
      quarterlyComponent: yes(byParam.get("add a quarterly component?") ?? ""),
      tenureBump: numberOrUndefined(byParam.get("tenure bump included?") ?? "") ?? state.bonusConfig.tenureBump,
      floorsCaps: byParam.get("minimum floor / maximum cap?") || state.bonusConfig.floorsCaps,
      whoConfirmsProfit: byParam.get("who confirms the profit figure") || state.bonusConfig.whoConfirmsProfit,
      whoApprovesPayouts: byParam.get("who approves final payouts") || state.bonusConfig.whoApprovesPayouts,
    },
  };
}

function importEarning(state: CrewState, rows: Record<string, string>[], report: IntakeImportReport, tab: string): CrewState {
  const byAction = new Map(state.earningRules.map((rule) => [normalized(rule.action), rule]));
  rows.forEach((row, index) => {
    const action = valueAt(row, "action / trigger");
    const points = Number(valueAt(row, "points"));
    if (!action || !Number.isFinite(points)) {
      report.skipped.push({ tab, row: index + 2, reason: "Missing action or numeric points" });
      return;
    }
    const existing = byAction.get(normalized(action));
    byAction.set(normalized(action), {
      ...(existing ?? { id: slug(action), source: sourceFor(valueAt(row, "source app")), habit: false }),
      action,
      points,
      weeklyCap: cap(valueAt(row, "weekly cap")),
      source: sourceFor(valueAt(row, "source app")),
      habit: Boolean(cap(valueAt(row, "weekly cap"))),
      active: yes(valueAt(row, "active")),
    } as EarningRule);
    report.imported += 1;
  });
  return { ...state, earningRules: Array.from(byAction.values()) };
}

function importCatalog(state: CrewState, rows: Record<string, string>[], report: IntakeImportReport, tab: string): CrewState {
  const byName = new Map(state.rewards.map((reward) => [normalized(reward.name), reward]));
  rows.forEach((row, index) => {
    const name = valueAt(row, "reward");
    if (!name) {
      report.skipped.push({ tab, row: index + 2, reason: "Missing reward name" });
      return;
    }
    const existing = byName.get(normalized(name));
    byName.set(normalized(name), {
      ...(existing ?? { id: slug(name) }),
      name,
      points: Number(valueAt(row, "point cost")) || 0,
      approxValue: valueAt(row, "approx $ value"),
      limitStock: valueAt(row, "limit / stock"),
      active: yes(valueAt(row, "active")),
      note: "Catalog price uses the confirmed $0.25/point anchor.",
    } as Reward);
    report.imported += 1;
  });
  return { ...state, rewards: Array.from(byName.values()) };
}

function importNudges(state: CrewState, rows: Record<string, string>[], report: IntakeImportReport, tab: string): CrewState {
  const nudges: Nudge[] = [];
  rows.forEach((row, index) => {
    const name = valueAt(row, "nudge name");
    if (!name) return report.skipped.push({ tab, row: index + 2, reason: "Missing nudge name" });
    nudges.push({ id: slug(name), name, triggerType: valueAt(row, "trigger type").toLowerCase().includes("date") ? "date-driven" : "cadence", cadence: valueAt(row, "cadence / timing"), audience: valueAt(row, "audience"), channel: valueAt(row, "channel"), leadTime: valueAt(row, "lead time"), active: yes(valueAt(row, "active")), type: "ritual", title: name, dueAt: "2026-07-29T08:00:00-07:00", read: false });
    report.imported += 1;
  });
  return nudges.length ? { ...state, nudges } : state;
}

function importForms(state: CrewState, rows: Record<string, string>[], report: IntakeImportReport, tab: string): CrewState {
  const forms = new Map(state.forms.map((item) => [item.name, item]));
  const questions = new Map(state.formQuestions.map((item) => [item.id, item]));
  rows.forEach((row, index) => {
    const formName = valueAt(row, "form");
    const order = Number(valueAt(row, "order"));
    if (!formName || !Number.isFinite(order)) return report.skipped.push({ tab, row: index + 2, reason: "Missing form or order" });
    const formId = forms.get(formName)?.id ?? slug(`form-${formName}`);
    const anonymousAllowed = yes(valueAt(row, "anonymous allowed"));
    forms.set(formName, { id: formId, name: formName, anonymousAllowed });
    questions.set(`${formId}-${order}`, { id: `${formId}-${order}`, formId, order, question: valueAt(row, "question text"), responseType: valueAt(row, "response type").includes("Scale") ? "Scale 1-5" : "Text", required: yes(valueAt(row, "required")), anonymousAllowed });
    report.imported += 1;
  });
  return { ...state, forms: Array.from(forms.values()), formQuestions: Array.from(questions.values()) };
}

function importIntegrations(state: CrewState, rows: Record<string, string>[], report: IntakeImportReport, tab: string): CrewState {
  const items: IntegrationDecision[] = [];
  rows.forEach((row, index) => {
    const name = valueAt(row, "integration / decision");
    if (!name) return report.skipped.push({ tab, row: index + 2, reason: "Missing integration name" });
    items.push({ id: slug(name), name, needed: (valueAt(row, "needed?") || "No") as IntegrationDecision["needed"], details: valueAt(row, "details / account / notes") });
    report.imported += 1;
  });
  return items.length ? { ...state, integrations: items } : state;
}

function rowsToObjects(rows: string[][]) {
  const headerIndex = rows.findIndex((row) => row.some(isHeaderCell));
  if (headerIndex < 0) return [];
  const headers = rows[headerIndex].map(normalized);
  return rows.slice(headerIndex + 1).filter((row) => row.some(Boolean)).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

function isHeaderCell(cell: string) {
  return [
    "employee id",
    "field",
    "action / trigger",
    "reward",
    "role name",
    "role",
    "certification type",
    "employee",
    "review type",
    "competency / benchmark",
    "kpi name",
    "parameter",
    "nudge name",
    "form",
    "integration / decision",
  ].includes(normalized(cell));
}

function valueAt(row: Record<string, string>, key: string) {
  return row[normalized(key)]?.trim() ?? "";
}

function normalizeRole(value: string): OrgRole {
  const role = value.trim();
  if (role === "Operations/Admin") return "Operations / Admin";
  if (role === "CEO/Owner") return "CEO / Owner";
  if (role === "Assistant Tech") return "Assistant Technician";
  return (role || "Technician") as OrgRole;
}

function appRoleFor(role: OrgRole): Role {
  if (role === "Crew Lead") return "manager";
  if (["Operations / Admin", "Operations", "CFO", "CEO / Owner", "CEO"].includes(role)) return "admin";
  return "crew";
}

function sourceFor(value: string): EarningRule["source"] {
  const v = value.toLowerCase();
  if (v.includes("waterproofing")) return "warehouse";
  if (v.includes("sop")) return "sop";
  return "crew";
}

function findUserByDisplay(state: CrewState, name: string) {
  return state.users.find((user) => [user.name, user.firstName, user.lastName, `${user.firstName} ${user.lastName}`].some((candidate) => normalized(candidate ?? "") === normalized(name)));
}

function scope(value: string): boolean | "team" | "all" {
  const v = value.toLowerCase();
  if (v.includes("all")) return "all";
  if (v.includes("team")) return "team";
  return yes(value);
}

function statusFor(value: string): Certification["status"] {
  const v = value.toLowerCase();
  if (v.includes("expired") || v.includes("overdue")) return "expired";
  if (v.includes("missing")) return "missing";
  if (!v || v.includes("date")) return "date_needed";
  return "active";
}

function periodFor(value: string): Kpi["period"] {
  const v = value.toLowerCase();
  if (v.includes("annual")) return "annual";
  if (v.includes("quarter")) return "quarterly";
  return "monthly";
}

function cap(value: string) {
  return value && value !== "-" && value !== "—" ? Number(value) || undefined : undefined;
}

function yes(value: string) {
  return ["y", "yes", "true", "combined leaderboard"].includes(value.toLowerCase());
}

function numberOrUndefined(value: string) {
  const n = Number(value);
  return Number.isFinite(n) && value !== "" ? n : undefined;
}

function splitList(value: string) {
  return value.split(/[,;/]/).map((item) => item.trim()).filter(Boolean);
}

function excelDateOrIso(value: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const serial = Number(value);
  if (!Number.isFinite(serial)) return "";
  const date = new Date(Date.UTC(1899, 11, 30 + serial));
  return date.toISOString().slice(0, 10);
}

function birthday(value: string) {
  if (!value) return "";
  if (/^\d{2}-\d{2}$/.test(value)) return value;
  const iso = excelDateOrIso(value);
  return iso ? iso.slice(5) : value;
}

function normalizeDisplayName(value: string) {
  return value.replace("Wateproofing", "Waterproofing");
}

function normalized(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
