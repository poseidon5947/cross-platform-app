# Codex Phase-2 Prompt — Crew+ (harden the wallet, complete the seed, finish the app)

> Paste into Codex, working in `D:\project\Canada\cross platform\Crew+ Waterproofing Team Tool`.
> **Do not rebuild.** Phase-1 built correct domain logic, a proper schema, and the right architecture — keep it. This pass fixes a wallet-integrity security hole, completes the Supabase seed, ports the design system, and fleshes out the module UIs. Keep `npm run build` and `npm test` green; add tests for new logic.

Reference implementation for all patterns (design system, repo, auth, seed script, award function): the sibling apps at `D:\project\Canada\cross platform\Waterproofing+ Warehouse Wizard` and `D:\project\Canada\cross platform\SOP+ Tool`.

---

## Priority 1 — SECURITY: harden the `award-points` function (do first)

**The problem:** `supabase/functions/award-points/index.ts` authenticates the caller but then inserts whatever `{ crewMemberId, points, type, ref }` the client sends. Any signed-in user can grant themselves — or anyone — arbitrary points into the **shared** `points_events` ledger that all three apps depend on. This is a wallet-integrity hole.

**Fix — the server, not the client, decides the points:**
- The client should send an **action identifier + context** (e.g. `{ ruleKey, crewMemberId, ref }`), **not a points amount**. The function looks up the point value from the **server-side earning rules** (the `crew_earning_rule` table) and awards that — ignore any client-supplied `points`.
- **Authorization per action type:**
  - **Self-serve earns** (daily/weekly/monthly rituals, feedback submitted): allowed only for `crewMemberId === caller` (you can only earn your own habit points), and still subject to the **weekly habit cap** enforced server-side.
  - **Manager/admin-granted earns** (KPI target hit, review completed, safety milestone, customer review +200, peer recognition to someone else): require the caller to be `admin`/`manager` (or the configured HR owner).
  - **Redemptions** (negative events): only admin/HR (redemption approver).
- Keep the existing **idempotency** guard on `(type, ref)` and the append-only model.
- Enforce the **weekly habit cap server-side** too (don't rely only on the client's `cappedHabitAward`) — reject/clamp habit awards that would exceed the cap for that user+week.
- Mirror the shape SOP+'s function uses (auth via user client, writes via service client, role check against `profiles`). Return the same `{ eventId, awardedAt, alreadyAwarded }` contract.

**Acceptance:** a crew member cannot award arbitrary points or points to another user; ritual points are validated against the rules table and capped server-side; manager-only awards reject non-managers; re-submitting the same `(type, ref)` never double-awards.

---

## Priority 2 — Complete the Supabase seed

**The problem:** `supabase/seed/seed.sql` only seeds values + rewards (2 inserts). The real content — **earning rules, the real certification roster, KPI scaffold, bonus config, review templates, org roster with `org_role`/`branch`** — exists only in the localStorage demo (`src/data/seed.ts`). In real Supabase mode, most modules come up empty. And `scripts/seed-supabase.mjs` only prints the SQL.

**Fix:**
- Expand `supabase/seed/seed.sql` (or generate it from `src/data/seed.ts`) to insert the full Phase-1 content: **earning rules** (the whole point-earning table with amounts + `habit` flags), **rewards catalog** (with the reconcile note), the **real cert roster** (Jesse/Shane/Jon/Josh/Logan/Thorpe/Rogers with their certs, statuses, and the known gaps), the **KPI scaffold** per role (blank targets), the **bonus config** defaults, and the **value rituals**.
- Make `scripts/seed-supabase.mjs` actually apply the seed against the service-role connection (like Warehouse Wizard's / SOP+'s seed scripts), not just print it. Handle the org roster: seed `profiles` rows' `org_role`/`branch`/`manager_id` for the 12-person team (document how these map to real Auth users).
- Keep `src/data/seed.ts` as the demo/localStorage fallback in sync with the SQL seed (same content).

