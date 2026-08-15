import { supabase } from "../integrations/supabase";
import type { CompensationRecord, CrewState, IncidentReport, OnboardingRecord, PointsEvent, Profile } from "../types";

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
  const [profiles, pointsEvents, rewards, redemptions, values, valueRituals, earningRules, reviews, reviewTypes, ratingScale, reviewCompetencies, kpis, kpiResults, bonusConfigs, bonusRoleWeights, certifications, certificationTypes, recognitions, nudges, forms, formQuestions, formSubmissions, policyDocuments, policyAcknowledgments, timeOffPolicies, timeOffEntries, integrations, rolePermissions, jobDescriptions, configs, incidentReports, onboarding, compensation] = await Promise.all([
    read("profiles", profileFromRow, "name"),
    read("points_events", pointsFromRow, "ts"),
    read("crew_reward", (row) => ({ id: row.id, name: row.name, points: Number(row.points), approxValue: row.approx_value ?? undefined, limitStock: row.limit_stock ?? undefined, active: row.active, note: row.note ?? undefined }), "points"),
    read("crew_reward_redemption", (row) => ({ id: row.id, userId: row.user_id, rewardId: row.reward_id, points: Number(row.points), status: row.status, requestedAt: row.requested_at, approvedAt: row.approved_at ?? undefined, approvedBy: row.approved_by ?? undefined, externalRef: row.external_ref ?? undefined }), "requested_at"),
    read("crew_value", (row) => ({ id: row.id, name: row.name, wording: row.wording, dailyRitual: row.daily_ritual, weeklyRitual: row.weekly_ritual, monthlyRitual: row.monthly_ritual, exercise: row.exercise, active: row.active }), "name"),
    read("crew_value_ritual", (row) => ({ id: row.id, valueId: row.value_id, value: row.value_name, cadence: row.cadence, prompt: row.prompt, exercise: row.exercise, points: Number(row.points), active: row.active }), "id"),
    read("crew_earning_rule", (row) => ({ id: row.id, action: row.action, points: Number(row.points), source: row.source, weeklyCap: row.weekly_cap == null ? undefined : Number(row.weekly_cap), habit: row.habit, active: row.active }), "action"),
    read("crew_review", (row) => ({ id: row.id, userId: row.user_id, managerId: row.manager_id, type: row.type, scheduledFor: row.scheduled_for, completedAt: row.completed_at ?? undefined, status: row.status, ratings: row.ratings ?? {}, notes: row.notes ?? "", swot: row.swot ?? "", overallRating: row.overall_rating ?? undefined, quarterlyDetail: row.quarterly_detail ?? undefined }), "scheduled_for"),
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
    read("crew_form", (row) => ({ id: row.id, name: row.name, anonymousAllowed: row.anonymous_allowed, cadence: row.cadence ?? undefined, dueMonthDays: row.due_month_days ?? undefined, description: row.description ?? undefined }), "name"),
    read("crew_form_question", (row) => ({ id: row.id, formId: row.form_id, order: Number(row.sort_order), question: row.question, responseType: row.response_type, required: row.required, anonymousAllowed: row.anonymous_allowed, visibility: row.visibility ?? "both", options: row.options ?? undefined, wordLimit: row.word_limit == null ? undefined : Number(row.word_limit) }), "sort_order"),
    read("crew_form_submission", (row) => ({ id: row.id, formId: row.form_id, userId: row.user_id, periodKey: row.period_key, responses: row.responses ?? {}, submittedAt: row.submitted_at }), "submitted_at"),
    read("crew_policy_document", (row) => ({ id: row.id, title: row.title, version: row.version, effectiveDate: row.effective_date, fileUrl: row.file_url, annualDueMonthDay: row.annual_due_month_day, active: row.active }), "title"),
    read("crew_policy_acknowledgment", (row) => ({ id: row.id, policyId: row.policy_id, userId: row.user_id, year: Number(row.year), signedName: row.signed_name, signedAt: row.signed_at }), "signed_at"),
    read("crew_time_off_policy", (row) => ({ id: row.id, year: Number(row.year), paidSickDays: Number(row.paid_sick_days), unpaidSickDays: Number(row.unpaid_sick_days), eligibilityDays: Number(row.eligibility_days), renewalMonthDay: row.renewal_month_day }), "year"),
    read("crew_time_off_entry", (row) => ({ id: row.id, userId: row.user_id, kind: row.kind, days: Number(row.days), date: row.entry_date, note: row.note ?? undefined, createdAt: row.created_at }), "entry_date"),
    read("crew_integration_decision", (row) => ({ id: row.id, name: row.name, needed: row.needed, details: row.details }), "name"),
    read("crew_role_permission", (row) => ({ orgRole: row.org_role, appRole: row.app_role, reportsTo: row.reports_to, permissions: row.permissions ?? {} }), "org_role"),
    read("crew_job_description", (row) => ({ id: row.id, role: row.org_role, version: row.jd_version, responsibility: row.responsibility, requiredCertifications: row.required_certifications ?? [], linkedKpis: row.linked_kpis ?? [], reportsTo: row.reports_to }), "org_role"),
    read("crew_config", (row) => ({ id: row.id, legalName: row.legal_name, displayName: row.display_name, appName: row.app_name, primaryAdminName: row.primary_admin_name, primaryAdminEmail: row.primary_admin_email, timezone: row.timezone, weekStartsOn: row.week_starts_on, shareLogins: row.share_logins, shareWallet: row.share_wallet, officialBrandPrimary: row.official_brand_primary, officialBrandAccent: row.official_brand_accent, intakeBrandPrimary: row.intake_brand_primary, intakeBrandAccent: row.intake_brand_accent, pointsAnchor: Number(row.points_anchor), intakePointsAnchor: Number(row.intake_points_anchor), googleReviewUrl: row.google_review_url ?? "", officeAddress: row.office_address ?? undefined, dataResidency: row.data_residency ?? undefined }), "id"),
    read("crew_incident_report", (row) => ({ id: row.id, employeeName: row.employee_name, employeeRole: row.employee_role, employeePhone: row.employee_phone ?? undefined, location: row.location, dateOfIncident: row.date_of_incident, timeOfIncident: row.time_of_incident, incidentCause: row.incident_cause, incidentDetails: row.incident_details, actionTaken: row.action_taken, policeNotified: row.police_notified, followUpRequired: row.follow_up_required ?? undefined, photoFileNames: row.photo_file_names ?? [], reportedByUserId: row.reported_by_user_id, reportedByName: row.reported_by_name, reportedByRole: row.reported_by_role, reportedByPhone: row.reported_by_phone ?? undefined, confirmedByUserId: row.confirmed_by_user_id ?? undefined, confirmedByName: row.confirmed_by_name ?? undefined, confirmedAt: row.confirmed_at ?? undefined, createdAt: row.created_at }), "created_at"),
    read("crew_onboarding", (row) => ({ id: row.id, userId: row.user_id, dateOfBirth: row.date_of_birth, address: row.address, city: row.city, postalCode: row.postal_code, sin: row.sin, driversLicenseNumber: row.drivers_license_number, allergiesMedical: row.allergies_medical ?? undefined, hourlyWage: Number(row.hourly_wage), startDate: row.start_date, vacationPayAcknowledged: row.vacation_pay_acknowledged, directDepositSignedName: row.direct_deposit_signed_name, directDepositSignedAt: row.direct_deposit_signed_at, hoursTrackingSignedName: row.hours_tracking_signed_name, hoursTrackingSignedAt: row.hours_tracking_signed_at, directDepositFileName: row.direct_deposit_file_name ?? undefined, driversLicenseFrontFileName: row.drivers_license_front_file_name ?? undefined, driversLicenseBackFileName: row.drivers_license_back_file_name ?? undefined, emergencyContactName: row.emergency_contact_name, emergencyContactRelationship: row.emergency_contact_relationship ?? undefined, emergencyContactPhone: row.emergency_contact_phone, emergencyContactEmail: row.emergency_contact_email ?? undefined, completedAt: row.completed_at }), "created_at"),
    read("crew_compensation", compensationFromRow, "updated_at"),
  ]);
  return { currentUserId, config: configs[0], users: profiles, rolePermissions, jobDescriptions, pointsEvents, rewards, redemptions, values, valueRituals, earningRules, reviews, reviewTypes, ratingScale, reviewCompetencies, kpis, kpiResults, bonusConfig: bonusConfigs[0], bonusRoleWeights, certifications, certificationTypes, recognitions, nudges, forms, formQuestions, formSubmissions, policyDocuments, policyAcknowledgments, timeOffPolicies, timeOffEntries, integrations, incidentReports, onboarding, compensation };
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

