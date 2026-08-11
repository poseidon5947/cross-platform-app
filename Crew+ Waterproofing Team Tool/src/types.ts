export type Role = "admin" | "manager" | "crew";
export type OrgRole = "Senior Technician" | "Technician" | "Assistant Technician" | "Crew Lead" | "Operations / Admin" | "Operations" | "CFO" | "CEO / Owner" | "CEO" | "Caulker";
export type Cadence = "daily" | "weekly" | "monthly";
export type ReviewType = "30" | "60" | "90" | "quarterly" | "annual";
export type ReviewRating = 1 | 2 | 3 | 4 | 5 | "below" | "meets" | "exceeds";
export type ReviewStatus = "scheduled" | "completed" | "overdue";
export type CertStatus = "active" | "current" | "expired" | "missing" | "date_needed";
export type RedemptionStatus = "requested" | "approved" | "rejected";
export type PointsSource = "warehouse" | "sop" | "crew";

export interface Profile {
  id: string;
  employeeId?: string;
  firstName?: string;
  lastName?: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  role: Role;
  orgRole: OrgRole;
  department?: string;
  status?: "Active" | "Inactive" | "Leave";
  branch: "field" | "office";
  managerId?: string;
  reportsTo?: string;
  color: string;
  hireDate?: string;
  probationEndDate?: string;
  agreementSignedDate?: string;
  birthday?: string;
  emergencyContactName?: string;
  emergencyContactEmail?: string;
  emergencyContactPhone?: string;
  payBand?: string;
  bonusRoleWeight?: number;
  grossAnnualWages?: number;
  underNotice?: boolean;
  disciplinaryActionAt?: string;
  nextQuarterlyReviewDate?: string;
  reviewEligibility?: "Eligible" | "Not Eligible" | "TBD";
  vacationDaysAnnual?: number;
}

export interface ValueItem {
  id: string;
  name: string;
  wording: string;
  dailyRitual: string;
  weeklyRitual: string;
  monthlyRitual: string;
  exercise: string;
  active: boolean;
}

export interface EarningRule {
  id: string;
  action: string;
  points: number;
  source: PointsSource;
  weeklyCap?: number;
  habit: boolean;
  active: boolean;
}

export interface PointsEvent {
  id: string;
  userId: string;
  type: string;
  points: number;
  reason: string;
  ref: string;
  ts: string;
  source?: PointsSource;
}

export interface WalletConfig {
  rewardDollarPerPoint: number;
  weeklyHabitCap?: number | null;
}

export interface Reward {
  id: string;
  name: string;
  points: number;
  approxValue?: string;
  limitStock?: string;
  active: boolean;
  note?: string;
}

export interface RewardRedemption {
  id: string;
  userId: string;
  rewardId: string;
  points: number;
  status: RedemptionStatus;
  requestedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  externalRef?: string;
}

export interface RitualCompletion {
  id: string;
  userId: string;
  valueId: string;
  cadence: Cadence;
  periodKey: string;
  completedAt: string;
  pointsEventRef?: string;
}

export interface Review {
  id: string;
  userId: string;
  managerId: string;
  type: ReviewType;
  scheduledFor: string;
  completedAt?: string;
  status: ReviewStatus;
  ratings: {
    responsibilities?: ReviewRating;
    values?: ReviewRating;
    kpis?: ReviewRating;
  };
  notes: string;
  swot?: string;
  overallRating?: ReviewRating;
  visibilityNotes?: string;
}

export interface ReviewNote {
  id: string;
  userId: string;
  managerId: string;
  note: string;
  ts: string;
}

export interface Kpi {
  id: string;
  role: OrgRole;
  name: string;
  description?: string;
  unit?: string;
  target: string;
  period: "monthly" | "quarterly" | "annual";
  dataSource?: string;
  active: boolean;
}

export interface KpiResult {
  id: string;
  kpiId: string;
  userId: string;
  periodKey: string;
  status: "not_started" | "on_track" | "hit" | "missed";
  value?: string;
  pointsEventRef?: string;
}

