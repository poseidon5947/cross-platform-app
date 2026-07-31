# Van Isle Water Proofing+ Warehouse Wizard

Responsive internal PWA for a Victoria/BC waterproofing contractor. It uses Van Isle brand colors (`#14A2A4`, `#1C1E20`, white) and Questrial while adding the Phase 2 pieces: Supabase auth/data, role-aware UI, real CSV import, QuickBooks OAuth/sync functions, offline queue replay, gas-station truck logging, and an append-only points ledger.

## Stack

- React + TypeScript + Vite
- React Query for Supabase-backed loading/cache invalidation
- Supabase Auth, Postgres, RLS, Edge Functions
- Demo fallback with localStorage when Supabase env vars are absent or `VITE_DEMO_MODE=true`
- CAD, GST 5%, America/Vancouver day/week/month keys

## Run

```powershell
npm.cmd install
npm.cmd run dev
```

```powershell
npm.cmd test
npm.cmd run build
```

## Environment

Copy `.env.example` and set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `QBO_CLIENT_ID`
- `QBO_CLIENT_SECRET`
- `QBO_REDIRECT_URI`
- `QBO_ENVIRONMENT=sandbox` or `production`
- `POINTS_WEBHOOK_URL`
- `POINTS_WEBHOOK_SECRET`

Set `VITE_DEMO_MODE=true` to force the localStorage demo even when Supabase variables exist.

## Auth And Roles

Supabase mode shows a password login screen. After sign-in, the app loads the authenticated user's `profiles` row and drives permissions from `role`, not the old demo switcher. In demo mode only, the header opens the demo user picker.

| Capability | Admin | Manager | Crew |
|---|---:|---:|---:|
| Log use/delivery/loss/return | yes | yes | yes |
| Receive stock / signed adjust | yes | yes | no |
| Add/edit master data | yes | yes | no |
| Tool check in/out, charge, damage note | yes | yes | yes |
| Truck logs and task completion | yes | yes | yes |
| Reports/export | yes | yes | no |
| Users/roles/imports/QuickBooks | yes | no | no |

RLS notes: crew cannot insert `receive` or `adjust` transactions and cannot write material/site/task master data. Managers can write operational/master data. Only admins can manage profiles and integration connections.

## Supabase Setup

Apply migrations in order:

```text
supabase/migrations/202607240001_initial_schema.sql
supabase/migrations/202607280003_points_unification.sql
```

> **Note:** `materials.name` carries a `unique` constraint — the material upserts and the CSV importer dedupe on it via `onConflict: "name"`. If you applied an earlier copy of this migration (before the constraint was added), re-run/reset the database, or apply `alter table materials add constraint materials_name_key unique (name);` before importing materials.

> **Existing DB category note:** the real workbook adds `ppe` and `shop` material categories. Existing Supabase databases need either a reset/re-run of the migration or:
> `alter type material_category add value if not exists 'ppe';`
> `alter type material_category add value if not exists 'shop';`

Create Auth users in Supabase first, then insert matching `profiles` rows with their `auth.users.id` UUIDs and one of `admin`, `manager`, or `crew`.

Seed full demo catalogue:

```powershell
$env:SUPABASE_URL="https://your-project.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="..."
npm.cmd run seed:supabase
```

The seed script reads `src/data/seed.ts`, maps local demo IDs to deterministic UUIDs, and inserts services, 121 real workbook materials, sites, 18 tools, 3 trucks, true crew names from the workbook CREW tab, and the current truck task list.

## Data Layer

`src/data/repo.ts` maps Supabase rows into the existing `AppState` shape. The UI is shared between remote and demo modes. Supabase mode uses React Query for reads and optimistic local state for writes, then invalidates the remote snapshot after successful mutations.

## Offline Sync

When offline, crew material logs and truck logs update local state optimistically and append a command to `offlineQueue`. On `online`, `src/data/offline.ts` replays queued commands in order and clears successful commands. The header shows pending sync count.

## Inventory And Adjust

`adjust` means a signed delta. The "Set exact count" UI computes:

```text
delta = targetQty - currentQty
```

The DB trigger applies `adjust` as-is. Example: current 6, target 4 writes `qty=-2` and lands at 4.

## CSV / Sheet Import