export async function savePushSubscription(userId: string, subscription: PushSubscription) {
  const json = subscription.toJSON();
  const { error } = await requireClient().from("crew_push_subscription").upsert(
    { user_id: userId, endpoint: json.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth },
    { onConflict: "endpoint" },
  );
  if (error) throw error;
}

export async function removePushSubscription(endpoint: string) {
  const { error } = await requireClient().from("crew_push_subscription").delete().eq("endpoint", endpoint);
  if (error) throw error;
}

export async function hasPushSubscription(userId: string) {
  const { data, error } = await requireClient().from("crew_push_subscription").select("id").eq("user_id", userId).limit(1);
  if (error) throw error;
  return Boolean(data?.length);
}

export async function sendTestPush(title: string, body: string) {
  const { data, error } = await requireClient().functions.invoke("send-push", { body: { title, body } });
  if (error) throw error;
  return data as { delivered: number; of: number };
}

const TYPE_TO_RULE_KEY: Record<string, string> = {
  crew_feedback: "earn-feedback",
  crew_cert_detail: "earn-cert-detail",
  crew_swot: "earn-swot",
  crew_review_completed: "earn-review",
  crew_kpi_hit: "earn-kpi",
  crew_google_review: "earn-google",
  crew_compliment: "earn-compliment",
  crew_certs_current: "earn-certs",
  crew_peer_recognition: "earn-peer",
};

