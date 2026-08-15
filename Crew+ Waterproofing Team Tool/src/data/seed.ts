import type {
  BonusConfig,
  EmploymentType,
  BonusRoleWeight,
  Certification,
  CertificationType,
  CrewConfig,
  CrewForm,
  CrewFormQuestion,
  CrewState,
  EarningRule,
  IntegrationDecision,
  JobDescription,
  Kpi,
  Nudge,
  OrgRole,
  PolicyDocument,
  Profile,
  RatingScaleDefinition,
  ReviewCompetency,
  ReviewTypeConfig,
  Reward,
  Role,
  RolePermission,
  TimeOffPolicy,
  ValueItem,
  ValueRitual,
} from "../types";

export const crewConfig: CrewConfig = {
  id: "crew-config",
  legalName: "Van-Isle Coating & Sealants Ltd.",
  displayName: "Van Isle Waterproofing+",
  appName: "Crew+",
  primaryAdminName: "Tara Clark",
  primaryAdminEmail: "ops@vanislecoatings.com",
  timezone: "Canada/Vancouver",
  weekStartsOn: "Monday",
  shareLogins: true,
  shareWallet: true,
  officialBrandPrimary: "#14A2A4",
  officialBrandAccent: "#1C1E20",
  // Intake proposes #1C5CAB / #12A37A; keep suite brand until client confirms.
  intakeBrandPrimary: "#1C5CAB",
  intakeBrandAccent: "#12A37A",
  pointsAnchor: 0.25,
  intakePointsAnchor: 0.25,
  googleReviewUrl: "https://www.google.com/maps/place//data=!4m3!3m2!1s0x548f6b3774eb6afd:0xbd3374f825d460ba!12e1?source=g.page.m._&laa=merchant-review-solicitation",
  officeAddress: "7 - 933 Ellery Street",
  dataResidency: "Canada",
};

const roleToAppRole: Record<string, Role> = {
  "Senior Technician": "crew",
  Technician: "crew",
  "Assistant Technician": "crew",
  Caulker: "crew",
  "Crew Lead": "manager",
  "Operations / Admin": "admin",
  CFO: "admin",
  "CEO / Owner": "admin",
};

const roleWeights: Record<OrgRole, number> = {
  "Senior Technician": 1.1,
  Technician: 1,
  "Assistant Technician": 0.85,
  "Crew Lead": 1.2,
  "Operations / Admin": 1,
  Operations: 1,
  CFO: 1.15,
  "CEO / Owner": 0,
  CEO: 0,
  Caulker: 0.9,
  Estimator: 1,
};

export const rolePermissions: RolePermission[] = [
  rolePerm("Senior Technician", "Crew Lead", ["viewOwnData", "viewProbation", "viewWriteUps", "editEmergencyContact", "editAddress"]),
  rolePerm("Technician", "Crew Lead", ["viewOwnData", "viewProbation", "viewWriteUps", "editEmergencyContact", "editAddress"]),
  rolePerm("Assistant Technician", "Crew Lead", ["viewOwnData", "viewProbation", "viewWriteUps", "editEmergencyContact", "editAddress"]),
  rolePerm("Caulker", "CEO / Owner", ["viewOwnData", "viewProbation", "editEmergencyContact", "editAddress"]),
  rolePerm("Crew Lead", "CEO", ["viewOwnData", "viewOthersProfiles", "viewProbation", "viewWriteUps", "manageReviews", "editEmergencyContact", "editAddress"], "team"),
  rolePerm("Operations / Admin", "CEO", ["viewOwnData", "viewOthersProfiles", "viewProbation", "viewCompensation", "viewBonusDollars", "viewWriteUps", "manageReviews", "editConfig", "editEmergencyContact", "editAddress", "exportReports"], "all"),
  rolePerm("CFO", "CEO", ["viewOwnData", "viewProbation", "viewCompensation", "viewBonusDollars", "editEmergencyContact", "editAddress", "exportReports"]),
  rolePerm("CEO / Owner", "-", ["viewOwnData", "viewOthersProfiles", "viewProbation", "viewCompensation", "viewBonusDollars", "viewWriteUps", "manageReviews", "editConfig", "editEmergencyContact", "editAddress", "exportReports"], "all"),
];

