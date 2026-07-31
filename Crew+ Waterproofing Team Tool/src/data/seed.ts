import type {
  BonusConfig,
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
  Profile,
  RatingScaleDefinition,
  ReviewCompetency,
  ReviewTypeConfig,
  Reward,
  Role,
  RolePermission,
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
  member("u11", "EMP-011", "Jacob", "Soto", "Jacob", "Technician", "Field", "CEO / Owner", "", "jacob.valentin.soto@gmail.com", "(250) 882-8666", "#c53030"),
  member("u12", "EMP-012", "Finance", "Admin", "CFO", "CFO", "Office", "CEO / Owner", "", "finance@vanislecoatings.com", "", "#37526d"),
];

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
  value("v1", "Safety First, Always"),
  value("v2", "Do It Right the First Time"),
  value("v3", "Own the Outcome"),
  value("v4", "Leave It Better"),
  value("v5", "Grow the Crew"),
];

export const valueRituals: ValueRitual[] = [
  ritual("v1", "Safety First, Always", "daily", "30-sec pre-job hazard call-out, logged by Crew Lead", "Name today's top hazard and the control", 5),
  ritual("v1", "Safety First, Always", "weekly", "Share one near-miss or catch (no blame)", "Crew discusses one prevention", 5),
  ritual("v1", "Safety First, Always", "monthly", "10-min toolbox talk, led by a different tech", "Rotate the presenter", 5),
  ritual("v2", "Do It Right the First Time", "daily", "Log one thing you'd be happy to inspect yourself", "Photo/note the detail", 5),
  ritual("v2", "Do It Right the First Time", "weekly", "Review any callback/rework and the fix", "Root-cause in 2 lines", 5),
  ritual("v2", "Do It Right the First Time", "monthly", "Quality win of the month recognized", "Team nominates", 5),
  ritual("v3", "Own the Outcome", "daily", "Close your own tool/material logging same-day", "No next-morning cleanup", 5),
  ritual("v3", "Own the Outcome", "weekly", "Move or close every open 1:1 action item", "Update owner/date", 5),
  ritual("v3", "Own the Outcome", "monthly", "Name one thing to take fuller ownership of", "Set the intention", 5),
  ritual("v4", "Leave It Better", "daily", "Photo the site as you leave it", "Before/after", 5),
  ritual("v4", "Leave It Better", "weekly", "One improvement to a truck, process, or warehouse", "Log the idea", 5),
  ritual("v4", "Leave It Better", "monthly", "Team vote on the cleanest, most professional job site", "Team nominates", 5),
  ritual("v5", "Grow the Crew", "daily", "Apprentices log one thing learned; leads log one thing taught", "One sentence reflection", 5),
  ritual("v5", "Grow the Crew", "weekly", "Senior tech shadows or coaches one skill", "Log skill coached", 5),
  ritual("v5", "Grow the Crew", "monthly", "Progress one cert or skill goal per person", "Pick next milestone", 5),
];

export const earningRules: EarningRule[] = [
  earn("earn-ww-day", "Perfect daily truck-task day", 25, "warehouse"),
  earn("earn-ww-streak", "5-day truck-task streak bonus", 25, "warehouse"),
  earn("earn-log-week", "Clean material/tool logging week (no corrections)", 40, "warehouse", undefined, true),
  earn("earn-tools", "All tools returned, none damaged (weekly)", 30, "warehouse", undefined, true),
  earn("earn-daily", "Daily value ritual", 5, "crew", undefined, true),
  earn("earn-weekly", "Weekly value exercise", 5, "crew", undefined, true),
  earn("earn-monthly", "Monthly value ritual", 5, "crew", undefined, true),
  // TODO confirm with client: "etc. +5" was applied to these non-named small-tier rules.
  earn("earn-swot", "Quarterly SWOT on time", 5, "crew"),
  earn("earn-feedback", "Company feedback form submitted", 5, "crew"),
  earn("earn-certs", "All certs current (monthly, no lapses)", 5, "crew"),
  earn("earn-review", "Review completed on time", 5, "crew"),
  earn("earn-kpi", "KPI target hit", 5, "crew"),
  earn("earn-google", "5-star Google review naming you", 200, "crew"),
  // TODO confirm with client: written compliments were treated as small-tier "etc. +5".
  earn("earn-compliment", "Written customer compliment", 5, "crew"),
  earn("earn-safety", "Crew safety milestone", 5, "crew"),
  earn("earn-peer", "Peer recognition received", 5, "crew"),
  earn("earn-sop", "SOP created & approved", 20, "sop"),
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
];

export const bonusConfig: BonusConfig = {
  id: "bonus-2026",
  profitSharePercent: 0,
  roleWeights,
  ratingFactors: { below: 0.7, meets: 1, exceeds: 1.3 },
  floorsCaps: "Optional guardrails - client to confirm minimum floor / maximum cap.",
  tenureBump: 0,
  payoutTiming: "December",
  quarterlyComponent: false,
  whoConfirmsProfit: "CFO",
  whoApprovesPayouts: "CEO",
};

