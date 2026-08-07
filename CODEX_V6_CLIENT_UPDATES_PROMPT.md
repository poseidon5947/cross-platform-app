# Codex Prompt — V6 client updates: Damage & Incident Report + revised launch dates

> Working dirs: `Crew+ Waterproofing Team Tool` (new feature) and root docs (`LAUNCH_READINESS.md`, `CLIENT_INPUT_NEEDED.md`). Source: `V6_ CLIENT_INPUT.docx.pdf` (received Aug 6, 2026) and `Van-Isle Damage & Incident Report __ Updated Janauary 30, 2026.docx.pdf.pdf`. Keep `npm run build` and `npm test` green in Crew+; do not touch Warehouse Wizard or SOP+ source beyond the shared `award-points` sync check below.

## 0. Read this first — most of V6 is already built, do not redo it

Before writing code, verify these against the current tree — they already match the V6 doc and need **no changes**:
- Warehouse Wizard material unit dropdown is already exactly `Unit | Roll | Drum | Box | Sausage`, defaulting to `Unit` (`ALLOWED_MATERIAL_UNITS` in `Waterproofing+ Warehouse Wizard/src/domain/business.ts`). This matches V6 section A1 "Column D" verbatim.
- Truck task points already go to whichever user is logged in and checks off the task (`toggleTask` keys off `current.currentUserId` in `Waterproofing+ Warehouse Wizard/src/App.tsx`) — nobody is pre-assigned, matching the client's "any user who uses the tool" note.
- The gas-check pre-trip task already exists (`k3: "Gas tank half full - if not fill"`, start-of-day, in `Waterproofing+ Warehouse Wizard/src/data/seed.ts`) — this is what prevents the ran-out-of-gas scenario the client described. No new checklist item needed.
- Crew+ sick/vacation tracking (5 paid, 3 unpaid, 90-day eligibility, Jan 1–Dec 31 renewal, vacation-only reminders) is fully built (`src/domain/crew.ts`, `timeOffSummary`/`recordTimeOff`/`vacationReminderText`) — V6 restates this unchanged from V5.
- The annual bullying/harassment e-signature (read + esign + date, Aug 31 due date, repeats annually) is already built via the generic `PolicyDocument`/`PolicyAcknowledgment` model and `acknowledgePolicy`/`policyDueDate` in `src/domain/crew.ts`.
- Quarterly SWOT (500-word cap per category, Sep 30/Dec 31/Mar 31/Jun 30 deadlines) and crew self-service address/emergency contact/certification-with-photo are already built.
- Values, KPIs, Job Descriptions, and Nudge & Cadence content is explicitly **not ready** — the client says feedback lands after August 17. Do not build against the current placeholder sheets for these; leave as-is.

The one genuinely new piece is the Damage & Incident Report form below.

## 1. New feature: Damage & Incident Report (Crew+)

Client wants their existing paper form (`Van-Isle Damage & Incident Report`) turned into an in-app form. Build it as a new Crew+ tab/section following the existing domain-function + panel-component pattern (see `PolicyDocument`/`acknowledgePolicy` and time-off for the shape to match).

### Data model (`src/types.ts`)
Add types matching the PDF fields:
```ts
export type IncidentLocation = "on_site" | "in_shop" | "on_the_road" | "other";
export type DamagedPropertyType = "company_vehicle" | "personal_vehicle" | "company_tool" | "customer_property" | "other";

export interface IncidentWitness {
  name: string;
  contact: string;
  statementTaken: boolean;
}

export interface IncidentReport {
  id: string;
  reportedByUserId: string;
  dateOfReport: string;
  dateOfIncident: string;
  timeOfIncident: string;
  location: IncidentLocation;
  locationOther?: string;
  jobTitle: string;
  supervisorForeman: string;
  propertyType: DamagedPropertyType;
  propertyTypeOther?: string;
  assetDescription: string;
  assetIdOrPlate?: string;
  propertyOwner: string;
  incidentDescription: string;
  damageType: string;
  estimatedCost?: number;
  anyoneInjured: boolean;
  otherPartyInvolved: boolean;
  otherPartyDetails?: string;
  photosTaken: boolean;
  witnessStatementsAttached: boolean;
  policeReportFiled: boolean;
  fileReportNumber?: string;
  immediateActionTaken: string;
  correctiveActions: string;
  correctiveActionOwner?: string;
  correctiveActionDueDate?: string;
  witnesses: IncidentWitness[];
  supervisorName?: string;
  supervisorSignedName?: string;
  supervisorSignedAt?: string;
  supervisorComments?: string;
  reviewedByUserId?: string;
  reviewedByPosition?: string;
  furtherActionRequired?: boolean;
  furtherActionDetails?: string;
  createdAt: string;
}
```
Add `incidentReports: IncidentReport[]` to `CrewState`.

