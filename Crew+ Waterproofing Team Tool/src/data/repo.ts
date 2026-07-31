import { supabase } from "../integrations/supabase";
import type { CrewState, PointsEvent, Profile } from "../types";

function requireClient() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await requireClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export async function signOut() {
  const { error } = await requireClient().auth.signOut();
  if (error) throw error;
}

export async function getCurrentSession() {
  const { data, error } = await requireClient().auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function loadRemoteState(currentUserId: string): Promise<Partial<CrewState>> {
  const [profiles, pointsEvents, rewards, redemptions, values, valueRituals, earningRules, reviews, reviewTypes, ratingScale, reviewCompetencies, kpis, kpiResults, bonusConfigs, bonusRoleWeights, certifications, certificationTypes, recognitions, nudges, forms, formQuestions, integrations, rolePermissions, jobDescriptions, configs] = await Promise.all([
    read("profiles", profileFromRow, "name"),
    read("points_events", pointsFromRow, "ts"),
    read("crew_reward", (row) => ({ id: row.id, name: row.name, points: Number(row.points), approxValue: row.approx_value ?? undefined, limitStock: row.limit_stock ?? undefined, active: row.active, note: row.note ?? undefined }), "points"),
    read("crew_reward_redemption", (row) => ({ id: row.id, userId: row.user_id, rewardId: row.reward_id, points: Number(row.points), status: row.status, requestedAt: row.requested_at, approvedAt: row.approved_at ?? undefined, approvedBy: row.approved_by ?? undefined, externalRef: row.external_ref ?? undefined }), "requested_at"),
    read("crew_value", (row) => ({ id: row.id, name: row.name, wording: row.wording, dailyRitual: row.daily_ritual, weeklyRitual: row.weekly_ritual, monthlyRitual: row.monthly_ritual, exercise: row.exercise, active: row.active }), "name"),
    read("crew_value_ritual", (row) => ({ id: row.id, valueId: row.value_id, value: row.value_name, cadence: row.cadence, prompt: row.prompt, exercise: row.exercise, points: Number(row.points), active: row.active }), "id"),
    read("crew_earning_rule", (row) => ({ id: row.id, action: row.action, points: Number(row.points), source: row.source, weeklyCap: row.weekly_cap == null ? undefined : Number(row.weekly_cap), habit: row.habit, active: row.active }), "action"),
    read("crew_review", (row) => ({ id: row.id, userId: row.user_id, managerId: row.manager_id, type: row.type, scheduledFor: row.scheduled_for, completedAt: row.completed_at ?? undefined, status: row.status, ratings: row.ratings ?? {}, notes: row.notes ?? "", swot: row.swot ?? "" }), "scheduled_for"),
    read("crew_review_type", (row) => ({ id: row.id, type: row.type, appliesTo: row.applies_to, cadence: row.cadence, ratingScale: row.rating_scale, purpose: row.purpose }), "id"),
    read("crew_rating_scale", (row) => ({ label: row.label, value: Number(row.value), meaning: row.meaning, performanceFactor: Number(row.performance_factor) }), "value"),
    read("crew_review_competency", (row) => ({ id: row.id, competency: row.competency, appliesToRoles: row.applies_to_roles ?? [], description: row.description, weightPercent: row.weight_percent == null ? undefined : Number(row.weight_percent) }), "id"),
    read("crew_kpi", (row) => ({ id: row.id, role: row.org_role, name: row.name, description: row.description ?? "", unit: row.unit ?? "", target: row.target ?? "", period: row.period, dataSource: row.data_source ?? "", active: row.active }), "org_role"),
    read("crew_kpi_result", (row) => ({ id: row.id, kpiId: row.kpi_id, userId: row.user_id, periodKey: row.period_key, status: row.status, value: row.value ?? undefined, pointsEventRef: row.points_event_ref ?? undefined }), "period_key"),
    read("crew_bonus_config", (row) => ({ id: row.id, profitSharePercent: Number(row.profit_share_percent), roleWeights: row.role_weights ?? {}, ratingFactors: row.rating_factors ?? {}, floorsCaps: row.floors_caps, tenureBump: Number(row.tenure_bump), payoutTiming: row.payout_timing, quarterlyComponent: row.quarterly_component, whoConfirmsProfit: row.who_confirms_profit, whoApprovesPayouts: row.who_approves_payouts, model: row.model ?? undefined, scoreBands: row.score_bands ?? undefined, eligibilityRules: row.eligibility_rules ?? undefined, discretionary: row.discretionary ?? undefined, reviewAverageSource: row.review_average_source ?? undefined, grossWagesPending: row.gross_wages_pending ?? undefined }), "created_at"),
    read("crew_bonus_role_weight", (row) => ({ orgRole: row.org_role, weight: row.weight == null ? undefined : Number(row.weight), notes: row.notes ?? undefined }), "org_role"),
    read("crew_certification", (row) => ({ id: row.id, userId: row.user_id, certTypeId: row.cert_type_id ?? undefined, name: row.name, issuingBody: row.issuing_body ?? undefined, issuedAt: row.issued_at ?? undefined, courseDate: row.course_date ?? undefined, expiresAt: row.expires_at ?? undefined, certificateNumber: row.certificate_number ?? undefined, certificatePhotoKey: row.certificate_photo_key ?? undefined, status: row.status, scanFile: row.scan_file ?? undefined, note: row.note ?? undefined }), "name"),
    read("crew_cert_type", (row) => ({ id: row.id, name: row.name, category: row.category, issuingBody: row.issuing_body ?? undefined, validityMonths: row.validity_months == null ? undefined : Number(row.validity_months), alertLeadDays: row.alert_lead_days ?? [], requiredForRoles: row.required_for_roles ?? [], notes: row.notes ?? undefined }), "name"),
    read("crew_recognition", (row) => ({ id: row.id, fromUserId: row.from_user_id, toUserId: row.to_user_id, message: row.message, ts: row.ts, pointsEventRef: row.points_event_ref ?? undefined }), "ts"),
    read("crew_nudge", (row) => ({ id: row.id, userId: row.user_id ?? undefined, name: row.name ?? row.title, triggerType: row.trigger_type ?? undefined, cadence: row.cadence ?? undefined, audience: row.audience ?? undefined, channel: row.channel ?? undefined, leadTime: row.lead_time ?? undefined, active: row.active ?? true, type: row.type, title: row.title, dueAt: row.due_at, read: row.read }), "due_at"),
    read("crew_form", (row) => ({ id: row.id, name: row.name, anonymousAllowed: row.anonymous_allowed }), "name"),
    read("crew_form_question", (row) => ({ id: row.id, formId: row.form_id, order: Number(row.sort_order), question: row.question, responseType: row.response_type, required: row.required, anonymousAllowed: row.anonymous_allowed, visibility: row.visibility ?? "both", options: row.options ?? undefined }), "sort_order"),
    read("crew_integration_decision", (row) => ({ id: row.id, name: row.name, needed: row.needed, details: row.details }), "name"),
    read("crew_role_permission", (row) => ({ orgRole: row.org_role, appRole: row.app_role, reportsTo: row.reports_to, permissions: row.permissions ?? {} }), "org_role"),
    read("crew_job_description", (row) => ({ id: row.id, role: row.org_role, version: row.jd_version, responsibility: row.responsibility, requiredCertifications: row.required_certifications ?? [], linkedKpis: row.linked_kpis ?? [], reportsTo: row.reports_to }), "org_role"),
    read("crew_config", (row) => ({ id: row.id, legalName: row.legal_name, displayName: row.display_name, appName: row.app_name, primaryAdminName: row.primary_admin_name, primaryAdminEmail: row.primary_admin_email, timezone: row.timezone, weekStartsOn: row.week_starts_on, shareLogins: row.share_logins, shareWallet: row.share_wallet, officialBrandPrimary: row.official_brand_primary, officialBrandAccent: row.official_brand_accent, intakeBrandPrimary: row.intake_brand_primary, intakeBrandAccent: row.intake_brand_accent, pointsAnchor: Number(row.points_anchor), intakePointsAnchor: Number(row.intake_points_anchor), googleReviewUrl: row.google_review_url ?? "", officeAddress: row.office_address ?? undefined, dataResidency: row.data_residency ?? undefined }), "id"),
  ]);
  return { currentUserId, config: configs[0], users: profiles, rolePermissions, jobDescriptions, pointsEvents, rewards, redemptions, values, valueRituals, earningRules, reviews, reviewTypes, ratingScale, reviewCompetencies, kpis, kpiResults, bonusConfig: bonusConfigs[0], bonusRoleWeights, certifications, certificationTypes, recognitions, nudges, forms, formQuestions, integrations };
}

export async function awardPoints(payload: { userId: string; ruleKey: string; ref: string; weekKey?: string }) {
  const { data, error } = await requireClient().functions.invoke("award-points", {
    body: { kind: payload.ruleKey === "redeem" ? "redeem" : "crew_rule", crewMemberId: payload.userId, ruleKey: payload.ruleKey, ref: payload.ref, weekKey: payload.weekKey },
  });
  if (error) throw error;
  return data as { eventId: string; awardedAt: string; alreadyAwarded: boolean };
}

export async function redeemPoints(payload: { userId: string; points: number; reason: string; ref: string }) {
  return awardPoints({ userId: payload.userId, ruleKey: "redeem", ref: payload.ref });
}

async function read<T>(table: string, mapper: (row: any) => T, order: string) {
  const { data, error } = await requireClient().from(table).select("*").order(order, { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapper);
}

const profileFromRow = (row: any): Profile => ({
  id: row.id,
  employeeId: row.employee_id ?? undefined,
  firstName: row.first_name ?? undefined,
  lastName: row.last_name ?? undefined,
  name: row.name ?? row.email ?? "Team member",
  email: row.email ?? undefined,
  phone: row.phone ?? undefined,
  address: row.address ?? undefined,
  role: row.role,
  orgRole: row.org_role ?? (row.role === "manager" ? "Crew Lead" : row.role === "admin" ? "Operations" : "Technician"),
  department: row.department ?? undefined,
  status: row.employment_status ?? undefined,
  branch: row.branch ?? (row.role === "crew" ? "field" : "office"),
  managerId: row.manager_id ?? undefined,
  reportsTo: row.reports_to ?? undefined,
  color: row.color ?? "#14A2A4",
  hireDate: row.hire_date ?? undefined,
  probationEndDate: row.probation_end_date ?? undefined,
  agreementSignedDate: row.agreement_signed_date ?? undefined,
  birthday: row.birthday ?? undefined,
  emergencyContactName: row.emergency_contact_name ?? undefined,
  emergencyContactEmail: row.emergency_contact_email ?? undefined,
  emergencyContactPhone: row.emergency_contact_phone ?? undefined,
  payBand: row.pay_band ?? undefined,
  bonusRoleWeight: row.bonus_role_weight == null ? undefined : Number(row.bonus_role_weight),
  grossAnnualWages: row.gross_annual_wages == null ? undefined : Number(row.gross_annual_wages),
  underNotice: row.under_notice ?? false,
  disciplinaryActionAt: row.disciplinary_action_at ?? undefined,
  nextQuarterlyReviewDate: row.next_quarterly_review_date ?? undefined,
  reviewEligibility: row.review_eligibility ?? undefined,
});

const pointsFromRow = (row: any): PointsEvent => ({
  id: row.id,
  userId: row.user_id,
  type: row.type,
  points: Number(row.points),
  reason: row.reason,
  ref: row.ref,
  ts: row.ts,
  source: row.source ?? undefined,
});