export const demoUsers: Profile[] = [
  member("u1", "EMP-001", "Jesse", "Dares", "Jesse", "Crew Lead", "Field", "CEO / Owner", "02-18", "crewlead@vanislecoatings.com", "778-678-4511", "#14A2A4"),
  member("u2", "EMP-002", "Shane", "Smith", "Shane", "Assistant Technician", "Field", "Crew Lead", "07-15", "", "", "#0b6ea8"),
  member("u3", "EMP-003", "Jon", "Gregoire", "Jon", "Senior Technician", "Field", "Crew Lead", "04-08", "jongregoire95@gmail.com", "613-539-5322", "#1C1E20"),
  member("u4", "EMP-004", "Josh", "Murray", "Josh", "Technician", "Field", "Crew Lead", "05-01", "joshm3972@gmail.com", "250-891-5620", "#b87200"),
  member("u5", "EMP-005", "Logan", "Pardy", "Logan", "Assistant Technician", "Field", "Crew Lead", "", "loganpardy96@gmail.com", "(250) 508--0353", "#1a9d5e"),
  member("u6", "EMP-006", "Jordan", "Thorpe", "J. Thorpe", "Senior Technician", "Field", "Crew Lead", "11-03", "jordanthorpe1995@outlook.com", "250-886-1599", "#5b4ac2"),
  member("u7", "EMP-007", "Jordan", "Rogers", "J. Rogers", "CEO / Owner", "Office", "Crew Lead", "05-09", "estimating@vanislecoatings.com", "250-883-7175", "#111827"),
  member("u8", "EMP-008", "Tara", "Clark", "Tara", "Operations / Admin", "Office", "CEO / Owner", "04-03", "ops@vanislecoatings.com", "778-688-0759", "#14A2A4"),
  member("u9", "EMP-009", "Bobby", "Wagner", "Bobby", "Caulker", "Field", "CEO / Owner", "02-11", "bymsid@gmail.com", "250-589-3697", "#456b8c"),
  member("u10", "EMP-010", "Ray", "Boudreault", "Ray", "Caulker", "Field", "CEO / Owner", "", "rayboudreault@yahoo.ca", "250-880-2489", "#7c6f52"),
  member("u11", "EMP-011", "Jacob", "Soto", "Jacob", "Technician", "Field", "CEO / Owner", "", "jacob.valentin.soto@gmail.com", "(250) 882-8666", "#c53030", "temp"),
  member("u12", "EMP-012", "Finance", "Admin", "CFO", "CFO", "Office", "CEO / Owner", "", "finance@vanislecoatings.com", "", "#37526d"),
  member("u13", "EMP-013", "Matthew", "Chester", "Matthew", "Crew Lead", "Field", "CEO / Owner", "", "matthew.chester@skynetcfo.com", "", "#245b84"),
  member("u14", "EMP-014", "Desmond", "Scott", "Desmond", "Estimator", "Office", "CEO / Owner", "", "desmondscot@gmail.com", "", "#6b7280", "part_time"),
  member("u15", "EMP-015", "Ken", "Taylor", "Ken", "Technician", "Field", "CEO / Owner", "", "ken.taylor@example.com", "", "#8b5e34", "seasonal"),
].map(applyReviewRoster);

export const certificationTypes: CertificationType[] = [
  certType("ct-whmis", "WHMIS", "Safety", 12, "60;30;7", "All field", "Confirm refresher cadence"),
  certType("ct-hearing", "Hearing test", "Safety / Health", 12, "60;30", "All field"),
  certType("ct-first-aid", "Level 1 First Aid", "Safety", 36, "60;30;7", "All field"),
  certType("ct-fit", "Fit Test (respirator)", "Safety", 12, "60;30;7", "All field", "Annual"),
  certType("ct-lift", "Lift Operation", "Equipment", 36, "60;30", "All field"),
  certType("ct-confined", "Confined Spaces", "Safety", 36, "60;30;7", "As required"),
  certType("ct-fall", "Fall Arrest", "Safety", 36, "60;30;7", "Working at height"),
  certType("ct-applicator", "Manufacturer applicator (Tremco/Xypex)", "Trade", undefined, "90;30", "Applicators", "Optional"),
];

export const values: ValueItem[] = [
  value("v-clear", "Clear", "Open, straightforward communication."),
  value("v-helpful", "Helpful", "We go out of our way to solve problems and make your project easier to manage."),
  value("v-professional", "Professional", "Reliable, safety-first work delivered to a consistently high standard, every time."),
];

export const valueRituals: ValueRitual[] = [
  ritual("v-clear", "Clear", "weekly", "Monday 6:30am crew meeting value-share", "Share one clear communication moment from the week", 5),
  ritual("v-helpful", "Helpful", "weekly", "Monday 6:30am crew meeting value-share", "Share one way you made a project easier to manage", 5),
  ritual("v-professional", "Professional", "weekly", "Monday 6:30am crew meeting value-share", "Share one safety-first professional standard you upheld", 5),
];

export const earningRules: EarningRule[] = [
  earn("earn-ww-day", "Perfect daily truck-task day", 25, "warehouse"),
  earn("earn-ww-streak", "5-day truck-task streak bonus", 25, "warehouse"),
  earn("earn-log-week", "Clean material/tool logging week (no corrections)", 40, "warehouse", undefined, true),
  earn("earn-tools", "All tools returned, none damaged (weekly)", 30, "warehouse", undefined, true),
  earn("earn-daily", "Daily value ritual", 10, "crew", undefined, true),
  earn("earn-weekly", "Weekly value exercise", 10, "crew", undefined, true),
  earn("earn-monthly", "Monthly value ritual", 10, "crew", undefined, true),
  earn("earn-cert-detail", "Certification details completed", 10, "crew"),
  earn("earn-swot", "Quarterly SWOT on time", 10, "crew"),
  earn("earn-feedback", "Company feedback form submitted", 10, "crew"),
  earn("earn-certs", "All certs current (monthly, no lapses)", 10, "crew"),
  earn("earn-review", "Review completed on time", 10, "crew"),
  earn("earn-kpi", "KPI target hit", 10, "crew"),
  earn("earn-google", "5-star Google review naming you", 200, "crew"),
  earn("earn-compliment", "Written customer compliment", 10, "crew"),
  earn("earn-safety", "Crew safety milestone", 10, "crew"),
  earn("earn-peer", "Peer recognition received", 10, "crew"),
  earn("earn-sop", "SOP created & approved", 50, "sop"),
];

