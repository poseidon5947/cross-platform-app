import type { PromptSet, SopCategory, SopItem, SopState } from "../types";

export const demoUsers = [
  { id: "u1", name: "Alex P.", role: "admin", color: "#14A2A4", crewPlusId: "crew-alex" },
  { id: "u2", name: "Mika R.", role: "manager", color: "#0F5B7D", crewPlusId: "crew-mika" },
  { id: "u3", name: "Dave L.", role: "crew", color: "#1C1E20", crewPlusId: "crew-dave" },
  { id: "u4", name: "Nina K.", role: "crew", color: "#DB9C2F", crewPlusId: "crew-nina" },
] as const;

export const promptSets: PromptSet[] = [
  {
    id: "ps-warehouse",
    name: "Warehouse / Truck",
    prompts: [
      "What recent hiccups should this SOP prevent?",
      "Why is each tool or material loaded?",
      "Is there at least a half tank of gas, and where is fuel paid for?",
      "What are the first 10 things to check if the tool fails?",
    ],
  },
  {
    id: "ps-site-prep",
    name: "Site Prep / Crew Lead",
    prompts: [
      "Has the site manager confirmed access, scaffolding, and readiness?",
      "Do plans need to be reviewed before sending the crew?",
      "Has product quantity been double-checked?",
      "What happens if the site is not ready or product runs out?",
      "Does fence signage need to be installed or removed?",
    ],
  },
  {
    id: "ps-service",
    name: "Service Execution",
    prompts: [
      "What is the go/no-go weather policy?",
      "What quality checks happen before, during, and after the work?",
      "What common mistakes does this SOP avoid?",
      "How do you know the crew is ready to spray or install?",
    ],
  },
  {
    id: "ps-wrap",
    name: "Site Wrap-Up",
    prompts: [
      "What needs to come back to the warehouse?",
      "Are ladders, batteries, tools, and signage accounted for?",
      "Which job site is next?",
      "What must be photographed before leaving?",
    ],
  },
];

const categorySeed = [
  ["cat-warehouse", "Warehouse Operations", "ps-warehouse", ["Opening Procedures", "Safety Checks", "Inventory Handling", "Standards", "Anytime Tasks (Daily/Weekly/Monthly)", "Tool Inspection", "Equipment Inspection", "Vehicle Inspection", "Fleet Inspection", "Materials Inspection", "Repairs & Maintenance"]],
  ["cat-start", "Daily Start-Up", "ps-warehouse", ["Tool selection", "Material selection", "Vehicle Inspection", "Truck loading procedure"]],
  ["cat-closeout", "End-of-Day Closeout", "ps-wrap", ["Equipment Cleaning", "Equipment Checks", "Material returns", "Inventory checks", "Vehicle Fuel", "Mileage Checks", "Tool maintenance"]],
  ["cat-loadout", "Truck Loadout (start of day) by Service", "ps-warehouse", ["Truck Prep", "Waterproofing", "Traffic Coating", "Caulking", "CFI", "XPS"]],
  ["cat-truck-close", "Truck Closeout (end of day)", "ps-wrap", ["Truck Close-Out", "Waterproofing", "Traffic Coating", "Caulking", "CFI", "XPS"]],
  ["cat-service", "Service Execution", "ps-service", ["Waterproofing", "Traffic Coating", "Caulking", "CFI", "XPS"]],
  ["cat-site-prep", "Site Prep", "ps-site-prep", ["Hazard Assessments", "Equipment Staging", "Materials Staging", "Crew Planning", "Down-time activities", "What-if scenarios"]],
  ["cat-site-close", "Daily Job Site Closeout", "ps-wrap", ["What to do before leaving", "Things to bring back"]],
  ["cat-crew-lead", "Crew Lead", "ps-site-prep", ["Scheduling", "Site Readiness", "Site-manager touchpoints", "Materials Ordering", "Inventory Tracking", "Warehouse management", "Downtime Reduction", "Add-on opportunities"]],
  ["cat-travel", "Travel & Mobilization", "ps-site-prep", ["Site Readiness", "Site Access", "GC/Site-Super Comms", "Parking Logistics", "Site Orientation", "Site Safety", "Tools/materials on site", "Out-of-town"]],
  ["cat-qa", "Quality Assurance", "ps-service", ["Start of job", "Middle (50%)", "End (95%)"]],
  ["cat-demo", "Demobilization (100%)", "ps-wrap", ["Site Checks & sign-off", "Warehouse returns"]],
  ["cat-warranty", "Warranty", "ps-service", ["Warranty inspection", "Warranty repair notes"]],
  ["cat-other", "Other", "ps-warehouse", ["Free slot"]],
] as const;

