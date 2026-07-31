# Codex Prompt — Crew+ small tweaks (confirmed) : Jordan Thorpe award + remove weekly cap

> Working dirs: `Crew+ Waterproofing Team Tool` and the canonical `award-points` function (keep all three copies byte-identical). Small, targeted change. Keep every app's `npm run build` and `npm test` green; update any cap-related test to the new behavior. **Do NOT change the +5 base point value** — that's still under client consideration (they're weighing 5 vs 10).

## 1. Confirm the third Google-review award → Jordan Thorpe

The client confirmed the third +200 recipient is **Jordan Thorpe** (u6). Finalize the seeded award — remove the TODO placeholder:
- In `Crew+ …/src/data/seed.ts`, the seeded event for Jordan currently has:
  - `id: "pe-google-jordan-todo-2026-07"`, `ref: "google_seed:TODO_CONFIRM_JORDAN_THORPE:u6:2026-07"`, and a reason starting "TODO_CONFIRM …".
- Change it to a finalized award: `id: "pe-google-jordan-2026-07"`, `ref: "google_seed:u6:2026-07"`, `reason: "Seeded 5-star Google review naming Jordan Thorpe"` (matching the Jesse/Jon entries' style). Keep `userId: "u6"`, `type: "crew_google_review"`, `points: 200`.
- Remove the `TODO_CONFIRM`/"which Jordan" note from the Crew+ README — it's resolved (three recipients: Jesse, Jon, Jordan Thorpe, +200 each, one-time/idempotent).

## 2. Remove the weekly points cap (client: "No weekly cap on points. Leave it off.")

Turn off habit-point capping everywhere — earning should be uncapped.

- **Crew+ config/seed:** remove the weekly cap. Set `walletConfig.weeklyHabitCap` to a value that means "no cap" (e.g. `null`/`0`/omit) and stop passing per-rule `weeklyCap` values (the `earn(...)` calls that pass 150/80/60). Update the `EarningRule`/config types if needed so "no cap" is representable.
- **Crew+ UI:** remove any "weekly cap"/"capped" messaging tied to habit points.
- **Canonical `award-points` function (all three copies, byte-identical):** the habit branch currently clamps `points` to `cap - alreadyThisWeek` and returns `capped:true` when the cap is hit. **Bypass the clamp when no cap is configured** — if the cap is null/0/absent (or `CREW_WEEKLY_HABIT_CAP` is unset/`0`), award the full rule points with no weekly ceiling. Keep the idempotency guard on `(type, ref)` unchanged. Re-sync so all three `award-points/index.ts` copies are byte-identical (verify with SHA-256).
- **Tests:** update/replace the weekly-cap test(s) to assert the new behavior — habit awards are no longer clamped (a user can earn repeated habit points in a week without hitting a ceiling). Idempotency (same `(type, ref)` doesn't double-award) must still hold.

## Do NOT change (pending client decision)
- The **+5 base point value** for small-tier actions (rituals, safety, peer, feedback, KPI, review, certs). The client is deciding between 5 and 10; leave it at 5 until they confirm. Everything else in the point table stays as-is (perfect day 25, streak 25, SOP 20, Google review 200).

## Acceptance
- Jordan Thorpe (u6) shows a finalized +200 seeded review award; no TODO_CONFIRM remains.
- Habit/ritual points are uncapped — no weekly ceiling clamps them; idempotency still prevents double-awards.
- All three apps build; tests green; `award-points` byte-identical across Warehouse Wizard, SOP+, Crew+.
- READMEs updated (Jordan resolved; "no weekly cap"). Note in the Crew+ README that the base small-tier value (5 vs 10) is still pending client confirmation.