export const rewards: Reward[] = [
  reward("r1", "Cash - $50", 200, "$50", "Quarter-end cash redemption."),
  reward("r2", "Cash - $100", 400, "$100", "Quarter-end cash redemption."),
  reward("r3", "Gift Card - $50", 200, "$50", "Quarter-end gift card redemption."),
  reward("r4", "Gift Card - $100", 400, "$100", "Quarter-end gift card redemption."),
  reward("r5", "PTO - half day", 800, "~$200", "Quarter-end PTO redemption; manager scheduling required."),
  reward("r6", "PTO - full day", 1600, "~$400", "Quarter-end PTO redemption; manager scheduling required."),
];

export const kpis: Kpi[] = [
  kpi("kpi-cl-1", "Crew Lead", "Crew jobs on schedule", "%", "Monthly", "BuilderTrend / schedule"),
  kpi("kpi-cl-2", "Crew Lead", "Callback / rework rate", "%", "Monthly", "Job records"),
  kpi("kpi-cl-3", "Crew Lead", "Safety incidents", "count", "Monthly", "Safety log"),
  kpi("kpi-cl-4", "Crew Lead", "Logging accuracy", "%", "Monthly", "Waterproofing+"),
  kpi("kpi-tech-1", "Technician", "Jobs completed to spec", "%", "Monthly", "Job records"),
  kpi("kpi-tech-2", "Technician", "Rework on own work", "%", "Monthly", "Job records"),
  kpi("kpi-tech-3", "Technician", "Safety compliance", "%", "Monthly", "Safety log"),
  kpi("kpi-tech-4", "Technician", "Certs kept current", "Y/N", "Monthly", "Crew+ certs"),
  kpi("kpi-asst-1", "Assistant Technician", "Jobs completed to spec", "%", "Monthly", "Job records"),
  kpi("kpi-asst-2", "Assistant Technician", "Safety compliance", "%", "Monthly", "Safety log"),
  kpi("kpi-sr-1", "Senior Technician", "Quality on complex scopes", "%", "Monthly", "Job records"),
  kpi("kpi-sr-2", "Senior Technician", "Mentoring contribution", "count", "Quarterly", "1:1 notes"),
  kpi("kpi-ops-1", "Operations / Admin", "Job scheduling / throughput", "count", "Monthly", "BuilderTrend"),
  kpi("kpi-ops-2", "Operations / Admin", "Review-lead generation", "count", "Monthly", "Google/manual log"),
  kpi("kpi-ops-3", "Operations / Admin", "AP/AR or invoicing timeliness", "%", "Monthly", "Accounting"),
  kpi("kpi-cfo-1", "CFO", "Gross margin by job", "%", "Monthly", "Accounting"),
  kpi("kpi-cfo-2", "CFO", "Cost-report timeliness", "%", "Monthly", "Accounting"),
  kpi("kpi-cfo-3", "CFO", "Profit figure for bonus pool", "$", "Annual", "Accounting"),
  kpi("kpi-ceo-1", "CEO / Owner", "Revenue", "$", "Annual", "Accounting"),
  kpi("kpi-ceo-2", "CEO / Owner", "Margin", "%", "Annual", "Accounting"),
  kpi("kpi-ceo-3", "CEO / Owner", "Retention", "%", "Annual", "HR"),
  kpi("kpi-ceo-4", "CEO / Owner", "Safety record", "count", "Annual", "Safety log"),
  kpi("kpi-crew-attendance", "Technician", "Attendance", "100%", "Quarterly", "Payroll / schedule"),
  kpi("kpi-crew-paperwork", "Technician", "Daily paperwork", "100%", "Quarterly", "Warehouse Wizard / Crew+"),
  kpi("kpi-crew-safety", "Technician", "Safety violations", "Zero", "Quarterly", "Safety log"),
  kpi("kpi-crew-complaints", "Technician", "Customer complaints", "Zero", "Quarterly", "Customer log"),
  kpi("kpi-crew-rework", "Technician", "Rework", "Under target", "Quarterly", "Job records"),
  kpi("kpi-crew-vehicle", "Technician", "Vehicle inspections", "Weekly", "Quarterly", "Warehouse Wizard"),
  kpi("kpi-crew-training", "Technician", "Training completed", "Yes", "Quarterly", "Crew+ certs"),
];

export const bonusConfig: BonusConfig = {
  id: "bonus-2026",
  profitSharePercent: 0,
  roleWeights,
  ratingFactors: { 1: 0, 2: 0, 3: 0.02, 4: 0.04, 5: 0.06 },
  floorsCaps: "Bonus is capped by average annual review score: 3 = up to 2%, 4 = up to 4%, 5 = up to 6%. Below 3 is not eligible.",
  tenureBump: 0,
  payoutTiming: "Payroll closest to Dec 25 after annual reviews two weeks prior",
  quarterlyComponent: false,
  whoConfirmsProfit: "CFO",
  whoApprovesPayouts: "CEO",
  model: "gross_wages_review_score",
  scoreBands: [
    { average: 3, label: "Meets", maxPercent: 0.02 },
    { average: 4, label: "Exceeds", maxPercent: 0.04 },
    { average: 5, label: "Exceptional", maxPercent: 0.06 },
  ],
  eligibilityRules: [
    "At least 6 months continuous employment",
    "Participated in at least 2 quarterly reviews",
    "Actively employed at payout",
    "Not under notice",
    "No verbal or written disciplinary action in last 3 months",
    "No partial-period eligibility",
  ],
  discretionary: true,
  reviewAverageSource: "Annual bonus average derives from the year's quarterly Overall Ratings.",
  grossWagesPending: true,
};

