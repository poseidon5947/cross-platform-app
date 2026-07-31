# Codex Follow-Up Prompt — Warehouse Wizard, Phase 2 (make it a real app)

> Paste everything below into Codex, working in the existing project:
> `D:\project\Canada\cross platform\Waterproofing+ Warehouse Wizard`
> Do **not** rebuild from scratch. Keep the existing design, domain logic, tests, and Supabase schema — they are good. This pass closes the gap between the current **localStorage demo** and a real multi-user app.

---

## Context: what exists and what's missing

The Phase-1 build is a well-structured **front-end demo running entirely on `localStorage`**, with a strong but **unconnected** Supabase schema and **stubbed** integrations. Domain logic (`src/domain/business.ts`), the DB schema/RLS (`supabase/migrations/…`), and the tests are solid — build and tests pass. Do not regress them.

The problems this pass must fix, in priority order:

1. The React app never talks to Supabase and has **no real authentication** — roles exist only in SQL.
2. QuickBooks and CSV/Sheet import are **inert stubs**.
3. The **offline queue is dead code** (append-only, never drained).
4. Several prototype features were reduced to placeholders (truck log, tool checkout, log flow, add-material, cost-report PDF).
5. A backend semantics bug: `adjust` transactions.

Keep everything TypeScript, keep the existing CSS/design tokens, and add tests for new logic.

---

## Priority 1 — Wire the frontend to Supabase + real auth (load-bearing; do this first)

The app currently uses `loadState()/saveState()` against `localStorage` and a "switch demo user" picker. Replace this with real Supabase-backed auth and data, while keeping a **demo/offline fallback** so the app still runs without env vars.

**Auth**
- Add a login screen (email + password, or magic link) using `@supabase/supabase-js` and the existing `src/integrations/supabase.ts` client (currently imported nowhere — wire it in).
- On sign-in, load the user's `profiles` row to get their `role` (admin | manager | crew). Drive all `canManage`/`canAdmin` checks from the authenticated profile, **not** a client-side picker.
- Remove (or gate behind a `VITE_DEMO_MODE` flag) the "choose demo user" switcher. When `isSupabaseConfigured()` is false, keep the current localStorage demo so the app is still runnable for design review.
- Add sign-out. Show the signed-in user's name/role in the header where the demo picker was.

**Data layer**
- Introduce a data-access module (`src/data/repo.ts` or React Query hooks under `src/data/`) that reads/writes the real tables (`materials`, `transactions`, `tools`, `trucks`, `truck_logs`, `truck_tasks`, `task_completions`, `points_events`, `streaks`, `sites`, `services`, `profiles`).
- Use **React Query** (already a dependency) for server cache + optimistic updates. Keep the existing optimistic feel for crew logging.
- Provide a single switch: if Supabase is configured → use the repo; else → use the in-memory/localStorage seed. Do not fork the UI components; inject the data source.

**Seeding the real DB**
- `supabase/seed/seed.sql` currently only inserts `services`. Generate real INSERTs (or a `scripts/seed.ts` using the service-role key) that load the full catalogue from `src/data/seed.ts` (45 materials, tools, trucks, 21 truck tasks) into Postgres. Document how demo auth users get created (Supabase Auth) and their `profiles` rows seeded with matching UUIDs and the three roles.

**Acceptance:** With env vars set, I can sign in as an Admin, a Manager, and a Crew user, and the UI permissions + data all come from Supabase. With no env vars, the localStorage demo still works.

---

## Priority 2 — Implement the two integrations (replace stubs with working code)

### QuickBooks Online (Projects → sites)
- `supabase/functions/quickbooks-oauth`: implement the real OAuth2 code exchange with Intuit — POST to the token endpoint, receive access/refresh tokens + `realmId`, and **persist them** to `integration_connections` (provider = `quickbooks`). Store tokens encrypted or at least in a service-role-only table (RLS already restricts to admin). Validate the `state` param (CSRF). Keep it admin-only.
- `supabase/functions/quickbooks-sync`: refresh the token if expired, call the QBO **Customer** and **Project** APIs, and **upsert `sites`** with `source='quickbooks'`, `qbo_customer_name`, `qbo_project_id`, `qbo_project_name`. **Store only customer name + job/project name — nothing else.** Make it idempotent (upsert on `qbo_project_id`). Respect the `QBO_ENVIRONMENT` (sandbox vs production) env var for base URLs.
- Wire the Admin screen "Connect QuickBooks" / sync buttons to actually invoke these and show connection status + last-synced count.

### CSV / Google Sheet material import
- `supabase/functions/materials-import`: parse the CSV properly (handle quoted fields), validate enum values (`category`, `unit`, `step`), then **upsert `materials` metadata** (name, category, unit, step, pack, units_per_pallet, cost, reorder_point, bin). **Never overwrite `qty`** — the app is the source of truth for stock on hand. Return a validation report (rows imported, rows skipped + reasons).
- Add a real file-upload UI in the Admin screen (admin-only) that POSTs the CSV and renders the report. Support re-running (idempotent upsert keyed on a stable column — e.g. name or an external SKU if present in the sheet).
- Map columns from the actual data file in the repo root (`Waterproofing-Plus-Data-Warehouse-Wizard.xlsx`) — export/inspect its column names and map them; don't assume the prototype's shape.