export interface BonusConfig {
  id: string;
  profitSharePercent: number;
  roleWeights: Record<OrgRole, number>;
  ratingFactors: Partial<Record<ReviewRating, number>>;
  floorsCaps: string;
  tenureBump: number;
  payoutTiming?: string;
  quarterlyComponent?: boolean;
  whoConfirmsProfit?: string;
  whoApprovesPayouts?: string;
  model?: "gross_wages_review_score";
  scoreBands?: Array<{ average: number; label: string; maxPercent: number }>;
  eligibilityRules?: string[];
  discretionary?: boolean;
  reviewAverageSource?: string;
  grossWagesPending?: boolean;
}

export interface BonusPeriod {
  id: string;
  year: number;
  annualProfit: number;
  poolPercent: number;
  status: "draft" | "locked" | "paid";
}

export interface Certification {
  id: string;
  userId: string;
  certTypeId?: string;
  name: string;
  issuingBody?: string;
  issuedAt?: string;
  courseDate?: string;
  expiresAt?: string;
  certificateNumber?: string;
  certificatePhotoKey?: string;
  status: CertStatus;
  scanFile?: string;
  note?: string;
}

export interface Recognition {
  id: string;
  fromUserId: string;
  toUserId: string;
  message: string;
  ts: string;
  pointsEventRef?: string;
}

export interface Nudge {
  id: string;
  userId?: string;
  name?: string;
  triggerType?: "cadence" | "date-driven";
  cadence?: string;
  audience?: string;
  channel?: string;
  leadTime?: string;
  active?: boolean;
  type: "ritual" | "review" | "cert" | "benefits" | "birthday" | "anniversary" | "feedback" | "swot" | "policy" | "vacation";
  title: string;
  dueAt: string;
  read: boolean;
}

export interface CrewConfig {
  id: string;
  legalName: string;
  displayName: string;
  appName: string;
  primaryAdminName: string;
  primaryAdminEmail: string;
  timezone: string;
  weekStartsOn: "Monday" | "Sunday";
  shareLogins: boolean;
  shareWallet: boolean;
  officialBrandPrimary: string;
  officialBrandAccent: string;
  intakeBrandPrimary: string;
  intakeBrandAccent: string;
  pointsAnchor: number;
  intakePointsAnchor: number;
  googleReviewUrl: string;
  officeAddress?: string;
  dataResidency?: string;
}

export type RolePermissionKey =
  | "viewOwnData"
  | "viewOthersProfiles"
  | "viewProbation"
  | "viewCompensation"
  | "viewBonusDollars"
  | "viewWriteUps"
  | "manageReviews"
  | "editConfig"
  | "editEmergencyContact"
  | "editAddress"
  | "exportReports";

export interface RolePermission {
  orgRole: OrgRole;
  appRole: Role;
  reportsTo: string;
  permissions: Record<RolePermissionKey, boolean | "team" | "all">;
}

export interface JobDescription {
  id: string;
  role: OrgRole;
  version: string;
  responsibility: string;
  requiredCertifications: string[];
  linkedKpis: string[];
  reportsTo: string;
}

export interface CertificationType {
  id: string;
  name: string;
  category: string;
  issuingBody?: string;
  validityMonths?: number;
  alertLeadDays: number[];
  requiredForRoles: string[];
  notes?: string;
}

export interface ValueRitual {
  id: string;
  valueId: string;
  value: string;
  cadence: Cadence;
  prompt: string;
  exercise: string;
  points: number;
  active: boolean;
}

export interface ReviewTypeConfig {
  id: string;
  type: string;
  appliesTo: string;
  cadence: string;
  ratingScale: string;
  purpose: string;
}

export interface RatingScaleDefinition {
  value: number;
  label: string;
  meaning: string;
  performanceFactor: number;
}

export interface ReviewCompetency {
  id: string;
  competency: string;
  appliesToRoles: string[];
  description: string;
  weightPercent?: number;
}

export interface BonusRoleWeight {
  orgRole: OrgRole;
  weight?: number;
  notes?: string;
}