async function syncPointsEvent(event: PointsEvent) {
  if (event.type === "redeem") return awardPoints({ userId: event.userId, ruleKey: "redeem", ref: event.ref });
  if (event.type === "crew_habit_ritual") {
    const cadence = event.ref.split(":")[3];
    return awardPoints({ userId: event.userId, ruleKey: `earn-${cadence}`, ref: event.ref });
  }
  const ruleKey = TYPE_TO_RULE_KEY[event.type];
  if (!ruleKey) {
    console.warn(`No award-points mapping for event type "${event.type}"; skipping remote award.`);
    return;
  }
  return awardPoints({ userId: event.userId, ruleKey, ref: event.ref });
}

const profileToRow = (item: Profile) => ({
  id: item.id, name: item.name, email: item.email, role: item.role, org_role: item.orgRole, branch: item.branch,
  employee_id: item.employeeId ?? null, first_name: item.firstName ?? null, last_name: item.lastName ?? null,
  department: item.department ?? null, employment_status: item.status ?? null, manager_id: item.managerId ?? null,
  reports_to: item.reportsTo ?? null, hire_date: item.hireDate ?? null, probation_end_date: item.probationEndDate ?? null,
  agreement_signed_date: item.agreementSignedDate ?? null, birthday: item.birthday ?? null, phone: item.phone ?? null,
  address: item.address ?? null, emergency_contact_name: item.emergencyContactName ?? null,
  emergency_contact_email: item.emergencyContactEmail ?? null, emergency_contact_phone: item.emergencyContactPhone ?? null,
  bonus_role_weight: item.bonusRoleWeight ?? null,
  under_notice: item.underNotice ?? false, disciplinary_action_at: item.disciplinaryActionAt ?? null,
  next_quarterly_review_date: item.nextQuarterlyReviewDate ?? null, review_eligibility: item.reviewEligibility ?? null,
  vacation_days_annual: item.vacationDaysAnnual ?? null, color: item.color,
  employment_type: item.employmentType ?? null, new_hire_until: item.newHireUntil ?? null, access_upgraded_at: item.accessUpgradedAt ?? null,
});

const compensationToRow = (item: any) => ({
  id: item.id, user_id: item.userId, gross_annual_wages: item.grossAnnualWages ?? null, pay_band: item.payBand ?? null,
  retention_bonus_amount: item.retentionBonusAmount ?? null, retention_bonus_payout_date: item.retentionBonusPayoutDate ?? null,
  cost_of_living_increase: item.costOfLivingIncrease ?? null, updated_at: item.updatedAt,
});

const reviewToRow = (item: any) => ({
  id: item.id, user_id: item.userId, manager_id: item.managerId, type: item.type, scheduled_for: item.scheduledFor,
  completed_at: item.completedAt ?? null, status: item.status, ratings: item.ratings, notes: item.notes, swot: item.swot ?? "",
  overall_rating: item.overallRating ?? null, quarterly_detail: item.quarterlyDetail ?? null,
});