**Acceptance:** after applying migrations + running the seed against a fresh shared DB, Crew+ in Supabase mode shows the real roster, earning rules, catalog, KPI scaffold, and bonus config — not empty modules.

---

## Priority 3 — Port the Warehouse Wizard / SOP+ design system

**The problem:** `styles.css` is ~112 lines; the app doesn't read as a suite sibling (SOP+ is ~907 after its port).

**Fix:**
- Port the shared design system from `Waterproofing+ Warehouse Wizard/src/styles.css` (SOP+ already did this — match it). Reuse the same class names: cards, chips, pills, buttons, bottom-sheets with grip, bottom nav, KPI/stat tiles, forms, toasts, brand theme default (teal `#14A2A4` / carbon `#1C1E20` / Questrial), responsive mobile-first + widened desktop layout.
- Re-skin the existing Crew+ screens with those components — keep behavior, change presentation.

**Acceptance:** placed next to Warehouse Wizard and SOP+, Crew+ reads as the same suite.

---

## Priority 4 — Flesh out the module UIs (v1 completeness)

Phase-1's `App.tsx` is a thin scaffold across six modules. Bring each to a usable v1 (logic already exists in `src/domain/crew.ts` — wire it to real screens, don't rewrite the domain):

- **Wallet & leaderboard** — balance from the shared ledger, company leaderboard, ledger history, quarterly leaderboard reset (wallet carries over).
- **Rewards** — catalog with implied `$` (keep the reconcile banner), request → admin approval → negative event; redemption history.
- **Values & rituals** — five values with daily/weekly/monthly rituals; complete-ritual action (routes through the hardened award function, respecting the cap); nudge surfacing.
- **Reviews** — 3-tier (crew) / optional 1–5 (office); 30/60/90 + quarterly + annual cadence with countdown; scores responsibilities + values + KPIs; lightweight between-review notes; "completed on time" award.
- **KPIs** — scaffold per role with editable (blank) targets; per-period result entry; target-hit award.
- **Bonus** — green/amber/red trajectory for everyone; **dollars only for admin/CFO** (enforced by the RLS already in place + `canSeeBonusDollars`); editable %/weights/rating-factor map.
- **Compliance** — real roster; expiry-date entry; 60/30/7-day alerts; gaps surfaced prominently; "certs current" award.
- **Feedback & recognition** — feedback form (+40), peer recognition (+20 received), Google-review QR / 5★ (+200) with manual-confirm attribution.

Keep it mobile-first with a widened desktop dashboard for the HR/admin views.

---

## Cross-cutting
- **Don't regress** the 7 existing tests or the Phase-1 domain logic (`walletBalance`, `cappedHabitAward`, redemption, `bonusTrajectory`, `certAlertLevel`, `canSeeBonusDollars`). Add tests for: the hardened award authorization (self vs manager vs admin), server-side cap enforcement, and the completed seed.
- **RLS:** keep the bonus dollar-privacy policies; confirm crew can read only their own reviews/certs/points and the leaderboard; only admin/HR manage config and approve redemptions.
- **Secrets** server-side only. No new dependencies unless necessary (no chart libs — reuse the suite's SVG approach if you add visuals).
- **README:** update to reflect the hardened award contract (server decides points), the real seed steps, the shared-Supabase ordering (Warehouse Wizard → SOP+ → Crew+ migrations), and what still needs real client numbers (KPI targets, bonus %/weights, cert dates, final value wording — shipped as editable scaffold).

## Suggested order
1. Harden `award-points` + server-side cap + tests (P1).
2. Complete `seed.sql` + real `seed-supabase.mjs` (P2).
3. Port the design system (P3).
4. Flesh out module UIs against the existing domain (P4).
5. RLS re-check, tests, README.

Start with Priority 1. Confirm the earning-rule→points lookup source (`crew_earning_rule`) and the manager-vs-self action classification if ambiguous; otherwise proceed with these defaults.
