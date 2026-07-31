# SOP+

Suite-integrated SOP dashboard for Van Isle Water Proofing+. SOP+ is a sibling to Warehouse Wizard and uses the same stack, brand, Supabase project, `profiles` roles, Storage, and shared `points_events` ledger.

## Run

```powershell
cd "D:\project\Canada\cross platform\SOP+ Tool"
npm install
npm run dev
```

Local dev runs on:

```text
http://localhost:5174/
```

Production-style preview:

```powershell
npm run build
npm run preview -- --host 127.0.0.1 --port 4174
```

Ngrok for SOP+:

```powershell
cd "D:\project\Canada\cross platform"
.\ngrok.exe http --url=matrix-demote-ripcord.ngrok-free.dev 127.0.0.1:4174
```

## Modes

With `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, SOP+ uses Supabase password auth and loads data from the real SOP tables. Without those env vars, it falls back to the localStorage demo for design review.

Optional demo override:

```text
VITE_DEMO_MODE=true
```

This keeps the local user picker visible even when Supabase is configured.

## Supabase Setup

Use the same Supabase project as Warehouse Wizard.

Important migration order: apply the **Warehouse Wizard** migrations first. They create the shared `profiles`, `points_events`, `points_event_type`, and canonical `award-points` contract that SOP+ extends. Then apply the SOP+ migration. All suite apps share one Supabase project, one points ledger, and one deployed `award-points`.

Required env:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SOP_SEED_MANAGER_ID=
SOP_SEED_CREW_ID=
```

Apply:

```text
../Waterproofing+ Warehouse Wizard/supabase/migrations/202607240001_initial_schema.sql
../Waterproofing+ Warehouse Wizard/supabase/migrations/202607280003_points_unification.sql
supabase/migrations/202607280001_sop_plus_schema.sql
```

Deploy:

```text
../Waterproofing+ Warehouse Wizard/supabase/functions/award-points
```

Seed after creating real Auth users and matching `profiles` rows:

```powershell
npm run seed:supabase
```

`SOP_SEED_MANAGER_ID` must be an existing `profiles.id`. `SOP_SEED_CREW_ID` is optional; if omitted, starter SOPs are assigned to the manager.

## What Is Real Now

- Supabase password login and sign-out.
- Remote reads for `profiles`, SOP categories, prompt sets, SOPs, steps, media, `points_award`, and shared `points_events`.
- Optimistic UI writes persisted back to Supabase through `src/data/repo.ts`.
- Private `sop-media` Storage bucket upload for online photo/video attachments.
- Offline media queue with retry; captured media appears immediately and uploads when back online if the browser still has the queued `File`.
- Shared canonical `award-points` Edge Function that writes `sop_completed` to Warehouse Wizard's `points_events`.
- Client and server idempotency: one `+20` award per `sopId`.
- RLS policies for SOP read/edit boundaries and manager category/prompt management.

## Points Contract

Edge Function request:

```json
{
  "kind": "sop_completed",
  "crewMemberId": "profile uuid",
  "sopId": "sop uuid",
  "reason": "SOP approved: Opening Procedures",
  "awardedBy": "manager profile uuid"
}
```

The canonical function ignores client-supplied point amounts for SOPs, loads the SOP server-side, verifies the caller is admin/manager, derives fixed `+20`, and inserts idempotently with `type='sop_completed'` and `ref=sopId`.

Shared ledger row:

```json
{
  "type": "sop_completed",
  "points": 20,
  "reason": "SOP approved: Opening Procedures",
  "ref": "sopId",
  "user_id": "creator",
  "ts": "awardedAt"
}
```

There must be exactly one deployed Supabase function named `award-points`. SOP+ keeps a matching copy only so deploying from this folder does not clobber the canonical implementation with an older one.

## V1 Scope

- Manager dashboard and crew My SOPs.
- Create/assign SOP flow.
- Guided builder with category prompts.
- Unlimited editable/reorderable steps.
- Step-level media attachments.
- Submit, approve, and request changes.
- Published SOP reference remains editable by anyone.
- Supabase-backed data with demo fallback.

V2 remains out of scope: runnable checklist logs, edit history/diffs, digital signatures, downtime analytics, and bulk import from legacy PDFs.
