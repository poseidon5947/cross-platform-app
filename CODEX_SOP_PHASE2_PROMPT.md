# Codex Phase-2 Prompt — SOP+ (make it a real, suite-integrated app)

> Paste into Codex, working in `D:\project\Canada\cross platform\SOP+ Tool`.
> **Do not rebuild.** Phase-1 built correct domain logic, a proper schema, and the brand colors — keep all of it. This pass closes the gap between the current **localStorage demo** and the Supabase-backed, suite-integrated app the original brief asked for. Keep `npm run build` and `npm test` green; add tests for new logic.

---

## Context: what exists and what's missing

Phase-1 is a well-structured **front-end demo on `localStorage`**. Keep these — they're good:
- `src/domain/sop.ts` — lifecycle, **idempotent +20** (`approveSop` guards on `sop.pointsAwarded` + existing `sop_completed` event for that `sopId`), `canApprove` (one-person sign-off, configurable crew-lead), request-changes/submit, notifications. Do not regress this logic.
- `supabase/migrations/202607280001_sop_plus_schema.sql` — `sop`, `sop_category`, `sop_step`, `sop_media`, `prompt_set`, `points_award`, all referencing the shared `profiles`, with RLS. Keep/extend it.
- Seeded categories/items/prompt sets, guided builder, unlimited reorderable steps, editable published SOPs.

What must change (the app is not yet wired to anything):

1. It runs entirely on `localStorage` — **no Supabase data layer, no auth**. Auth is a user-picker dropdown (the pattern Warehouse Wizard replaced).
2. The **"shared ledger" is a local array**, not the real `points_events` — SOP points don't reach the rest of the suite.
3. **Media is simulated** — `attachMedia` mints a `storageKey` string; there's no real Supabase Storage upload/thumbnail, and the offline queue drains locally.
4. **Design system only partially ported** — brand colors yes (`#14a2a4`/`#1c1e20`/Questrial), but `styles.css` is ~100 lines vs Warehouse Wizard's ~1,900. It doesn't look like a sibling.

Reference implementation to mirror throughout: the Warehouse Wizard app at
`D:\project\Canada\cross platform\Waterproofing+ Warehouse Wizard` — reuse its Supabase client, auth flow, repo/React-Query pattern, offline-queue approach, and design system.

---

## Priority 1 — Supabase auth + data layer (load-bearing; do first)

Replace the localStorage-only model with real Supabase-backed data, keeping a **demo/localStorage fallback** when env vars are absent (so it still runs for design review), exactly like Warehouse Wizard.

**Auth**
- Add a password login screen using `@supabase/supabase-js`; on sign-in load the user's `profiles` row (role: admin | manager | crew) and drive all `canManage`/`canApprove` checks from the authenticated profile.
- Remove the demo user-picker dropdown (or gate it behind `VITE_DEMO_MODE`). Add sign-out. Show signed-in name/role in the header.
- **Same Supabase project as Warehouse Wizard** — shared `profiles`, shared users, shared points ledger.

**Data layer**
- Add `src/data/repo.ts` (or React Query hooks) that read/write the real tables (`sop`, `sop_category`, `sop_step`, `sop_media`, `prompt_set`, `points_award`) and read `profiles`. Use **React Query** for reads + optimistic writes, mirroring Warehouse Wizard.
- Single switch: Supabase configured → repo; else → the existing in-memory/localStorage demo. Don't fork the UI components; inject the data source.
- Keep `src/domain/sop.ts` as the pure state-transition core; the repo persists the results of those transitions.

