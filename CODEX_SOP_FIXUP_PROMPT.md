# Codex Fix-Up Prompt — SOP+ Phase-2 polish

> Paste into Codex, working in `D:\project\Canada\cross platform\SOP+ Tool`.
> Small, targeted patch. Do not rebuild or refactor unrelated code. Keep `npm run build` and `npm test` green. The Phase-2 auth, Supabase repo, Storage pipeline, and the idempotent `award-points` Edge Function are reviewed and correct — **do not touch them.**

Phase-2 landed the load-bearing pieces well. Three cleanups remain.

---

## 1. Finish porting the Warehouse Wizard design system (main item)

SOP+ has the brand colors but only ~140 lines of CSS, so it doesn't read as a sibling of Warehouse Wizard. Make the two apps visually consistent.

- Port Warehouse Wizard's `src/styles.css` design tokens and component styles into SOP+ (reference: `D:\project\Canada\cross platform\Waterproofing+ Warehouse Wizard\src\styles.css`). Reuse the **same class names** so components match: cards, chips, bottom-sheets (with grip), segmented controls, bottom nav, pills, buttons, toasts, KPI/stat tiles, form fields, and the brand theme as the default.
- Re-skin the existing SOP+ screens (Dashboard / My SOPs, create-and-assign, guided builder, review queue, published view) with those shared components — keep the behavior, change the presentation.
- Keep the Van Isle brand default (teal `#14A2A4` / carbon `#1C1E20` / Questrial), responsive mobile-first with a widened desktop layout for the manager dashboard, matching Warehouse Wizard.
- Do not change any domain logic, repo, or Edge Function while re-skinning.

**Acceptance:** placed next to Warehouse Wizard, SOP+ reads as the same suite.

---

## 2. Remove the dead `approve_sop` Postgres function

The migration defines a callable `approve_sop(...)` function that re-implements the +20 award inline. Nothing calls it — the app awards via the `award-points` Edge Function — so it's a second, unused source of truth.

- Delete the `approve_sop` function definition from `supabase/migrations/202607280001_sop_plus_schema.sql`.
- **Keep** the `alter type points_event_type add value if not exists 'sop_completed'` line and the partial unique index on `points_events(ref) where type = 'sop_completed'` — those protect the real award path.
- Confirm nothing in `src/` calls `approve_sop` via RPC (there shouldn't be anything). The single award path stays: client → `award-points` Edge Function → shared `points_events`.

**Acceptance:** one award path only; migration still applies cleanly; award idempotency unchanged.

---

## 3. Document the migration ordering dependency

The SOP+ migration `ALTER`s `points_event_type` and references `points_events`, both of which are created by the **Warehouse Wizard** migration in the shared Supabase project. Run against a fresh DB without it, these statements fail.

- In `README.md`, add a short, explicit setup note: **apply the Warehouse Wizard migration first** (it creates `profiles`, `points_events`, and `points_event_type` in the shared project), **then** apply the SOP+ migration and deploy the `award-points` function. State clearly that both apps share one Supabase project.

---

## Constraints
- Do not regress the 8 existing tests or the Phase-2 auth/repo/Storage/award logic.
- No new dependencies.
- Purely presentational + cleanup + docs — no behavior changes.