export interface CrewForm {
  id: string;
  name: string;
  anonymousAllowed: boolean;
  cadence?: "quarterly" | "annual" | "ad-hoc";
  dueMonthDays?: string[];
  description?: string;
}

export interface CrewFormQuestion {
  id: string;
  formId: string;
  order: number;
  question: string;
  responseType: "Text" | "Scale 1-5" | "Below / Meets / Exceeds" | "Checkbox" | "Date" | "KPI Table";
  required: boolean;
  anonymousAllowed: boolean;
  visibility?: "employee" | "admin" | "both";
  options?: string[];
  wordLimit?: number;
}

export interface CrewFormSubmission {
  id: string;
  formId: string;
  userId: string;
  periodKey: string;
  responses: Record<string, string>;
  submittedAt: string;
}

export interface PolicyDocument {
  id: string;
  title: string;
  version: string;
  effectiveDate: string;
  fileUrl: string;
  annualDueMonthDay: string;
  active: boolean;
}

export interface PolicyAcknowledgment {
  id: string;
  policyId: string;
  userId: string;
  year: number;
  signedName: string;
  signedAt: string;
}

export interface TimeOffPolicy {
  id: string;
  year: number;
  paidSickDays: number;
  unpaidSickDays: number;
  eligibilityDays: number;
  renewalMonthDay: string;
}

export type TimeOffKind = "paid_sick" | "unpaid_sick" | "vacation";

export interface TimeOffEntry {
  id: string;
  userId: string;
  kind: TimeOffKind;
  days: number;
  date: string;
  note?: string;
  createdAt: string;
}

export interface IncidentReport {
  id: string;
  employeeName: string;
  employeeRole: string;
  employeePhone?: string;
  location: string;
  dateOfIncident: string;
  timeOfIncident: string;
  incidentCause: string;
  incidentDetails: string;
  actionTaken: string;
  policeNotified: boolean;
  followUpRequired?: string;
  photoFileNames?: string[];
  reportedByUserId: string;
  reportedByName: string;
  reportedByRole: string;
  reportedByPhone?: string;
  confirmedByUserId?: string;
  confirmedByName?: string;
  confirmedAt?: string;
  createdAt: string;
}

export type IncidentReportInput = Omit<IncidentReport, "id" | "createdAt" | "confirmedByUserId" | "confirmedByName" | "confirmedAt">;

export interface IntegrationDecision {
  id: string;
  name: string;
  needed: "Yes" | "No" | "Later";
  details: string;
}

export interface PermissionConfig {
  cfoUserIds: string[];
  hrOwnerUserIds: string[];
  managerCanReviewCrew: boolean;
  rolePermissions?: RolePermission[];
}

export interface CrewState {
  currentUserId: string;
  config: CrewConfig;
  users: Profile[];
  rolePermissions: RolePermission[];
  jobDescriptions: JobDescription[];
  values: ValueItem[];
  valueRituals: ValueRitual[];
  earningRules: EarningRule[];
  pointsEvents: PointsEvent[];
  walletConfig: WalletConfig;
  rewards: Reward[];
  redemptions: RewardRedemption[];
  ritualCompletions: RitualCompletion[];
  reviews: Review[];
  reviewTypes: ReviewTypeConfig[];
  ratingScale: RatingScaleDefinition[];
  reviewCompetencies: ReviewCompetency[];
  reviewNotes: ReviewNote[];
  kpis: Kpi[];
  kpiResults: KpiResult[];
  bonusConfig: BonusConfig;
  bonusRoleWeights: BonusRoleWeight[];
  bonusPeriods: BonusPeriod[];
  certificationTypes: CertificationType[];
  certifications: Certification[];
  recognitions: Recognition[];
  nudges: Nudge[];
  forms: CrewForm[];
  formQuestions: CrewFormQuestion[];
  formSubmissions: CrewFormSubmission[];
  policyDocuments: PolicyDocument[];
  policyAcknowledgments: PolicyAcknowledgment[];
  timeOffPolicies: TimeOffPolicy[];
  timeOffEntries: TimeOffEntry[];
  incidentReports: IncidentReport[];
  integrations: IntegrationDecision[];
  permissions: PermissionConfig;
}