export const bonusRoleWeights: BonusRoleWeight[] = Object.entries(bonusConfig.roleWeights).map(([orgRole, weight]) => ({ orgRole: orgRole as OrgRole, weight }));

export const reviewTypes: ReviewTypeConfig[] = [
  reviewType("rt-30", "Probation 30-day", "New hires", "Day 30", "Below / Meets / Exceeds", "Early fit & setup"),
  reviewType("rt-60", "Probation 60-day", "New hires", "Day 60", "Below / Meets / Exceeds", "Progress check"),
  reviewType("rt-90", "Probation 90-day", "New hires", "Day 90", "Below / Meets / Exceeds", "Confirm permanent"),
  reviewType("rt-quarterly", "Quarterly check-in", "Everyone", "Q1-Q4 (15 min)", "Below / Meets / Exceeds", "Light: KPIs, SWOT, 1 up / 1 to work on"),
  reviewType("rt-annual", "Annual review", "Everyone", "Once a year", "Below / Meets / Exceeds", "Full scorecard; feeds Dec bonus"),
];

export const ratingScale: RatingScaleDefinition[] = [
  { value: 1, label: "below", meaning: "Not yet meeting the role's bar", performanceFactor: 0.7 },
  { value: 2, label: "meets", meaning: "Solidly meeting expectations", performanceFactor: 1 },
  { value: 3, label: "exceeds", meaning: "Consistently above the role's bar", performanceFactor: 1.3 },
];

export const reviewCompetencies: ReviewCompetency[] = [
  competency("Quality / right the first time", "All", "Work meets spec with minimal rework"),
  competency("Safety compliance & leadership", "All", "Follows and models safe practice"),
  competency("Paperwork & logging discipline", "Field", "Accurate, same-day tool/material logs"),
  competency("Team & communication", "All", "Works well with crew, clear communication"),
  competency("Lives the company values", "All", "Demonstrates the 5 values day to day"),
  competency("Mentoring / development", "Crew Lead, Senior", "Grows others"),
];

export const jobDescriptions: JobDescription[] = [
  jd("jd-tech-1", "Technician", "v1", "Complete assigned waterproofing scope to spec, no callbacks", "WHMIS, Fit Test, Fall Arrest", "Jobs on schedule; rework rate", "Crew Lead"),
  jd("jd-tech-2", "Technician", "v1", "Log tools & materials in Waterproofing+ same-day", "WHMIS", "Logging accuracy", "Crew Lead"),
];

export const forms: CrewForm[] = [
  { id: "form-swot", name: "Quarterly SWOT", anonymousAllowed: false },
  { id: "form-feedback", name: "Company feedback form", anonymousAllowed: true },
];

export const formQuestions: CrewFormQuestion[] = [
  question("form-swot", 1, "What are your Strengths right now?", "Text", true, false),
  question("form-swot", 2, "What are your Weaknesses / areas to grow?", "Text", true, false),
  question("form-swot", 3, "What Opportunities do you see (for you or the company)?", "Text", true, false),
  question("form-swot", 4, "What Threats or obstacles are in the way?", "Text", true, false),
  question("form-feedback", 1, "What's working well right now?", "Text", true, true),
  question("form-feedback", 2, "What's frustrating or slowing you down?", "Text", true, true),
  question("form-feedback", 3, "One idea to make us better?", "Text", false, true),
  question("form-feedback", 4, "How supported do you feel? (1-5)", "Scale 1-5", true, true),
];