const kpiResultToRow = (item: any) => ({
  id: item.id, kpi_id: item.kpiId, user_id: item.userId, period_key: item.periodKey, status: item.status,
  value: item.value ?? null, points_event_ref: item.pointsEventRef ?? null,
});

const formSubmissionToRow = (item: any) => ({
  id: item.id, form_id: item.formId, user_id: item.userId, period_key: item.periodKey, responses: item.responses, submitted_at: item.submittedAt,
});

const timeOffEntryToRow = (item: any) => ({
  id: item.id, user_id: item.userId, kind: item.kind, days: item.days, entry_date: item.date, note: item.note ?? null, created_at: item.createdAt,
});

const incidentReportToRow = (item: IncidentReport) => ({
  id: item.id, employee_name: item.employeeName, employee_role: item.employeeRole, employee_phone: item.employeePhone ?? null,
  location: item.location, date_of_incident: item.dateOfIncident, time_of_incident: item.timeOfIncident,
  incident_cause: item.incidentCause, incident_details: item.incidentDetails, action_taken: item.actionTaken,
  police_notified: item.policeNotified, follow_up_required: item.followUpRequired ?? null, photo_file_names: item.photoFileNames ?? [],
  reported_by_user_id: item.reportedByUserId, reported_by_name: item.reportedByName, reported_by_role: item.reportedByRole,
  reported_by_phone: item.reportedByPhone ?? null, confirmed_by_user_id: item.confirmedByUserId ?? null,
  confirmed_by_name: item.confirmedByName ?? null, confirmed_at: item.confirmedAt ?? null, created_at: item.createdAt,
});

const policyAckToRow = (item: any) => ({
  id: item.id, policy_id: item.policyId, user_id: item.userId, year: item.year, signed_name: item.signedName, signed_at: item.signedAt,
});

const certificationToRow = (item: any) => ({
  id: item.id, user_id: item.userId, cert_type_id: item.certTypeId ?? null, name: item.name, issuing_body: item.issuingBody ?? null,
  issued_at: item.issuedAt ?? null, expires_at: item.expiresAt ?? null, status: item.status, scan_file: item.scanFile ?? null,
  note: item.note ?? null, course_date: item.courseDate ?? null, certificate_number: item.certificateNumber ?? null,
  certificate_photo_key: item.certificatePhotoKey ?? null,
});

const recognitionToRow = (item: any) => ({
  id: item.id, from_user_id: item.fromUserId, to_user_id: item.toUserId, message: item.message, ts: item.ts,
  points_event_ref: item.pointsEventRef ?? null,
});

const onboardingToRow = (item: OnboardingRecord) => ({
  id: item.id, user_id: item.userId, date_of_birth: item.dateOfBirth, address: item.address, city: item.city,
  postal_code: item.postalCode, sin: item.sin, drivers_license_number: item.driversLicenseNumber,
  allergies_medical: item.allergiesMedical ?? null, hourly_wage: item.hourlyWage, start_date: item.startDate,
  vacation_pay_acknowledged: item.vacationPayAcknowledged, direct_deposit_signed_name: item.directDepositSignedName,
  direct_deposit_signed_at: item.directDepositSignedAt, hours_tracking_signed_name: item.hoursTrackingSignedName,
  hours_tracking_signed_at: item.hoursTrackingSignedAt, direct_deposit_file_name: item.directDepositFileName ?? null,
  drivers_license_front_file_name: item.driversLicenseFrontFileName ?? null,
  drivers_license_back_file_name: item.driversLicenseBackFileName ?? null,
  emergency_contact_name: item.emergencyContactName, emergency_contact_relationship: item.emergencyContactRelationship ?? null,
  emergency_contact_phone: item.emergencyContactPhone, emergency_contact_email: item.emergencyContactEmail ?? null,
  completed_at: item.completedAt,
});

const redemptionToRow = (item: any) => ({
  id: item.id, user_id: item.userId, reward_id: item.rewardId, points: item.points, status: item.status,
  requested_at: item.requestedAt, approved_at: item.approvedAt ?? null, approved_by: item.approvedBy ?? null, external_ref: item.externalRef ?? null,
});

