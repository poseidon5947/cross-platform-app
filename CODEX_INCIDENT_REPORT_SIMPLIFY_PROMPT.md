# Codex Prompt — Simplify the Damage & Incident Report + add Crew Lead/Owner receipt confirmation

> Working dir: `Crew+ Waterproofing Team Tool`. Source: client chat message (Aug 10, 2026) + `_New_ Van-Isle Damage & Incident Report __ August 2026.docx.pdf`. This **replaces** the incident report shipped in the V6 round (`202608070001_v6_client_updates.sql`, `submitIncidentReport`/`superviseIncidentReport`/`reviewIncidentReport` in `src/domain/crew.ts`, the `Incidents`/`IncidentReportCard` components in `src/App.tsx`). The client simplified their paper form and changed the review flow — don't just add to the old one, cut it down to match. Keep `npm run build`/`npm test` green.

## 1. New, shorter field set

The client's new PDF has far fewer fields than the one V6 was built against. Replace `IncidentReport`/`IncidentReportInput` in `src/types.ts` with:

```ts
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
```

Drop everything from the V6 shape that isn't in the new PDF: `IncidentLocation`/`DamagedPropertyType` enums, `propertyType`/`assetDescription`/`assetIdOrPlate`/`propertyOwner`, `damageType`/`estimatedCost`/`anyoneInjured`/`otherPartyInvolved`, `witnessStatementsAttached`/`policeReportFiled`/`fileReportNumber`, `correctiveActions`/`correctiveActionOwner`/`correctiveActionDueDate`, `IncidentWitness`/`witnesses`, and the separate `supervisorSignedName`/`supervisorSignedAt`/`supervisorComments` + `reviewedByPosition`/`furtherActionRequired`/`furtherActionDetails` fields — the new form has one combined **Location** free-text field (not the old On Site/In Shop/On the Road/Other picker), and the whole "type of property damaged" section is gone entirely (this new form is about any incident, not specifically property damage).

Note the PDF has two name/role/phone blocks — "Employee Details" (top) for the person involved in the incident, and "Reported By" (bottom) for who's filing it. Keep them as two distinct sets of fields even though they'll often be the same person (crew self-reporting).

## 2. New review model: single receipt confirmation from Crew Lead or Owner

Client: *"Once an incident report is filled out, it needs to go to the Crew Lead (Jesse Dares) and Owner (Jordan Rogers) to review. One of those people must sign it to confirm receipt of the incident."*

This replaces the old two-stage `superviseIncidentReport` + `reviewIncidentReport` (supervisor sign-off, then separate management review with further-action flag) with **one** confirmation step, gated to whoever holds the `Crew Lead` or `CEO / Owner`/`CEO` `orgRole` — not "any manager/admin" like the old supervisor step was.

In `src/domain/crew.ts`, replace both functions with:

```ts
export function confirmIncidentReceipt(state: CrewState, reportId: string, confirmerId: string, now = new Date().toISOString()) {
  const confirmer = state.users.find((item) => item.id === confirmerId);
  if (!confirmer || !["Crew Lead", "CEO / Owner", "CEO"].includes(confirmer.orgRole)) return state;
  return {
    ...state,
    incidentReports: (state.incidentReports ?? []).map((report) => report.id === reportId ? {
      ...report,
      confirmedByUserId: confirmerId,
      confirmedByName: confirmer.name,
      confirmedAt: now,
    } : report),
  };
}
```

Don't hardcode Jesse/Jordan by name or id — gate by `orgRole` so it keeps working if the client changes who holds those roles. (`OrgRole` in `src/types.ts` already includes `"Crew Lead"` and `"CEO / Owner"`/`"CEO"`, no type changes needed there.)

In `App.tsx`'s `Incidents`/`IncidentReportCard` components: remove the "Supervisor Review" and "Management Review" sections entirely, replace with one "Confirm Receipt" block — shows the confirmation once signed (`confirmedByName`/`confirmedAt`), otherwise shows a "Confirm receipt" button **only** to users whose `orgRole` is Crew Lead or Owner (check client-side same as the domain gate, consistent with how `canReview`/`canViewAll` already work in that component). Everyone who can see the report (reporter + managers/admins, same visibility rule as before) can see whether it's been confirmed and by whom, but only Crew Lead/Owner get the action.

## 3. Migration

Add `Crew+ Waterproofing Team Tool/supabase/migrations/202608100001_incident_report_simplify.sql`. Since this replaces the V6 shape rather than extending it, and no real incident data has been entered yet (V6 just shipped), drop and recreate `crew_incident_report` rather than trying to preserve the old columns:

```sql
drop table if exists crew_incident_report;

create table crew_incident_report (
  id uuid primary key default gen_random_uuid(),
  employee_name text not null,
  employee_role text not null,
  employee_phone text,
  location text not null,
  date_of_incident date not null,
  time_of_incident time not null,
  incident_cause text not null,
  incident_details text not null,
  action_taken text not null,
  police_notified boolean not null default false,
  follow_up_required text,
  photo_file_names jsonb not null default '[]'::jsonb,
  reported_by_user_id uuid not null references profiles(id) on delete cascade,
  reported_by_name text not null,
  reported_by_role text not null,
  reported_by_phone text,
  confirmed_by_user_id uuid references profiles(id) on delete set null,
  confirmed_by_name text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table crew_incident_report enable row level security;

create policy "incident reports self insert" on crew_incident_report for insert with check (
  reported_by_user_id = auth.uid()
);

create policy "incident reports self or manager readable" on crew_incident_report for select using (
  reported_by_user_id = auth.uid() or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'manager'))
);

create policy "incident reports crew lead or owner confirm" on crew_incident_report for update using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.org_role in ('Crew Lead', 'CEO / Owner', 'CEO'))
) with check (
  exists (select 1 from profiles p where p.id = auth.uid() and p.org_role in ('Crew Lead', 'CEO / Owner', 'CEO'))
);
```

⚠️ Heads-up on applying this: the V6 migration (`202608070001_v6_client_updates.sql`) already created the old `crew_incident_report` shape on the live shared Supabase project as of Aug 10. Since there's no real data in it yet, dropping and recreating is safe right now — but don't reuse this pattern later once the app is actually in use with real incident data.

## 4. Tests

Replace the V6 incident-report tests in `src/domain/crew.test.ts` with cases for the new shape: submit creates a report with the new fields; a user with `orgRole: "Crew Lead"` can confirm receipt; a user with `orgRole: "CEO / Owner"` can confirm receipt; a regular manager/admin **without** one of those two org roles cannot (assert the function is a no-op, matching the pattern the old `reviewIncidentReport` rejection test used).

## Acceptance
- Crew+ builds and tests pass.
- The in-app form matches the new PDF's fields exactly — no leftover property-damage/witness/corrective-action fields anywhere in the UI or types.
- A report shows as unconfirmed until someone holding Crew Lead or Owner org role confirms it; nobody else can trigger that action, client or server side.
- Old V6 incident-report code (types, domain functions, migration content) is fully removed, not left dead alongside the new version.