export const nudgeTemplates: Nudge[] = [
  nudge("nudge-daily", "Daily value focus", "cadence", "Each morning", "Crew", "In-app + Push", "-", "ritual"),
  nudge("nudge-weekly", "Weekly value exercise", "cadence", "Friday", "Crew", "In-app + Push", "-", "ritual"),
  nudge("nudge-monthly", "Monthly value ritual", "cadence", "1st of month", "Crew", "In-app", "-", "ritual"),
  nudge("nudge-swot", "Quarterly SWOT", "cadence", "Start of quarter", "Crew", "In-app + Push", "Before review", "swot"),
  nudge("nudge-feedback", "Company feedback form", "cadence", "Monthly", "Crew", "In-app", "-", "feedback"),
  nudge("nudge-birthday", "Birthday reminder", "date-driven", "On date", "Manager", "Push + Email", "Same day", "birthday"),
  nudge("nudge-anniversary", "Work anniversary", "date-driven", "On date", "Manager", "Push", "Same day", "anniversary"),
  nudge("nudge-cert", "Cert expiry alert", "date-driven", "60/30/7 days + expiry", "Crew + Manager", "Push + Email", "60/30/7 days", "cert"),
  nudge("nudge-review", "Review countdown", "date-driven", "Before review date", "Manager", "Push + Email", "7 days", "review"),
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

const certs: Certification[] = [
  cert("cert-jesse-whmis", "u1", "ct-whmis", "WHMIS", undefined, undefined, "active", "Add issue/expiry date"),
  cert("cert-jesse-hearing", "u1", "ct-hearing", "Hearing test", undefined, undefined, "active", "Add date"),
  cert("cert-jesse-fa", "u1", "ct-first-aid", "Level 1 First Aid", undefined, undefined, "expired", "RENEW NOW - required on site"),
  cert("cert-jesse-fit", "u1", "ct-fit", "Fit Test (respirator)", "2025-09-09", undefined, "expired", "Last tested 2025-09-09 - confirm & rebook"),
  cert("cert-jesse-lift", "u1", "ct-lift", "Lift Operation", undefined, undefined, "active", "Add date"),
  cert("cert-shane-lift", "u2", "ct-lift", "Lift Operation", undefined, undefined, "active", "Only cert on file - confirm others"),
  cert("cert-jon-lift", "u3", "ct-lift", "Lift Operation", undefined, undefined, "active", "Add date"),
  cert("cert-jon-fa", "u3", "ct-first-aid", "Level 1 First Aid", undefined, "2028-02-28", "active", "Expires Feb 2028"),
  cert("cert-jon-fit", "u3", "ct-fit", "Fit Test (respirator)", undefined, undefined, "active", "Add date"),
  cert("cert-jon-confined", "u3", "ct-confined", "Confined Spaces", undefined, undefined, "active", "Add date"),
  cert("cert-josh-fall", "u4", "ct-fall", "Fall Arrest", undefined, undefined, "active", "Add date"),
  cert("cert-josh-lift", "u4", "ct-lift", "Lift Operation", undefined, undefined, "active", "Add date"),
  cert("cert-logan-none", "u5", "ct-whmis", "No certs on file", undefined, undefined, "missing", "Full audit needed before high-risk work"),
  cert("cert-thorpe-lift", "u6", "ct-lift", "Lift Operation", undefined, undefined, "active", "Add date"),
  cert("cert-thorpe-fa", "u6", "ct-first-aid", "Level 1 First Aid", undefined, "2028-02-28", "active", "Expires Feb 2028"),
  cert("cert-thorpe-fit", "u6", "ct-fit", "Fit Test (respirator)", undefined, undefined, "active", "Add date"),
  cert("cert-thorpe-confined", "u6", "ct-confined", "Confined Spaces", undefined, undefined, "active", "Add date"),
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
      { id: "pe-google-jordan-2026-07", userId: "u6", type: "crew_google_review", points: 200, reason: "Seeded 5-star Google review naming Jordan Thorpe", ref: "google_seed:u6:2026-07", ts: "2026-07-29T10:10:00-07:00", source: "crew" },
    ],
    walletConfig: { rewardDollarPerPoint: crewConfig.pointsAnchor, weeklyHabitCap: null },
    rewards,
    redemptions: [],
    ritualCompletions: [],
    reviews: [
      { id: "rev-u1-q3", userId: "u1", managerId: "u7", type: "quarterly", scheduledFor: "2026-08-05", status: "scheduled", ratings: {}, notes: "", swot: "" },
      { id: "rev-u5-90", userId: "u5", managerId: "u1", type: "90", scheduledFor: "2026-07-30", status: "scheduled", ratings: {}, notes: "", swot: "" },
      { id: "rev-u3-q2", userId: "u3", managerId: "u1", type: "quarterly", scheduledFor: "2026-06-30", completedAt: "2026-06-28", status: "completed", ratings: { responsibilities: "exceeds", values: "meets", kpis: "meets" }, notes: "Strong quality on complex scopes.", swot: "Mentor one more tech next quarter." },
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

function member(id: string, employeeId: string, firstName: string, lastName: string, name: string, orgRole: OrgRole, department: string, reportsTo: string, birthday: string, email: string, phone: string, color: string): Profile {
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
    payBand: undefined,
    bonusRoleWeight: roleWeights[orgRole],
  };
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

function value(id: string, name: string): ValueItem {
  return { id, name, wording: `${name}.`, dailyRitual: "", weeklyRitual: "", monthlyRitual: "", exercise: "", active: true };
}

function valuesFromRituals(rows: ValueRitual[]) {
  return values.map((item) => {
    const byCadence = rows.filter((row) => row.valueId === item.id);
    return {
      ...item,
      dailyRitual: byCadence.find((row) => row.cadence === "daily")?.prompt ?? "",
      weeklyRitual: byCadence.find((row) => row.cadence === "weekly")?.prompt ?? "",
      monthlyRitual: byCadence.find((row) => row.cadence === "monthly")?.prompt ?? "",
      exercise: byCadence.find((row) => row.cadence === "daily")?.exercise ?? "",
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
  return { id, role, name, description: "", unit, target: "", period: cadence.toLowerCase().startsWith("annual") ? "annual" : cadence.toLowerCase().startsWith("quarter") ? "quarterly" : "monthly", dataSource, active: true };
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

function question(formId: string, order: number, text: string, responseType: CrewFormQuestion["responseType"], required: boolean, anonymousAllowed: boolean): CrewFormQuestion {
  return { id: `${formId}-${order}`, formId, order, question: text, responseType, required, anonymousAllowed };
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