export const bonusRoleWeights: BonusRoleWeight[] = Object.entries(bonusConfig.roleWeights).map(([orgRole, weight]) => ({ orgRole: orgRole as OrgRole, weight }));

export const reviewTypes: ReviewTypeConfig[] = [
  reviewType("rt-30", "Probation 30-day", "New hires", "Day 30", "Crew: Below / Meets / Exceeds; office: optional 1-5", "Early fit & setup"),
  reviewType("rt-60", "Probation 60-day", "New hires", "Day 60", "Crew: Below / Meets / Exceeds; office: optional 1-5", "Progress check"),
  reviewType("rt-90", "Probation 90-day", "New hires", "Day 90", "Crew: Below / Meets / Exceeds; office: optional 1-5", "Confirm permanent"),
  reviewType("rt-quarterly", "Quarterly check-in", "Everyone", "Quarter ends: Mar 31, Jun 30, Sep 30, Dec 31", "Crew: Below / Meets / Exceeds; office: optional 1-5", "Coaching check-in; no payout"),
  reviewType("rt-annual", "Annual review", "Everyone", "Two weeks before Dec payout", "Crew: Below / Meets / Exceeds; office: optional 1-5", "Employee Performance Scorecard; feeds Dec bonus"),
];

export const ratingScale: RatingScaleDefinition[] = [
  { value: 1, label: "Unsatisfactory", meaning: "Does not meet role expectations", performanceFactor: 0 },
  { value: 2, label: "Developing", meaning: "Inconsistent or needs support to meet expectations", performanceFactor: 0 },
  { value: 3, label: "Meets", meaning: "Solidly meeting expectations", performanceFactor: 0.02 },
  { value: 4, label: "Exceeds", meaning: "Often exceeds expectations", performanceFactor: 0.04 },
  { value: 5, label: "Exceptional", meaning: "Consistently exceptional performance", performanceFactor: 0.06 },
];

export const reviewCompetencies: ReviewCompetency[] = [
  competency("Quality / right the first time", "All", "Work meets spec with minimal rework"),
  competency("Safety compliance & leadership", "All", "Follows and models safe practice"),
  competency("Paperwork & logging discipline", "Field", "Accurate, same-day tool/material logs"),
  competency("Team & communication", "All", "Works well with crew, clear communication"),
  competency("Lives the company values", "All", "Demonstrates Clear, Helpful, and Professional day to day"),
  competency("Mentoring / development", "Crew Lead, Senior", "Grows others"),
];

export const jobDescriptions: JobDescription[] = [
  jd("jd-tech-1", "Technician", "v1", "Complete assigned waterproofing scope to spec, no callbacks", "WHMIS, Fit Test, Fall Arrest", "Jobs on schedule; rework rate", "Crew Lead"),
  jd("jd-tech-2", "Technician", "v1", "Log tools & materials in Waterproofing+ same-day", "WHMIS", "Logging accuracy", "Crew Lead"),
];

export const forms: CrewForm[] = [
  { id: "form-swot", name: "Quarterly SWOT", anonymousAllowed: false, cadence: "quarterly", dueMonthDays: ["03-31", "06-30", "09-30", "12-31"], description: "Share the team's strengths, weaknesses, opportunities, and threats every quarter." },
  { id: "form-feedback", name: "Company feedback form", anonymousAllowed: true },
  { id: "form-quarterly-scorecard", name: "Quarterly Review Scorecard", anonymousAllowed: false },
  { id: "form-annual-performance", name: "Employee Performance Scorecard", anonymousAllowed: false },
];