**Seeding**
- Provide a seed path (SQL or a `scripts/seed-supabase.mjs` like Warehouse Wizard's) that loads the default categories, items, and prompt sets into Postgres. Document how demo auth users/profiles are created.

**Acceptance:** with env vars set, I can sign in as a manager and a crew member and all permissions + data come from Supabase; with no env vars, the localStorage demo still works.

---

## Priority 2 — Real Supabase Storage media pipeline + offline sync

The photo/video-per-step capability is the app's differentiator and is currently faked.

- Upload captured photos/videos to **Supabase Storage** (a private bucket, e.g. `sop-media`). Store only `storage_key` + `thumbnail_url` + `size` + `type` in `sop_media`, keyed to the **step** (not the SOP).
- Support in-app **camera capture** and **gallery upload**; render thumbnails inline per step; tap to expand. Apply sensible client-side **compression/size limits** for cellular upload.
- **Offline capture with sync-on-reconnect:** when offline, keep the capture in the existing `offlineMediaQueue` with the local blob, show it optimistically, and on `online` **upload to Storage and replace the local entry with the real key** — extend the current `drainOfflineMediaQueue` to actually push to Storage (mirror Warehouse Wizard's queue-drain pattern). De-dupe by command id; retain failures for retry.
- Generate a thumbnail (client-side canvas for photos; first-frame or a placeholder for video is acceptable in v1).
- Add a test for media-queue drain (offline capture → online → uploaded, queue cleared; failure retained).

**Acceptance:** a crew member can attach a photo offline; it appears immediately and uploads to Storage on reconnect; a published SOP shows the image inline next to the step.

---

## Priority 3 — Route the +20 through the shared points path (not a local array)

This is the suite's shared-wallet plumbing — implement it as the **single canonical path**, not an ad-hoc insert.

- Add a Supabase **Edge Function** (e.g. `award-points`) in the shared project that inserts into the shared **`points_events`** ledger. It must be **idempotent** on a key (`ref = sopId`, `type = sop_completed`): if an event for that `sopId` already exists, do nothing and return the existing award. Never re-award on re-approval or on editing a published SOP.
- On approval, SOP+ calls this function with `{ crewMemberId: creatorId, sopId, points: 20, reason, awardedBy }`. Also write the local `points_award` record (external_ref = returned event id, status).
- Keep `src/domain/sop.ts`'s existing idempotency as the client-side guard, but the **server function is the source of truth** for the actual ledger write.
- The dashboard reads a crew member's SOP points by summing their `points_events` (via repo), not a local array.
- **Design note for Codex:** this `award-points` function is intended to become the shared award path both Warehouse Wizard and the future Crew+ use. Keep the event shape consistent with the documented contract: `sop.completed → { crewMemberId, sopId, points: 20, awardedAt, awardedBy, reason }`. Do not create a competing balance. If Warehouse Wizard currently writes points inline, note in the README that it should migrate to this same function later (don't refactor Warehouse Wizard in this pass).

**Acceptance:** approving an SOP writes exactly one `sop_completed` row to the shared `points_events`; re-approving the same SOP writes nothing new; the creator's SOP points are readable from the shared ledger.

---

## Priority 4 — Port the Warehouse Wizard design system

Make SOP+ look like a sibling, not a different product.

- Port Warehouse Wizard's `src/styles.css` design tokens and components (cards, chips, bottom-sheets with grip, segmented controls, bottom nav, pills, toasts, buttons, KPI/stat tiles, brand theme as default). Reuse the same class names so the two apps are visually identical in tone.
- Keep the SOP-specific screens (Dashboard/My SOPs, create/assign, guided builder, review queue, published view) but re-skin them with the shared components.
- Ensure the brand theme (teal `#14A2A4` / carbon `#1C1E20` / Questrial) is the default, responsive mobile-first with a widened desktop layout for the manager dashboard — same as Warehouse Wizard.
- Restore Questrial the same way Warehouse Wizard does (and if Warehouse Wizard is later switched to a self-hosted font, keep them consistent).

**Acceptance:** placed side by side with Warehouse Wizard, SOP+ reads as the same suite.

---

## Cross-cutting requirements

- **Don't regress** the Phase-1 domain logic, schema, or the 3 existing tests. Add tests for: the idempotent server award path (unit-test the guard), media-queue drain, and role/permission enforcement.
- **RLS review:** confirm crew can only edit SOPs assigned to them or published ones; only managers (or crew-lead when configured) can create/approve; media inherits the SOP's edit permission; only the award function (service role) writes `points_events`.
- **Secrets server-side only** (service-role key, Storage signing). Never in the browser.
- **README:** update to state what's now real vs demo, the shared-Supabase/Storage setup, the `award-points` contract, and the seed steps. Remove any Phase-1 wording that implies the shared ledger or media upload already worked.

## Suggested order
1. Supabase client + auth + repo/React-Query + seed (P1).
2. `award-points` Edge Function + idempotent shared-ledger write; wire approval to it (P3).
3. Supabase Storage media upload + offline drain-to-Storage (P2).
4. Port the design system (P4).
5. RLS review, tests, README.

Start with Priority 1. Confirm the shared-Supabase-project assumption and the `award-points` function name/location if anything is ambiguous; otherwise proceed with these defaults.