**Acceptance:** An admin can connect QBO and pull jobs (customer + project name only), and can upload the materials CSV to upsert the catalogue without clobbering stock levels.

---

## Priority 3 — Make offline real, or remove the claim

Currently `submitTransactions` writes to state immediately **and** conditionally appends to `offlineQueue`, which is never drained. Choose one:

**Preferred — make it real:**
- When offline, queue the write (don't hit Supabase), keep the optimistic local update, and **drain the queue on reconnect** (`window.addEventListener('online', …)`) by replaying queued commands to Supabase in order, then clearing them. De-duplicate by command `id`. Surface a small "N pending sync" indicator.
- Add a test for queue-drain (enqueue while offline → flush on online → queue empty, server called).

**Otherwise:** remove the `offlineQueue` code and the "offline-tolerant" wording from the README so the app doesn't claim a capability it lacks.

---

## Priority 4 — Restore prototype feature parity (currently placeholders)

Bring these back to match `waterproofing-plus_6.html` behavior:

- **End-of-day truck log** (`Trucks` tab): replace the hardcoded `km + 42` with a real form — truck select, odometer KM, driver, job site, service, oil-checked, fuel-topped, repairs note. On save: insert a `truck_logs` row, update the truck's `km` (only if higher) and `last_oil`, and **auto-complete the matching daily vehicle tasks** (record-KM, oil-check, fuel-top-up), then re-run the points evaluation.
- **Tool checkout**: replace the hardcoded `sites[0]` with a **job + service picker** (both required, matching the prototype). Add damage/repair **note** capture and show **battery charge state** (never / charged / charge-soon ≥1d / charge-due ≥2d) on tool rows and the detail sheet.
- **Log flow**: remove the `.slice(0, 12)` cap (search should reach all materials), allow removing a line, and show each line in its locked unit. Add the "＋ Add job site" path from the prototype.
- **Add material form**: capture the full set of fields (category, locked unit, step, pack, units/pallet, cost, on-hand, reorder, bin), not just the name.
- **Reorder PO** and **cost report**: implement the printable cost report → **Save as PDF** (port the prototype's print template with period + site filters), in addition to the existing CSV copy. Keep the PO estimate but add the per-item review sheet.
- **Edit task list** button: make it functional (add/edit/delete `truck_tasks` with text/service/freq), admin/manager only.
- **Nav icons**: restore the prototype's SVG tab icons instead of single letters.

Keep all of these behind the correct role gates (crew can log/checkout/complete tasks; only manager/admin edit master data).

---

## Priority 5 — Fix the `adjust` semantics bug

The client model treats `adjust` as **"set exact count"** (a delta to reach a target), but the DB trigger `apply_stock_transaction()` applies `adjust` as `+abs(qty)`. These diverge and will corrupt counts once writes go through Postgres.

Pick one consistent model and apply it in **both** the trigger and the client:
- **Recommended:** make `adjust` carry a **signed delta** (the difference), and have the trigger add it as-is (not `abs`). The "set exact count" UI computes `delta = newCount − currentQty` and logs that. This keeps the ledger auditable (every row is a real movement).
- Update `signedQuantity`, the trigger, and tests to match. Add a test: set-exact-count from 6 → 4 produces a −2 movement and lands at 4.

---

## Cross-cutting requirements

- **Don't regress:** `npm run build` and `npm test` must stay green. Add tests for: queue drain, truck-log auto-task-completion, adjust/set-exact-count, and CSV import validation.
- **Secrets** stay server-side (Edge Functions); never expose service-role key or QBO secret to the browser.
- **RLS review:** confirm crew cannot insert `receive`/`adjust` transactions and cannot write master data; managers can; only admins touch `integration_connections` and roles. Add a note in the README of the final matrix.
- **README:** update to reflect what is now actually implemented vs still stubbed, the DB seeding steps, the QBO connect flow, the import flow, and the corrected offline behavior. Remove any claim the code doesn't back.
- Leave the 5 transitive `npm audit` findings alone unless a fix is non-breaking.

## Suggested order
1. Supabase client + auth + repo/React-Query data layer + DB seed (P1).
2. `adjust` semantics fix (P5 — small, do it before real writes go live).
3. QBO OAuth + sync, then CSV import (P2).
4. Truck-log form + tool checkout + log-flow parity + PDF report + edit-tasks (P4).
5. Real offline queue drain + tests (P3).

Start with Priority 1. Confirm the auth approach (password vs magic link) and the final role matrix if anything is ambiguous; otherwise proceed with sensible defaults.
