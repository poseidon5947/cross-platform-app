# Codex Prompt — Unify the suite onto ONE canonical points-award function

> Cross-app change. Primary working directory: `D:\project\Canada\cross platform\Waterproofing+ Warehouse Wizard` (it owns the base `points_events` schema). Also touches `SOP+ Tool` and `Crew+ Waterproofing Team Tool`. All three share one Supabase project.
> Goal: every app awards points through **one canonical, hardened, idempotent Edge Function** — closing the last thread of the shared-wallet architecture. Keep every app's `npm run build` and `npm test` green; do not regress any existing tests.

---

## Why (two real problems)

1. **Warehouse Wizard writes points inline.** `src/data/repo.ts` → `persistPoints()` inserts straight into `points_events` from the client/service. SOP+ and Crew+ already award through an `award-points` Edge Function; WW does not. So WW's writes bypass the shared, server-validated path.
2. **Name collision.** Both `SOP+ Tool/supabase/functions/award-points/` and `Crew+ Waterproofing Team Tool/supabase/functions/award-points/` exist as **different implementations with the same name**, deploying to the **same Supabase project**. Only one can win — today they'd clobber each other. There must be exactly one deployed `award-points`.

Fix both by consolidating into a single canonical function that is a **superset** of all three apps' award needs.

---

## The canonical `award-points` function (superset)

Create one hardened Edge Function that handles every award type in the suite, deployed once to the shared project. Base it on the strongest existing version (Crew+'s ruleKey-based, server-decides-points design). It must:

- **Authenticate** the caller (`getUser`) and load their `profiles` row (`role`, `org_role`).
- **Dispatch by a `kind` (or `type`) parameter**, with per-kind authorization, server-side value determination, and idempotency on `(type, ref)`:

  | Kind | Points source | Authorization | Idempotency `ref` |
  |---|---|---|---|
  | `sop_completed` | fixed +20 | admin/manager (approver) | `sopId` |
  | crew ruleKey earns (`earn-*`) | from `crew_earning_rule` | self for self-serve rituals/feedback; admin/manager for granted; habit weekly cap enforced | rule + period/context |
  | `redeem` | `-abs(crew_reward_redemption.points)` | admin/HR only | `redeem:{redemptionId}` |
  | `daily_100` | fixed +50 | **server-verified**: the target user actually has 100% of required daily truck tasks completed for that period (see below) | `{userId}:{dayKey}` |
  | `streak_bonus` | fixed +25 | server-verified streak milestone (every 5th day) | `{userId}:{dayKey}` |
  | `daily_100_reversal` / streak reversal | negative | server-verified that the day is no longer 100% and a prior award exists | `{userId}:{dayKey}` |
  | `manual_adjust` | from body | admin only | provided |

- **Never trust client-supplied point amounts** (except `manual_adjust`, admin-gated). The server derives points from rules/fixed values/DB records.
- **Idempotent:** if an event for `(type, ref)` exists, return it without re-inserting. This replaces WW's client-side "awardedOn" guard.
- Return the shared contract shape `{ eventId, awardedAt, alreadyAwarded }`.

### Warehouse Wizard specifics (the hard part — preserve exact semantics)

WW's `evaluateDailyPoints` (in `src/domain/business.ts`) is tested and correct — **keep the domain logic as the source of truth for *what* should happen**, but move the *write* server-side and make it authoritative:

- **daily_100 (+50):** award only if the server confirms the user has completed 100% of the **required** daily tasks (`requiredForDailyPoints !== false`) for that Vancouver `dayKey`. Read `task_completions` server-side to verify — don't trust the client.
- **streak_bonus (+25):** on every 5th consecutive qualifying day; update `streaks` accordingly.
- **Reversal:** when a previously-100% day drops below 100%, write the negative `daily_100_reversal` (and reverse the streak bonus if it was granted that day), exactly as `evaluateDailyPoints` currently computes. Keep this append-only (negative events), matching the current enum (`daily_100`, `daily_100_reversal`, `streak_bonus`, `manual_adjust`).
- The idempotency + reversal keying must reproduce today's behavior: a day can be awarded once, reversed once, and (if re-completed) re-awarded — matching the existing tests. **Do not change the tested outcomes**, only where the write happens.

---

## Migration steps

1. **Build the canonical function** (in Warehouse Wizard's `supabase/functions/award-points/`, since WW owns the base schema). Make it the superset above.
2. **Migrate WW writes:** replace `persistPoints()`'s direct `points_events` insert with calls to the canonical function (`functions.invoke("award-points", …)`), passing `kind`, target user, and the `dayKey`/context — for daily_100, streak_bonus, and reversals. Keep `streaks` upkeep (either in the function or alongside). Leave `evaluateDailyPoints` intact for the client's optimistic UI, but the ledger write goes through the function.
3. **Reconcile SOP+ and Crew+:** point them at the same canonical function/contract. Either (a) delete their local `award-points` copies and depend on the one canonical deployment, or (b) make all three folders contain the identical canonical implementation. Whichever you choose, **document that exactly one `award-points` is deployed** and all three call it. Their existing call sites must keep working (the superset must accept SOP+'s `sop_completed` and Crew+'s `ruleKey`/`redeem` payloads unchanged).
4. **Keep `points-feed`** (WW's read function) as-is.

---

## Constraints & acceptance

- **No regressions:** every app's tests stay green. WW's points/streak/reversal tests must pass **unchanged** — same awards, same reversals, same totals; only the write path moves server-side. Add tests for the canonical function's per-kind authorization and the server-side daily_100 verification.
- **Security:** a crew member cannot self-award daily_100/streak/sop/manual points; only server-verified state or proper role grants them. Idempotency prevents double-award across all kinds.
- **Enum:** all types already exist in the shared `points_event_type` (`daily_100`, `daily_100_reversal`, `streak_bonus`, `manual_adjust`, `sop_completed`, `crew_*`, `redeem`). Add any missing value with `alter type ... add value if not exists`.
- **Docs:** update each app's README to say all three award through the single canonical `award-points`, and describe the `kind`-based contract. Note this supersedes WW's former inline `persistPoints` write.
- No new dependencies.

## Suggested order
1. Write the canonical superset function + tests (in WW).
2. Migrate WW's `persistPoints` → function calls; verify WW tests unchanged.
3. Reconcile SOP+ and Crew+ to the same function; verify their tests.
4. READMEs + "one deployed award-points" note.

This is a careful cross-app refactor — preserve tested behavior exactly; only move *where* the ledger write happens and make it the single hardened path. Confirm the canonical function's home (WW) and the reconcile approach (delete duplicates vs. identical copies) if ambiguous; otherwise proceed with these defaults.