export const formQuestions: CrewFormQuestion[] = [
  question("form-swot", 1, "Strengths", "Text", true, false, "both", 500),
  question("form-swot", 2, "Weaknesses", "Text", true, false, "both", 500),
  question("form-swot", 3, "Opportunities", "Text", true, false, "both", 500),
  question("form-swot", 4, "Threats", "Text", true, false, "both", 500),
  question("form-quarterly-scorecard", 1, "How are things going?", "Checkbox", true, false, "both", undefined, ["Excellent", "Good", "Fair", "Struggling"]),
  question("form-quarterly-scorecard", 2, "I have the tools I need", "Scale 1-5", true, false, "both"),
  question("form-quarterly-scorecard", 3, "I receive clear instructions", "Scale 1-5", true, false, "both"),
  question("form-quarterly-scorecard", 4, "I understand what success looks like", "Scale 1-5", true, false, "both"),
  question("form-quarterly-scorecard", 5, "Communication is good", "Scale 1-5", true, false, "both"),
  question("form-quarterly-scorecard", 6, "I feel respected", "Scale 1-5", true, false, "both"),
  question("form-quarterly-scorecard", 7, "Attention to detail", "Scale 1-5", true, false, "both"),
  question("form-quarterly-scorecard", 8, "Waterproofing quality", "Scale 1-5", true, false, "both"),
  question("form-quarterly-scorecard", 9, "Caulking quality", "Scale 1-5", true, false, "both"),
  question("form-quarterly-scorecard", 10, "Protection of finished work", "Scale 1-5", true, false, "both"),
  question("form-quarterly-scorecard", 11, "Organization", "Scale 1-5", true, false, "both"),
  question("form-quarterly-scorecard", 12, "Productivity", "Scale 1-5", true, false, "both"),
  question("form-quarterly-scorecard", 13, "Following SOPs", "Scale 1-5", true, false, "both"),
  question("form-quarterly-scorecard", 14, "Pride in workmanship", "Scale 1-5", true, false, "both"),
  question("form-quarterly-scorecard", 15, "Top three strengths", "Text", true, false, "both"),
  question("form-quarterly-scorecard", 16, "What do you think you do best?", "Text", false, false, "both"),
  question("form-quarterly-scorecard", 17, "What one or two improvements would have the biggest impact?", "Text", true, false, "both"),
  question("form-quarterly-scorecard", 18, "Quarterly goal 1", "Text", true, false, "both"),
  question("form-quarterly-scorecard", 19, "Quarterly goal 2", "Text", true, false, "both"),
  question("form-quarterly-scorecard", 20, "Quarterly goal 3", "Text", false, false, "both"),
  question("form-feedback", 1, "What's working well right now?", "Text", true, true),
  question("form-feedback", 2, "What's frustrating or slowing you down?", "Text", true, true),
  question("form-feedback", 3, "One idea to make us better?", "Text", false, true),
  question("form-feedback", 4, "How supported do you feel? (1-5)", "Scale 1-5", true, true),
  question("form-annual-performance", 1, "Employee Performance Scorecard header: employee, role, review period, reviewer, annual review date", "Text", true, false, "both"),
  question("form-annual-performance", 2, "Annual Overall Rating", "Scale 1-5", true, false, "both"),
  question("form-annual-performance", 3, "Bonus eligibility gates confirmed", "Checkbox", true, false, "admin"),
];

export const nudgeTemplates: Nudge[] = [
  nudge("nudge-weekly-value-share", "Monday value-share", "cadence", "Monday before 6:30am", "Crew", "In-app + Push", "Before meeting", "ritual"),
  nudge("nudge-swot", "Quarterly SWOT", "cadence", "Start of quarter", "Crew", "In-app + Push", "Before review", "swot"),
  nudge("nudge-feedback", "Company feedback form", "cadence", "Monthly", "Crew", "In-app", "-", "feedback"),
  nudge("nudge-birthday", "Birthday reminder", "date-driven", "On date", "Manager", "Push + Email", "Same day", "birthday"),
  nudge("nudge-anniversary", "Work anniversary", "date-driven", "On date", "Manager", "Push", "Same day", "anniversary"),
  nudge("nudge-cert", "Cert expiry alert", "date-driven", "60/30/7 days + expiry", "Crew + Manager", "Push + Email", "60/30/7 days", "cert"),
  nudge("nudge-review", "Quarterly review countdown", "date-driven", "Within 2 weeks of quarter end", "Manager", "Push + Email", "14 days", "review"),
  { id: "nudge-bullying-policy", name: "Annual bullying and harassment policy", triggerType: "date-driven", cadence: "Annually on August 31", audience: "All crew", channel: "In-app + Email", leadTime: "30/14/7 days", type: "policy", active: true, title: "Read and sign the workplace policy", dueAt: "2026-08-31T17:00:00-07:00", read: false },
  { id: "nudge-vacation-balance", name: "Vacation balance reminder", triggerType: "cadence", cadence: "Monthly while vacation remains", audience: "Crew", channel: "Email + Text", leadTime: "Balance reminder only", type: "vacation", active: true, title: "Vacation days remaining", dueAt: "2026-08-31T09:00:00-07:00", read: false },
  nudge("nudge-probation", "Probation checkpoint", "date-driven", "Day 30/60/90", "Manager", "Push", "On day", "review"),
  nudge("nudge-digest", "Manager weekly digest", "cadence", "Monday", "Manager", "Email", "-", "benefits"),
];

export const integrations: IntegrationDecision[] = [
  integration("Database (Supabase / Firebase)", "Yes", "Shared hosted DB with offline sync (per spec)"),
  integration("Reuse Waterproofing+ backend", "Yes", "Same stack / one account across apps"),
  integration("User logins / auth", "Yes", "Per-person, role-based (see Roles tab)"),
  integration("Offline sync", "Yes", "Field sites with no signal"),
  integration("Google Business Profile API (reviews)", "Later", "Auto-pull 5-star reviews -> points. Manual log day one"),
  integration("BuilderTrend integration", "Later", "Job/schedule data for KPIs"),
  integration("Push notifications", "Yes", "Web push for nudges"),
  integration("Email digests", "Yes", "Manager weekly digest"),
  integration("Calendar sync (Google/Outlook)", "Later", "Reviews, cert expiries, birthdays"),
  integration("Cost/report exports (PDF/CSV)", "Yes", "Review, compliance, bonus reports"),
  integration("Data residency", "Yes", "Confirm Canada (see Company tab)"),
];

