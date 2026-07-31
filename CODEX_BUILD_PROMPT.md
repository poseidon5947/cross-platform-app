# Codex Build Prompt — "Warehouse Wizard" (Waterproofing+ Warehouse & Crew Ops)

> Paste everything below this line into Codex as the task brief. It is written to be self-contained.

---

## 0. Role & mission

You are a senior full-stack engineer. Build a **production-ready, responsive web application** ("Warehouse Wizard") for a below-grade **waterproofing contractor**. It is an **internal company tool** — a mobile-first responsive web dashboard (installable PWA), **not** a native iOS/Android app.

The app already has a working single-file HTML prototype (`waterproofing-plus_6.html`) whose **visual design and layout must be preserved**. Your job is to turn that prototype into a real, multi-user, database-backed application with authentication, roles, live QuickBooks data, data import, and a points/gamification system that will later sync to a separate HR ("PEOPLE") platform.

**Design priority (client's words):** "My priority is keeping the prototype's design rather than rebuilding in a generic tool." The prototype is "a bit clunky, but some of the layout is good." Keep the look and feel; clean up the clunky parts; do **not** restyle into a generic admin template.

---

## 1. Product context

- **Company:** Waterproofing contractor (Victoria/BC, Canada — currency CAD, GST 5%, timezone America/Vancouver).
- **Users:** Warehouse manager + field crews running trucks daily.
- **Core jobs-to-be-done right now (in priority order):**
  1. **Inventory tracking** — materials with locked logging units, reorder thresholds, stock movements.
  2. **Tools / equipment management** — check in/out, condition, battery charge tracking.
  3. **Truck tasks** — daily/weekly/monthly checklists per service + end-of-day truck logs (KM, oil, fuel).
  4. **Gamification / points** — crew earn points for completing daily tasks correctly and on time. **This is essential**, not optional.
- **Explicitly deferred to a later iteration:** purchase-order / order history import. Build the schema to accommodate it, but do not implement it now.

---

## 2. Confirmed decisions from the client (authoritative — override any conflicting assumption)

1. **Platform:** Responsive web dashboard (PWA). No native app store submission. Reason: lower cost, fewer hurdles, and it would be public if it were an app store app — they want it internal.
2. **Roles:** Three roles — **Admin**, **Manager**, **Crew**. (The prototype only has a "who's on the truck" switcher; replace that with real authentication + role-based access.)
3. **Accounting integration:** **QuickBooks Online (QBO)**. Jobs are set up as **QBO Projects**. Pull **only the customer name and job/project name** — no financial or other details. An admin will authorize the OAuth connection when the connect flow is ready.
4. **Initial data:** A Google Sheet supplies all starting data (materials, etc.). Sheet is ~80% finalized. Ongoing additions happen in the **admin dashboard**, not the sheet. Google Sheet:
   `https://docs.google.com/spreadsheets/d/1EKxNsSK7GyZ3OYhTupU9XLWnv9tgj79SoyFF-jE0Ck0/edit`
   Build a **one-time / re-runnable importer** (CSV upload from the sheet, or Sheets API) that maps sheet rows to the materials schema. Do not depend on the live sheet as the runtime source of truth — stock levels are only updated inside the app.
5. **Points sync (future):** The points crew earn here must be **exportable/consumable by a separate future "PEOPLE"/HR platform ("Warehouse Wizard App" family).** Emit points as durable, queryable **events** (append-only ledger + webhook/API) so the HR tool can read them. Do not hard-wire it now; design the seam.
6. **BuilderTrend:** The original brief mentioned BuilderTrend OR QuickBooks. Client confirmed **QuickBooks Online**. Keep the BuilderTrend export as a stubbed/optional CSV/PDF path only.

---

## 3. Recommended tech stack (use unless you have a strong reason)

- **Frontend:** React + TypeScript + Vite, mobile-first, installable **PWA** (service worker + manifest, offline-tolerant for logging). Preserve the prototype's CSS design tokens (see §5).
- **Styling:** Port the prototype's existing CSS variables/components as-is (CSS modules or Tailwind with the exact token values). Do **not** swap in a component library that changes the visual language.
- **Backend + DB + Auth:** **Supabase** (Postgres + Auth + Row-Level Security + Edge Functions + Storage). RLS enforces the three roles. If you prefer, Node/Express + Postgres + a JWT auth provider is acceptable — but you must still deliver role-based access, an events ledger, and the integrations.
- **Server-side integrations** (never expose secrets to the browser):
  - QuickBooks Online OAuth2 (Intuit) — token exchange + refresh stored server-side; endpoint to sync Customers/Projects.
  - Google Sheets importer (service account or CSV upload endpoint).
- **State:** React Query (server cache) + local optimistic updates for fast crew logging.
- **Hosting:** Vercel/Netlify (frontend) + Supabase (backend), or a single container. Document env vars in `.env.example`.

If you diverge from this stack, state why in the README and keep every capability in §2 intact.

---

## 4. Roles & permissions (Admin / Manager / Crew)

Implement real auth (email+password or magic link) and enforce per-role access with server-side rules (RLS or middleware), not just UI hiding.

| Capability | Admin | Manager | Crew |
|---|---|---|---|
| Log material usage/delivery/loss/return | ✅ | ✅ | ✅ |
| Adjust exact stock counts / receive stock | ✅ | ✅ | ⛔ |
| Add/edit/delete materials, tools, sites, tasks | ✅ | ✅ | ⛔ |
| Check tools in/out, report damage, mark charged | ✅ | ✅ | ✅ |
| Complete truck tasks, submit truck logs, earn points | ✅ | ✅ | ✅ |
| View leaderboard & activity | ✅ | ✅ | ✅ |
| Manage users/roles, import data, connect QuickBooks | ✅ | ⛔ | ⛔ |
| Run cost reports / exports | ✅ | ✅ | ⛔ |

> Confirm the exact matrix with the client where noted, but ship this as the sensible default. A crew member should be able to log activity and earn points; only Admin/Manager change master data; only Admin touches integrations and user management.

---

## 5. Preserve the design — port these exact tokens & components

Reuse the prototype's design system verbatim. Key CSS variables:

```
--bg:#0e1726; --surface:#ffffff; --surface-2:#f4f7fb; --surface-3:#e9eef5;
--ink:#132135; --ink-2:#5a6b82; --ink-3:#8a99ad; --line:#e2e8f1;
--primary:#0b6ea8 (water blue); --primary-d:#0b3d61 (deep below-grade);
--accent:#12b3a6 (teal); --good:#1f9d63; --warn:#c9820a; --bad:#d0453b; --purple:#6b57d4;
--radius:16px; shadows as defined.
```

Components to carry over: sticky gradient header (deep→water blue), 5-tab bottom nav (Home / Inventory / Tools / Trucks / Crew), KPI grid cards, category "chips" filter row, inventory rows with stock bar + status pill, bottom-sheet modals with drag grip, segmented controls, progress ring for task completion, leaderboard rows, toast, confetti on 100% completion, and the floating action button ("Submit log"). Layout container maxes at ~480px on phones but the shell must be fully **responsive up to desktop** (widen to multi-column on larger screens for the admin dashboard).

Keep it mobile-first for crew; give Admin/Manager a wider desktop dashboard layout for master-data management, imports, and reports.

---

## 6. Data model (derive schema from the prototype, normalized for Postgres)

Create these tables. Types are illustrative — refine as needed. Add `id (uuid)`, `created_at`, `updated_at`, and appropriate FKs and indexes to all.

### `materials`
Locked-unit inventory items.
- `name`, `category` (enum: waterproofing, drainage, caulking, insulation, crack_injection, traffic_coatings, termination_fasteners, consumables)
- `unit` (the ONE locked unit crew log in, e.g. barrel/roll/pail/tube/sausage/board/each/litre/gallon/lb/bag/tank…)
- `step` (0.5 allows halves, else 1)
- `pack` (free text: how it's bought, e.g. "15/case · 4/pallet")
- `units_per_pallet` (int, for pallet-based reorder estimate), `cost` (numeric CAD per unit)
- `qty` (on hand, numeric), `reorder_point` (numeric), `bin` (storage location)
- **Rule:** crew can only log a material in its locked `unit`. Stock status: `qty<=0`=Out, `qty<reorder`=Reorder, `qty<=reorder*1.15`=Low, else OK.

### `sites` (jobs)
- `name`, `address`, `qbo_customer_name`, `qbo_project_id`, `qbo_project_name`, `source` (manual | quickbooks)
- Synced from QuickBooks Projects (customer + job name only) and/or added manually.

### `services`
- Fixed set: Waterproofing, Insulation, Crack Injection, Traffic Coatings, Vehicle/General. Used to tag tools, tasks, and logs.

### `users` / `crew`
- `name`, `email`, `role` (admin|manager|crew), `color`, `points` (denormalized total; source of truth is the points ledger — see §9).

### `transactions` (stock ledger — append-only)
- `material_id`, `qty`, `type` (use | deliver | loss | receive | return | adjust), `site_id`, `service_id`, `user_id`, `note`, `ts`.
- Sign map: use/deliver/loss = −, receive/return = +, adjust = 0 (records delta). Every stock change writes one row; `qty` on `materials` is updated transactionally.

### `tools`
- `name`, `service_id`, `battery` (bool), `status` (in|out), `condition` (good|repair|damaged), `last_charged` (timestamp | null), `note`, and when out: `out_by (user)`, `out_job (site)`, `out_service`, `out_ts`.
- Battery charge state: never charged / charged / charge soon (≥1 day) / charge due (≥2 days).

### `trucks`
- `name`, `km`, `last_serviced` (date), `last_oil` (km at last oil).

### `truck_logs` (end-of-day)
- `truck_id`, `ts`, `km` (odometer), `driver (user)`, `site_id`, `service_id`, `oil_checked` (bool), `fuel_topped` (bool), `repairs` (text). Saving updates the truck's KM and auto-completes matching daily vehicle tasks.

### `truck_tasks`
- `text`, `service_id`, `freq` (daily | weekly | monthly). Global list applied to all crew.

### `task_completions`
- `user_id`, `task_id`, `period_key` (todayKey / weekKey / monthKey), `completed_at`. A task is "done" when a completion exists for the current period; it auto-resets when the period rolls over.

### `points_events` (append-only ledger — the HR-sync seam)
- `user_id`, `type` (daily_100 | streak_bonus | manual_adjust | …), `points` (int, can be negative), `reason`, `ref` (e.g. date), `ts`.
- Crew total = sum of their events. **This table (plus a read API / webhook) is what the future PEOPLE/HR app consumes.**

### `streaks`
- `user_id`, `count`, `last` (date), `awarded_on` (date).

> Seed the DB with the prototype's material catalogue, services, tools, trucks, and truck-task list so the app is demoable immediately. (The prototype `SEED` object contains ~45 real materials, 18 tools, 3 trucks, and 21 truck tasks — reuse them as seed data.)

---

## 7. Screens & features (port every one from the prototype)

### Home / Dashboard
- Streak banner when active. KPI grid: **SKUs tracked**, **Need reorder** (count below threshold), **Units out today** (used+delivered), **Losses (30d)** in $ (loss qty × cost).
- "Reorder now" card: items below threshold, "need N more", link to build reorder list.
- Tools & equipment summary (checked out, charge due, repair flags).
- "Today's truck tasks" completion ring + how many crew hit 100%.
- Recent activity feed. Reports & export card (PDF cost report, CSV, BuilderTrend stub).

### Inventory
- Search (name/bin), category chips + "Reorder" filter, rows with icon, meta (bin, reorder point, cost/unit, pack), **stock bar** colored by status, qty + status pill.
- Material detail bottom-sheet: quick actions **Receive stock** / **Record loss** / **Set exact count** / **Edit details** (role-gated), plus recent movement for that item.
- Add/edit material form (name, category, **locked logging unit**, step whole/half, pack note, bin, units/pallet, on-hand, reorder, cost).
- **Reorder PO estimate**: for each low item compute suggested qty (reorder − on hand + 20% buffer), pallet count, line cost; subtotal + GST 5% + freight estimate → total. "Copy PO to clipboard".

### Log usage (crew's most-used flow — keep it fast)
- Pick **job site** (+ add new site) and **service** (both required), pick **type** (Used / Delivered / Returned / Loss).
- Add materials to a cart with +/− steppers respecting each material's `step`; each line logs in the material's locked unit.
- Floating **Submit log** button → writes transactions, decrements/increments stock atomically, toasts confirmation. Must work optimistically and tolerate flaky connectivity.

### Tools / equipment
- Service filter chips, KPIs (checked out, charge due). Rows show status In/Out (with who/where/service when out), condition pill, battery charge state.
- Tool detail sheet: **Check out** (to job + service, as current user), **Check in**, **Mark charged**, **Report damage** / **Send to repair** (+ note), **Back in service**, edit/delete (role-gated). Add tool.

### Trucks & daily tasks
- Completion ring for current user's daily tasks + points status. Segmented Daily/Weekly/Monthly, service chips.
- Task checklist (tap to toggle; recurrence resets per period). "Mark all shown done". Edit tasks (text/service/freq, add/delete — role-gated).
- **End-of-day truck log** sheet: truck, odometer KM, driver, job, service, oil-checked, fuel-topped, repairs. Saving updates truck KM, feeds maintenance history, and auto-completes matching daily vehicle tasks (odometer→record KM, oil→oil check, fuel→top-up fuel).

### Crew & points
- Leaderboard (all-time points, today's %, 🏆 for 100%, 🔥 streak). "How points work" explainer. Manage crew members (Admin: also manage roles/users). Reset demo data (Admin only, dev/demo).

---

## 8. Points / gamification rules (essential — implement exactly)

- Completing **100% of your daily truck tasks** awards **+50 points** (once per day).
- Consecutive qualifying workdays build a **streak**; every **5-day streak** adds a **+25 bonus**.
- If a completed day is later un-completed (task unchecked), reverse the award (subtract 50, roll back streak/awarded_on) — keep the ledger consistent.
- Trigger a **confetti + toast** celebration on hitting 100%.
- Every award/reversal writes a `points_events` row. Daily tasks reset each morning (America/Vancouver); weekly/monthly reset on their cycles.
- Expose points via a stable read API and webhook so the future **PEOPLE/HR platform** can display "points earned for doing the right tasks, the right way, on time." Document this contract in the README.

---

## 9. Integrations

### QuickBooks Online (Projects → Jobs)
- Server-side OAuth2 with Intuit; store + refresh tokens securely (never in the browser).
- Admin-only "Connect QuickBooks" flow. After connect, a sync endpoint pulls **Customers and Projects**, importing **only customer name + project/job name** into `sites`. Idempotent, re-runnable. Handle sandbox vs production; make client id/secret/redirect env-configurable. Nothing else from QBO is stored.

### Google Sheet import
- Admin-only importer: upload a CSV exported from the sheet (or read via Sheets API with a service account). Map columns → `materials` schema. Validate, preview, and upsert (don't blow away app-updated stock levels — the app is the source of truth for `qty`). Re-runnable for the ~80%-finalized sheet and future top-ups.

### Reports / export
- **Cost report (printable → Save as PDF):** period + site filters, materials consumed $, losses $, cost-by-material, transaction detail — CFO-ready (port the prototype's print template).
- **CSV export** of transactions for Excel.
- **BuilderTrend:** keep only as an optional export/stub (client chose QuickBooks). Don't build a live BuilderTrend push.

---

## 10. Non-functional requirements

- **Responsive & PWA:** installable, offline-tolerant logging (queue writes, sync on reconnect), fast on a phone in a warehouse.
- **Security:** server-enforced roles (RLS/middleware), secrets server-side only, input validation, parameterized queries, auditable ledgers (transactions + points_events are append-only).
- **Timezone/locale:** America/Vancouver day boundaries for task resets & points; CAD currency; GST 5%.
- **Accessibility:** tap targets ≥44px, sufficient contrast, labels on inputs.
- **Quality:** TypeScript throughout; unit tests for stock math, reorder estimate, points/streak logic, and period-key/recurrence logic; a seed script; a README with setup, env vars, running, importing, and the points-sync contract.
- **No secrets in the repo.** Provide `.env.example`.

---

## 11. Deliverables

1. Running app (frontend + backend) with the stack above.
2. DB migrations + seed data (from the prototype catalogue).
3. Auth with Admin/Manager/Crew and enforced permissions.
4. All screens in §7 with the prototype's design preserved.
5. Points engine + `points_events` ledger + read API/webhook for the future HR app.
6. QuickBooks OAuth + Projects sync; Google Sheet importer; cost report PDF + CSV.
7. README: architecture, setup, env vars, how to import the sheet, how to connect QuickBooks, and the HR points-sync contract.
8. Tests for the critical business logic.

---

## 12. Build order (suggested)

1. Scaffold stack, port design tokens/shell, bottom nav + responsive layout.
2. DB schema + migrations + seed; auth + roles.
3. Inventory (list, detail, adjust, add/edit) + transactions ledger + stock math.
4. Log-usage cart flow (optimistic, offline-tolerant).
5. Tools management. 6. Trucks + tasks + recurrence + truck logs.
7. Points engine + ledger + leaderboard + confetti.
8. Reorder PO estimate + cost report PDF + CSV.
9. Google Sheet importer. 10. QuickBooks OAuth + Projects sync.
11. PWA polish, tests, README.

Start by confirming the stack choice and the role permission matrix (§4), then scaffold and proceed. Ask before making irreversible product decisions; otherwise use the sensible defaults above.