export const categories: SopCategory[] = categorySeed.map(([id, name, promptSetId], index) => ({
  id,
  name,
  promptSetId,
  sortOrder: index + 1,
  archived: false,
}));

export function createSeedSops(now = "2026-07-28T08:00:00-07:00"): SopItem[] {
  return categorySeed.flatMap(([categoryId, , , items], categoryIndex) =>
    items.map((title, itemIndex) => {
      const id = `sop-${categoryIndex + 1}-${itemIndex + 1}`;
      const seededOwner = itemIndex % 3 === 0 ? "u3" : itemIndex % 3 === 1 ? "u4" : "u2";
      const status = categoryIndex < 3 && itemIndex === 0 ? "published" : itemIndex === 1 ? "in_progress" : "assigned";
      return {
        id,
        title,
        categoryId,
        description: `Document the Van Isle process for ${title.toLowerCase()}.`,
        status,
        assignedTo: seededOwner,
        createdBy: seededOwner,
        requiresPhoto: categoryId.includes("site") || categoryId.includes("qa"),
        requiresVideo: categoryId === "cat-service" && itemIndex < 2,
        dueDate: itemIndex > 2 ? "2026-08-09" : undefined,
        submittedAt: status === "published" ? "2026-07-20T15:10:00-07:00" : undefined,
        approvedAt: status === "published" ? "2026-07-21T10:25:00-07:00" : undefined,
        approvedBy: status === "published" ? "u2" : undefined,
        pointsAwarded: status === "published",
        updatedAt: now,
      } satisfies SopItem;
    }),
  );
}

export function createSeedState(): SopState {
  const sops = createSeedSops();
  return {
    currentUserId: "u1",
    users: demoUsers.map((user) => ({ ...user })),
    categories,
    promptSets,
    sops,
    steps: [
      { id: "step-1", sopId: "sop-1-1", sortOrder: 1, text: "Unlock warehouse and disarm alarm.", note: "Check that yard gate is clear." },
      { id: "step-2", sopId: "sop-1-1", sortOrder: 2, text: "Walk aisles for spills, tripping hazards, or blocked exits.", note: "Photo anything that needs manager follow-up." },
      { id: "step-3", sopId: "sop-6-1", sortOrder: 1, text: "Confirm forecast, substrate condition, and product staged before mobilizing.", note: "" },
    ],
    media: [],
    pointsEvents: [
      { id: "pe-sop-1-1", userId: "u3", type: "sop_completed", points: 20, reason: "SOP approved: Opening Procedures", ref: "sop-1-1", ts: "2026-07-21T10:25:00-07:00", awardedBy: "u2" },
      { id: "pe-sop-2-1", userId: "u3", type: "sop_completed", points: 20, reason: "SOP approved: Tool selection", ref: "sop-2-1", ts: "2026-07-21T10:25:00-07:00", awardedBy: "u2" },
      { id: "pe-sop-3-1", userId: "u3", type: "sop_completed", points: 20, reason: "SOP approved: Equipment Cleaning", ref: "sop-3-1", ts: "2026-07-21T10:25:00-07:00", awardedBy: "u2" },
    ],
    pointsAwards: [
      { id: "award-sop-1-1", sopId: "sop-1-1", crewMemberId: "u3", points: 20, awardedAt: "2026-07-21T10:25:00-07:00", externalRef: "sop-1-1", status: "sent" },
    ],
    notifications: [
      { id: "n1", userId: "u3", type: "assigned", title: "SOP assigned", body: "Waterproofing needs a clear procedure.", read: false, ts: "2026-07-27T09:00:00-07:00" },
    ],
    offlineMediaQueue: [],
    permissions: {
      crewLeadCanManageCategories: false,
      crewLeadCanAssignWithinCrew: true,
      crewLeadCanApprove: false,
    },
  };
}