export const policyDocuments: PolicyDocument[] = [
  {
    id: "policy-bullying-harassment",
    title: "Workplace Bullying and Harassment Policy Statement",
    version: "2026",
    effectiveDate: "2026-01-30",
    fileUrl: "/workplace-bullying-harassment-policy-2026.pdf",
    annualDueMonthDay: "08-31",
    active: true,
  },
];

export const timeOffPolicies: TimeOffPolicy[] = [
  { id: "time-off-2026", year: 2026, paidSickDays: 5, unpaidSickDays: 3, eligibilityDays: 90, renewalMonthDay: "01-01" },
];

const certs: Certification[] = [
  cert("cert-jesse-whmis", "u1", "ct-whmis", "WHMIS", undefined, undefined, "active", "Add course date, expiry, cert # and hard-copy photo"),
  cert("cert-jesse-hearing", "u1", "ct-hearing", "Hearing test", undefined, undefined, "active", "Add course date, expiry, cert # and hard-copy photo"),
  cert("cert-jesse-fa", "u1", "ct-first-aid", "Level 1 First Aid", undefined, undefined, "date_needed", "Add course date, expiry, cert # and hard-copy photo"),
  cert("cert-jesse-fit", "u1", "ct-fit", "Fit Test (respirator)", undefined, undefined, "date_needed", "Add course date, expiry, cert # and hard-copy photo"),
  cert("cert-jesse-lift", "u1", "ct-lift", "Lift Operation", undefined, undefined, "active", "Add course date, expiry, cert # and hard-copy photo"),
  cert("cert-shane-lift", "u2", "ct-lift", "Lift Operation", undefined, undefined, "active", "Only cert on file"),
  cert("cert-jon-lift", "u3", "ct-lift", "Lift Operation", undefined, undefined, "active", "Add details"),
  cert("cert-jon-fa", "u3", "ct-first-aid", "Level 1 First Aid", undefined, undefined, "active", "Add details"),
  cert("cert-jon-fit", "u3", "ct-fit", "Fit Test (respirator)", undefined, undefined, "active", "Add details"),
  cert("cert-jon-confined", "u3", "ct-confined", "Confined Spaces", undefined, undefined, "active", "Add details"),
  cert("cert-josh-confined", "u4", "ct-confined", "Confined Spaces", undefined, undefined, "active", "Add details"),
  // TODO_CONFIRM: Logan Pardy has no certs on file in V2 intake; confirm this is a real gap, not missing data.
  cert("cert-thorpe-lift", "u6", "ct-lift", "Lift Operation", undefined, undefined, "active", "Add details"),
  cert("cert-thorpe-fa", "u6", "ct-first-aid", "Level 1 First Aid", undefined, undefined, "active", "Add details"),
  cert("cert-thorpe-fit", "u6", "ct-fit", "Fit Test (respirator)", undefined, undefined, "active", "Add details"),
  cert("cert-thorpe-confined", "u6", "ct-confined", "Confined Spaces", undefined, undefined, "active", "Add details"),
  cert("cert-rogers-fa", "u7", "ct-first-aid", "Level 1 First Aid", undefined, undefined, "active", "Add details"),
  cert("cert-rogers-fit", "u7", "ct-fit", "Fit Test (respirator)", undefined, undefined, "active", "Add details"),
];