Admin screen supports CSV upload. In Supabase mode it calls `materials-import`; in demo mode it validates and applies locally.

Supported workbook export headers include:

- `Inventory`
- `Category`
- `Service`
- `Unit (locked)`
- `Units per`
- `Unit Cost ($)`
- `On Hand (current quantity)`
- `Reorder At (3 remaining in inventory)`
- `Warehouse Location`

The importer parses quoted CSV, validates category/unit/step, upserts by `materials.name`, and never overwrites `qty` in Supabase. Barrel and gallon units default to quarter-step logging (`0.25`) so crews can record `.25`, `.5`, `.75`, or whole quantities.

The first draft can be imported now and safely updated later by re-running the metadata import. Supabase imports intentionally keep live `qty` untouched so crew updates remain the source of truth after the July 17 ready state.

Demo seed source: workbook sheet 3 imported 121 material rows and skipped 0 rows. Blank units are seeded as `unit`; blank reorder thresholds default to `3`.

## QuickBooks Online

Admin flow:

1. Click `Connect QuickBooks`.
2. The app invokes `quickbooks-oauth`, which verifies the admin profile and returns an Intuit auth URL.
3. Callback exchanges the code server-side, validates state, and stores tokens in `integration_connections`.
4. Click `Sync jobs`.
5. `quickbooks-sync` refreshes tokens if needed and upserts `sites` from QBO projects/jobs with status `IN PROGRESS`.

Stored QBO fields only:

- `qbo_customer_name`
- `qbo_project_id`
- `qbo_project_name`

## Canonical Points Contract

All three suite apps award through one canonical, hardened Edge Function:

```text
supabase/functions/award-points
```

Deploy this function once to the shared Supabase project. SOP+ and Crew+ keep matching copies of the same implementation to avoid name-collision drift, but Warehouse Wizard is the canonical home because it owns the base `points_events` schema.

The client sends `kind` plus context; the function authenticates the caller, derives the point value server-side, verifies the Warehouse/SOP/Crew state required for that kind, enforces authorization, and inserts idempotently by `(type, ref)`.

Examples:

```json
{ "kind": "daily_100", "crewMemberId": "profile uuid", "dayKey": "2026-07-28", "ref": "profile uuid:2026-07-28" }
{ "kind": "sop_completed", "sopId": "sop uuid" }
{ "kind": "crew_rule", "crewMemberId": "profile uuid", "ruleKey": "earn-daily", "ref": "ritual:profile uuid:v1:daily:2026-W31", "weekKey": "2026-W31" }
{ "kind": "redeem", "crewMemberId": "profile uuid", "redemptionId": "redemption uuid" }
```

Warehouse Wizard no longer inserts point rows inline from `persistPoints`; that path invokes `award-points`.

The HR/PEOPLE app consumes `points_events`.

```http
GET /functions/v1/points-feed?since=2026-07-01T00:00:00.000Z
```

Events are append-only and include `user_id`, `type`, `points`, `reason`, `ref`, `ts`, and joined profile fields. Totals should be derived by summing events.

Rules:

- +25 once per Vancouver day for 100% daily truck tasks.
- +25 every 5-day streak.
- Reversals write negative events.

## Truck And Tool Workflow

Vehicle/general tasks are grouped as Start of Day before 8am and End of Day before 4pm. These reset on the relevant daily/weekly/monthly period. Service packing-list tasks remain visible by service, but they are not required for daily points because the exact work depends on the job.

The Trucks tab uses `Gas Station Check` instead of the old end-of-day truck log. It records odometer KM, total cost with GST, receipt photo filename, gas station name, fuel topped, exterior wash, repairs/issues, and notes.

The Tools tab floating action opens a job-based check-in/out sheet, rather than sending users to the inventory material log.

## Reports

The Admin tab provides:

- Reorder PO estimate with GST/freight and clipboard copy
- Transaction CSV copy
- Monthly Inventory Log CSV for accounting, filtered by selected month with date, material, quantity, unit, action, job/site, service, crew member, unit cost, and value
- Printable Materials Cost Report for browser Save as PDF
- BuilderTrend kept as export/stub only

## Tests

Current tests cover stock movement, signed adjust/set exact count, reorder math, Vancouver period keys, points/streaks/reversals, truck-log auto-task completion, CSV validation, and offline queue drain.