### Domain functions (`src/domain/crew.ts`)
- `submitIncidentReport(state, reportedByUserId, input)` — crew member creates a report (any crew member, no eligibility gate — this is safety-critical, don't restrict who can file).
- `superviseIncidentReport(state, reportId, supervisorId, signedName, comments?)` — records supervisor sign-off (name + timestamp), matching the `acknowledgePolicy` sign/date pattern.
- `reviewIncidentReport(state, reportId, reviewerId, position, furtherActionRequired, details?)` — management final review; gate to `role === "admin" || role === "manager"` the same way `canRunReviews`/`canApproveRedemptions` gate elsewhere.

### UI (`src/App.tsx`)
- New tab (e.g. `"incidents"`) with an intake form mirroring the PDF's sections in order: General Information → Type of Property Damaged → Description of Incident → Damage Details → Photos and Evidence → Immediate Action Taken → Corrective/Preventive Actions → Witness Information (repeatable rows, add/remove) → Supervisor Review → Management Review.
- Evidence "photo" fields follow the same lightweight pattern already used for `certificatePhotoKey` (capture the filename via `<input type="file">`, no new storage pipeline) — don't build real object storage upload for this pass.
- List view: crew see their own submitted reports; managers/admins see all (same `canViewTeam`-style branch filter used for time off and compliance).
- Supervisor/management review sections only render their action buttons for users with the appropriate role, but the read-only report itself is visible to whoever can already view it per the list rule above.

### Migration
Add `Crew+ Waterproofing Team Tool/supabase/migrations/202608070001_v6_client_updates.sql`: `crew_incident_report` table (columns mirroring the fields above; `witnesses` as `jsonb`) and `crew_incident_witness` if you'd rather normalize it — either is fine, match the existing style in `202608060001_v5_client_updates.sql`. RLS: crew can insert their own and select their own; managers/admins can select and update all (for supervisor/management review fields).

### Tests
Add `src/domain/crew.test.ts` cases: submit creates a report; supervisor sign-off records name+date; management review sets `furtherActionRequired` and gates by role; a crew member without manager/admin role cannot call the review function (assert it's a no-op or throws, matching how other gated functions in this file behave).

## 2. Update launch dates (docs only, no app logic)

The client moved dates in V6 — update these two docs to match, don't touch anything code-side for this:
- **Warehouse Wizard**: client-provided inventory data (Column J quantities, real tool roster) now arrives **August 13** (was Aug 10), goal launch **Friday, August 14** (was Aug 15).
- **Crew+**: goal launch **Friday, August 28** (was Aug 15) — client wants it live and in use by end of August. Values/KPIs/Job Descriptions/Nudge feedback arrives **after August 17**.
- SOP+ dates are unchanged by V6 (still one week behind Warehouse Wizard/Crew+, per the existing note).

Update `LAUNCH_READINESS.md` and `CLIENT_INPUT_NEEDED.md` accordingly, and add a short "## Included From V6" section to `LAUNCH_READINESS.md` (new incident report; revised dates; confirms V5 people/inventory rules carry forward unchanged) in the same style as the existing "Included From V4"/"Included From V5" sections.

## Acceptance
- Crew+ builds and tests pass (`npm run build`, `npm test`), including new incident-report domain tests.
- A crew member can file a Damage & Incident Report end-to-end (submit → appears in their own list); a manager/admin can see all reports, add supervisor sign-off, and complete the management review with the further-action flag.
- No changes made to the already-built V5 items listed in section 0 — confirm with `git diff` that Warehouse Wizard unit types, truck task/points logic, and Crew+ time-off/bullying-policy/SWOT code are untouched.
- `award-points/index.ts` remains byte-identical across all three apps (unchanged by this prompt — verify with `diff`/SHA-256 if anything nearby got touched).
- `LAUNCH_READINESS.md` and `CLIENT_INPUT_NEEDED.md` reflect the new Aug 13/14 (Warehouse Wizard) and Aug 28 (Crew+) dates.