export function createSeedState(): CrewState {
  return {
    currentUserId: "u8",
    config: crewConfig,
    users: demoUsers,
    rolePermissions,
    jobDescriptions,
    values: valuesFromRituals(valueRituals),
    valueRituals,
    earningRules,
    pointsEvents: [
      { id: "pe1", userId: "u1", type: "daily_100", points: 25, reason: "Perfect daily truck-task day", ref: "warehouse-2026-07-23-u1", ts: "2026-07-23T16:30:00-07:00", source: "warehouse" },
      { id: "pe2", userId: "u1", type: "sop_completed", points: 20, reason: "SOP approved: Opening Procedures", ref: "sop-1-1", ts: "2026-07-21T10:25:00-07:00", source: "sop" },
      { id: "pe3", userId: "u3", type: "crew_peer_recognition", points: 5, reason: "Peer recognition received", ref: "rec-u3-1", ts: "2026-07-24T10:00:00-07:00", source: "crew" },
      { id: "pe-google-jesse-2026-07", userId: "u1", type: "crew_google_review", points: 200, reason: "Seeded 5-star Google review naming Jesse Dares", ref: "google_seed:u1:2026-07", ts: "2026-07-29T10:00:00-07:00", source: "crew" },
      { id: "pe-google-jon-2026-07", userId: "u3", type: "crew_google_review", points: 200, reason: "Seeded 5-star Google review naming Jon Gregoire", ref: "google_seed:u3:2026-07", ts: "2026-07-29T10:05:00-07:00", source: "crew" },
      { id: "pe-google-jon-2026-07-30", userId: "u3", type: "crew_google_review", points: 200, reason: "Seeded 5-star Google review naming Jon Gregoire from July 30 review", ref: "google_seed:u3:2026-07-30", ts: "2026-07-30T10:05:00-07:00", source: "crew" },
      { id: "pe-google-jordan-2026-07", userId: "u6", type: "crew_google_review", points: 200, reason: "Seeded 5-star Google review naming Jordan Thorpe", ref: "google_seed:u6:2026-07", ts: "2026-07-29T10:10:00-07:00", source: "crew" },
      { id: "pe-google-jordan-2026-07-30", userId: "u6", type: "crew_google_review", points: 200, reason: "Seeded 5-star Google review naming Jordan Thorpe from July 30 review", ref: "google_seed:u6:2026-07-30", ts: "2026-07-30T10:10:00-07:00", source: "crew" },
    ],
    walletConfig: { rewardDollarPerPoint: crewConfig.pointsAnchor, weeklyHabitCap: null },
    rewards,
    redemptions: [],
    ritualCompletions: [],
    reviews: [
      ...quarterlyReviewSeeds(),
      { id: "rev-u3-q2", userId: "u3", managerId: "u1", type: "quarterly", scheduledFor: "2026-06-30", completedAt: "2026-06-28", status: "completed", ratings: { responsibilities: 4, values: 3, kpis: 3 }, overallRating: 4, notes: "Strong quality on complex scopes.", swot: "Mentor one more tech next quarter." },
    ],
    reviewTypes,
    ratingScale,
    reviewCompetencies,
    reviewNotes: [],
    kpis,
    kpiResults: [
      { id: "kr1", kpiId: "kpi-tech-3", userId: "u4", periodKey: "2026-Q3", status: "on_track" },
      { id: "kr2", kpiId: "kpi-sr-1", userId: "u3", periodKey: "2026-Q3", status: "hit", value: "No callbacks" },
    ],
    bonusConfig,
    bonusRoleWeights,
    bonusPeriods: [{ id: "bp-2026", year: 2026, annualProfit: 250000, poolPercent: 0.05, status: "draft" }],
    certificationTypes,
    certifications: certs,
    recognitions: [{ id: "rec-u3-1", fromUserId: "u1", toUserId: "u3", message: "Helped coach traffic coating prep.", ts: "2026-07-24T10:00:00-07:00", pointsEventRef: "pe3" }],
    nudges: nudgeTemplates,
    forms,
    formQuestions,
    formSubmissions: [],
    policyDocuments,
    policyAcknowledgments: [],
    timeOffPolicies,
    timeOffEntries: [],
    incidentReports: [],
    onboarding: [],
    compensation: [],
    integrations,
    permissions: { cfoUserIds: ["u12"], hrOwnerUserIds: ["u8"], managerCanReviewCrew: true, rolePermissions },
  };
}

function rolePerm(orgRole: OrgRole, reportsTo: string, allowed: string[], others: false | "team" | "all" = false): RolePermission {
  const permissions = {
    viewOwnData: false,
    viewOthersProfiles: others || false,
    viewProbation: false,
    viewCompensation: false,
    viewBonusDollars: false,
    viewWriteUps: false,
    manageReviews: false,
    editConfig: false,
    editEmergencyContact: false,
    editAddress: false,
    exportReports: false,
  };
  for (const key of allowed) permissions[key as keyof typeof permissions] = true;
  if (others) permissions.viewOthersProfiles = others;
  return { orgRole, appRole: roleToAppRole[orgRole] ?? "crew", reportsTo, permissions };
}

function member(id: string, employeeId: string, firstName: string, lastName: string, name: string, orgRole: OrgRole, department: string, reportsTo: string, birthday: string, email: string, phone: string, color: string, employmentType: EmploymentType = "full_time"): Profile {
  return {
    id,
    employeeId,
    firstName,
    lastName,
    name,
    email: email || undefined,
    phone: phone || undefined,
    role: roleToAppRole[orgRole] ?? "crew",
    orgRole,
    department,
    reportsTo,
    status: "Active",
    branch: department === "Office" ? "office" : "field",
    managerId: managerIdFor(reportsTo),
    color,
    birthday: birthday || undefined,
    bonusRoleWeight: roleWeights[orgRole],
    employmentType,
  };
}