type SyncMode = "insert" | "update" | "upsert";

const SYNC_ENTITIES: { key: keyof CrewState; table: string; mode: SyncMode; toRow: (item: any) => Record<string, unknown> }[] = [
  { key: "users", table: "profiles", mode: "update", toRow: profileToRow },
  { key: "reviews", table: "crew_review", mode: "update", toRow: reviewToRow },
  { key: "kpiResults", table: "crew_kpi_result", mode: "update", toRow: kpiResultToRow },
  { key: "formSubmissions", table: "crew_form_submission", mode: "insert", toRow: formSubmissionToRow },
  { key: "timeOffEntries", table: "crew_time_off_entry", mode: "insert", toRow: timeOffEntryToRow },
  { key: "incidentReports", table: "crew_incident_report", mode: "upsert", toRow: incidentReportToRow },
  { key: "onboarding", table: "crew_onboarding", mode: "insert", toRow: onboardingToRow },
  { key: "compensation", table: "crew_compensation", mode: "upsert", toRow: compensationToRow },
  { key: "policyAcknowledgments", table: "crew_policy_acknowledgment", mode: "insert", toRow: policyAckToRow },
  { key: "certifications", table: "crew_certification", mode: "upsert", toRow: certificationToRow },
  { key: "recognitions", table: "crew_recognition", mode: "insert", toRow: recognitionToRow },
  { key: "redemptions", table: "crew_reward_redemption", mode: "upsert", toRow: redemptionToRow },
];

function throwIfError<T extends { error: { message: string } | null }>(result: T) {
  if (result.error) throw new Error(result.error.message);
  return result;
}

/**
 * Diffs `prev` against `next` per entity and writes only what changed.
 * Points events never get diff-inserted directly (RLS restricts that table to
 * managers) — new pointsEvents route through the canonical award-points function.
 */
export async function syncCrewState(prev: CrewState, next: CrewState) {
  const client = requireClient();
  const tasks: Promise<unknown>[] = [];

  for (const entity of SYNC_ENTITIES) {
    const prevById = new Map(((prev[entity.key] as any[]) ?? []).map((item) => [item.id, item]));
    for (const item of (next[entity.key] as any[]) ?? []) {
      const before = prevById.get(item.id);
      if (!before) {
        if (entity.mode === "update") continue;
        const { id, ...row } = entity.toRow(item);
        tasks.push((async () => throwIfError(await client.from(entity.table).insert(row)))());
      } else if (JSON.stringify(before) !== JSON.stringify(item)) {
        if (entity.mode === "insert") continue;
        tasks.push((async () => throwIfError(await client.from(entity.table).update(entity.toRow(item)).eq("id", item.id)))());
      }
    }
  }

  const prevEventIds = new Set(prev.pointsEvents.map((event) => event.id));
  for (const event of next.pointsEvents) {
    if (!prevEventIds.has(event.id)) tasks.push(syncPointsEvent(event));
  }

  await Promise.all(tasks);
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
  bonusRoleWeight: row.bonus_role_weight == null ? undefined : Number(row.bonus_role_weight),
  underNotice: row.under_notice ?? false,
  disciplinaryActionAt: row.disciplinary_action_at ?? undefined,
  nextQuarterlyReviewDate: row.next_quarterly_review_date ?? undefined,
  reviewEligibility: row.review_eligibility ?? undefined,
  vacationDaysAnnual: row.vacation_days_annual == null ? undefined : Number(row.vacation_days_annual),
  employmentType: row.employment_type ?? undefined,
  newHireUntil: row.new_hire_until ?? undefined,
  accessUpgradedAt: row.access_upgraded_at ?? undefined,
});

const compensationFromRow = (row: any): CompensationRecord => ({
  id: row.id,
  userId: row.user_id,
  grossAnnualWages: row.gross_annual_wages == null ? undefined : Number(row.gross_annual_wages),
  payBand: row.pay_band ?? undefined,
  retentionBonusAmount: row.retention_bonus_amount == null ? undefined : Number(row.retention_bonus_amount),
  retentionBonusPayoutDate: row.retention_bonus_payout_date ?? undefined,
  costOfLivingIncrease: row.cost_of_living_increase == null ? undefined : Number(row.cost_of_living_increase),
  updatedAt: row.updated_at,
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