function applyReviewRoster(profile: Profile): Profile {
  const byName: Record<string, { date?: string; eligibility: Profile["reviewEligibility"] }> = {
    "Jordan Rogers": { date: "2026-09-30", eligibility: "Eligible" },
    "Tara Clark": { date: "2026-09-30", eligibility: "Eligible" },
    "Jesse Dares": { date: "2026-07-31", eligibility: "Eligible" },
    "Jon Gregoire": { date: "2026-09-30", eligibility: "Eligible" },
    "Jordan Thorpe": { date: "2026-09-30", eligibility: "Eligible" },
    "Josh Murray": { eligibility: "TBD" },
    "Logan Pardy": { date: "2026-07-31", eligibility: "Eligible" },
    "Matthew Chester": { date: "2026-07-31", eligibility: "Eligible" },
    "Bobby Wagner": { date: "2026-07-31", eligibility: "Eligible" },
    "Ray Boudreault": { date: "2026-07-31", eligibility: "Eligible" },
    "Shane Smith": { date: "2026-09-30", eligibility: "Eligible" },
    "Desmond Scott": { eligibility: "Not Eligible" },
    "Jacob Soto": { eligibility: "Not Eligible" },
    "Ken Taylor": { eligibility: "Not Eligible" },
  };
  const fullName = `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim();
  const meta = byName[profile.name] ?? byName[fullName];
  return meta ? { ...profile, nextQuarterlyReviewDate: meta.date, reviewEligibility: meta.eligibility, underNotice: false } : profile;
}

function quarterlyReviewSeeds() {
  return demoUsers
    .filter((user) => user.reviewEligibility)
    .map((user) => ({
      id: `rev-${user.id}-q3-2026`,
      userId: user.id,
      managerId: user.managerId ?? "u7",
      type: "quarterly" as const,
      scheduledFor: user.nextQuarterlyReviewDate ?? "TBD",
      status: user.reviewEligibility === "Not Eligible" ? "scheduled" as const : "scheduled" as const,
      ratings: {},
      notes: user.reviewEligibility === "Not Eligible" ? "Not eligible for quarterly review until employment eligibility gate is met." : "",
      swot: "",
      visibilityNotes: "Employee-visible: support, KPI, workmanship, strengths, opportunities, goals, overall rating, comments. Admin-only: job description ratings, core values, career development, management feedback, manager summary.",
    }));
}

function managerIdFor(reportsTo: string) {
  if (reportsTo === "Crew Lead") return "u1";
  if (reportsTo === "CEO / Owner" || reportsTo === "CEO" || reportsTo === "CEO/Owner") return "u7";
  return undefined;
}

function certType(id: string, name: string, category: string, validityMonths: number | undefined, lead: string, required: string, notes = ""): CertificationType {
  return { id, name, category, validityMonths, alertLeadDays: parseLeadDays(lead), requiredForRoles: splitList(required), notes };
}

function cert(id: string, userId: string, certTypeId: string, name: string, issuedAt: string | undefined, expiresAt: string | undefined, status: Certification["status"], note: string): Certification {
  return { id, userId, certTypeId, name, issuedAt, expiresAt, status, note };
}

function value(id: string, name: string, wording = `${name}.`): ValueItem {
  return { id, name, wording, dailyRitual: "", weeklyRitual: "", monthlyRitual: "", exercise: "", active: true };
}

function valuesFromRituals(rows: ValueRitual[]) {
  return values.map((item) => {
    const byCadence = rows.filter((row) => row.valueId === item.id);
    return {
      ...item,
      dailyRitual: byCadence.find((row) => row.cadence === "daily")?.prompt ?? "",
      weeklyRitual: byCadence.find((row) => row.cadence === "weekly")?.prompt ?? "",
      monthlyRitual: byCadence.find((row) => row.cadence === "monthly")?.prompt ?? "",
      exercise: byCadence.find((row) => row.cadence === "weekly")?.exercise ?? "",
    };
  });
}

function ritual(valueId: string, valueName: string, cadence: ValueRitual["cadence"], prompt: string, exercise: string, points: number): ValueRitual {
  return { id: `${valueId}-${cadence}`, valueId, value: valueName, cadence, prompt, exercise, points, active: true };
}

function earn(id: string, action: string, points: number, source: EarningRule["source"], weeklyCap?: number, habit = false): EarningRule {
  return { id, action, points, source, weeklyCap, habit, active: true };
}

function reward(id: string, name: string, points: number, approxValue: string, note?: string): Reward {
  return { id, name, points, approxValue, active: true, note };
}

function kpi(id: string, role: OrgRole, name: string, unit: string, cadence: string, dataSource: string): Kpi {
  return { id, role, name, description: "", unit, target: unit, period: cadence.toLowerCase().startsWith("annual") ? "annual" : cadence.toLowerCase().startsWith("quarter") ? "quarterly" : "monthly", dataSource, active: true };
}

function reviewType(id: string, type: string, appliesTo: string, cadence: string, rating: string, purpose: string): ReviewTypeConfig {
  return { id, type, appliesTo, cadence, ratingScale: rating, purpose };
}

function competency(name: string, roles: string, description: string): ReviewCompetency {
  return { id: slug(name), competency: name, appliesToRoles: splitList(roles), description };
}

function jd(id: string, role: OrgRole, version: string, responsibility: string, certs: string, kpis: string, reportsTo: string): JobDescription {
  return { id, role, version, responsibility, requiredCertifications: splitList(certs), linkedKpis: splitList(kpis), reportsTo };
}

function question(formId: string, order: number, text: string, responseType: CrewFormQuestion["responseType"], required: boolean, anonymousAllowed: boolean, visibility: CrewFormQuestion["visibility"] = "both", wordLimit?: number, options?: string[]): CrewFormQuestion {
  return { id: `${formId}-${order}`, formId, order, question: text, responseType, required, anonymousAllowed, visibility, wordLimit, options };
}

function nudge(id: string, name: string, triggerType: Nudge["triggerType"], cadence: string, audience: string, channel: string, leadTime: string, type: Nudge["type"]): Nudge {
  return { id, name, triggerType, cadence, audience, channel, leadTime, type, active: true, title: name, dueAt: "2026-07-29T08:00:00-07:00", read: false };
}

function integration(name: string, needed: IntegrationDecision["needed"], details: string): IntegrationDecision {
  return { id: slug(name), name, needed, details };
}

function splitList(value: string) {
  return value.split(/,|;/).map((item) => item.trim()).filter(Boolean);
}

function parseLeadDays(value: string) {
  return splitList(value).map(Number).filter((item) => Number.isFinite(item));
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
