# Codex Prompt — Align Crew+ to the client's Data-Intake workbook (+ build the importer)

> Working directory: `D:\project\Canada\cross platform\Crew+ Waterproofing Team Tool`.
> **Do not rebuild.** Crew+ Phase-2 (auth, repo, shared `award-points`, design system) is correct — keep it. This pass aligns Crew+'s **data model, seed, and admin importer** to the client's official intake structure so their real data drops in cleanly. Keep `npm run build` and `npm test` green; add tests for new logic.

---

## Source of truth

The client is completing a Google Sheet that is **"the crux of what needs to be logged"** for the crew dashboard. It mirrors the intake workbook already in this repo:

`Crew+ Waterproofing Team Tool/DRAFT CrewPlus-Developer-Data-Intake.xlsx` — **16 tabs**, parse it directly (unzip → `xl/worksheets/*.xml` + `sharedStrings.xml`, like the Warehouse Wizard seed did).

Treat this workbook as the authoritative shape for Crew+'s data. Many rows are the client's real data already (team, values, cert roster, earning rules, catalog); some cells are still blank (they're finishing it) — import with sensible defaults, don't choke on blanks.

---

## Two things to CONFIRM, not silently change (flag in README + a code comment)

1. **Brand colors.** The intake's Config tab proposes primary `#1C5CAB` / accent `#12A37A`. But the **official Van Isle logo-standards guide** (which the whole suite already uses) is Marine Teal `#14A2A4` / Carbon Black `#1C1E20`. **Keep the suite's existing brand (`#14A2A4`/`#1C1E20`)** for consistency with Warehouse Wizard and SOP+, and add a note flagging the intake's different hexes for the client to confirm. Do **not** switch the whole suite to the intake's colors without sign-off.
2. **Points anchor.** The intake + catalog both imply **~$0.05/point** (e.g., $50 gift card = 1,000 pts). The client verbally said **$0.25/point** in chat. Seed the anchor from the intake (`$0.05`) since it matches the catalog math, but **keep it configurable** and leave the existing in-app "reconcile with client" note. Flag the contradiction.

---

## Tab-by-tab: align the data model + seed to these

Update Crew+'s schema/types/seed (and the localStorage demo seed) to carry these fields. Where Crew+ already has a table, extend it; add tables where missing. Seed with the **real data present in the workbook**.

1. **Company & App Config** → app settings: legal name (Van-Isle Coating & Sealants Ltd.), display name (Van Isle Waterproofing+), admin (Tara Clark), timezone `Canada/Vancouver`, **week starts Monday**, `shareLogins=Yes`, `shareWallet=Yes` (confirms the shared-wallet architecture already built). Store as a `crew_config` row/table.

2. **Roles & Access** → the org has **7 roles** (Senior Technician, Technician, Assistant Technician, Crew Lead, Operations/Admin, CFO, CEO/Owner) with a granular permission matrix (View own/others, View probation, View compensation, **View bonus $**, View write-ups, Manage reviews, Edit config, Edit emergency contact/address, Export reports). Add an `org_role` + a **permission matrix** (a `crew_role_permission` table or a JSON permission map per org_role) and drive UI gating from it — supersede the coarse admin/manager/crew checks where these finer permissions apply (e.g., "View bonus $" = CFO/Ops/CEO only, already partly present via `canSeeBonusDollars`). Map each org_role → an app auth role (crew/manager/admin) for Supabase auth.

3. **Team Members** → richer `profiles` (or a `crew_member` table joined to profiles): employee id, first/last/display name, org_role, department, reports_to, status, start date, probation end date, agreement-signed date, birthday (MM-DD), email, phone, address, emergency contact (name/email/phone), and **[ADMIN]-only** pay band + bonus role weight. Seed the real 11–12 people (Jesse Dares/Crew Lead, Shane Smith/Assistant Tech, Jon Gregoire/Senior Tech, Josh Murray/Tech, Logan Pardy/Asst, Jordan Thorpe/Senior, Jordan Rogers/CEO, Tara Clark/Ops, Bobby Wagner + Ray Boudreault/Caulker, Jacob Soto/Tech). Mark admin-only columns and hide them from crew via RLS + UI.

4. **Job Descriptions** → `crew_job_description`: role, JD version, responsibility (one per row), required certifications, linked KPI(s), reports_to.

5. **Certification Types** → `crew_cert_type` (master list): type, category, issuing body, **validity (months)**, **alert lead days** (parse `"60;30;7"`), required-for-roles, notes. Seed the 8 types (WHMIS, Hearing test, Level 1 First Aid, Fit Test, Lift Operation, Confined Spaces, Fall Arrest, Manufacturer applicator).

6. **Certifications (per person)** → extend the existing compliance table with issue date, expiry date, status, certificate-scan file, notes; the **60/30/7-day alerts derive from cert-type validity + alert lead**. Seed the real roster + gaps (Jesse First Aid EXPIRED, Jesse Fit Test 2025-09-09 likely overdue, Shane only Lift, Jon First Aid expires 2028-02, etc.).

7. **Values & Rituals** → `crew_value_ritual`: value, cadence (daily/weekly/monthly), ritual/prompt text, exercise, points (30/40/60), active. Seed the 5 values × 3 cadences already in the sheet.

8. **Review Structure** → `crew_review_type`: type (Probation 30/60/90, Quarterly, Annual), applies-to, cadence, rating scale, purpose; plus the **rating-scale definition** (Below=0.7, Meets=1.0, Exceeds=1.3 performance factors — these feed the bonus).

9. **Review Competencies** → `crew_review_competency`: competency, applies-to-role(s), description, weight %. Seed the 6 listed.

10. **KPIs by Role** → align the existing KPI scaffold to columns: role, KPI name, description, unit, **target (blank)**, cadence, data source, active. Seed the proposed KPIs; leave targets blank/editable.

11. **Bonus Program** → `crew_bonus_config`: pool % (blank), payout timing (December), quarterly component (No), tenure bump, floor/cap, who-confirms (CFO), who-approves (CEO), and a **role-weights** table. Wire to the existing bonus trajectory (dollars admin/CFO-only).

12. **Rewards — Earning** → align `crew_earning_rule` to: action, points, source app, **weekly cap (per action)**, active. Seed the full table with the real per-action caps (daily ritual cap 150, weekly 80, monthly 60, clean-logging 40, tools 30, etc.). These are the values the hardened `award-points` function looks up — keep that server-side lookup working.

13. **Rewards — Catalog** → `crew_reward`: reward, point cost, approx $ value, limit/stock, active. Seed the 9 rewards.

14. **Nudges & Cadence** → `crew_nudge`: name, trigger type (cadence/date-driven), cadence/timing, audience, channel, lead time, active. Seed the 9 nudges (daily/weekly/monthly value, SWOT, feedback, birthday, anniversary, cert expiry 60/30/7, review countdown). Build the surfacing UI; actual push/email delivery can be a stub flagged for later (see Integrations).

15. **Forms & SWOT** → `crew_form` + `crew_form_question`: form, order, question text, response type (Text / Scale 1–5), required, anonymous-allowed. Seed the Quarterly SWOT (4 Qs) and Company feedback form (4 Qs, anonymous allowed). Wire the SWOT-on-time (+80) and feedback (+40) awards through the existing `award-points` path.

16. **Integrations & Tech** → record decisions: Supabase shared backend (Yes), reuse WW backend (Yes), role-based auth (Yes), offline sync (Yes), **Google Business reviews = Later (manual log day one)**, **BuilderTrend = Later**, push notifications (Yes), email digests (Yes), calendar sync (Later). Build the "Later" ones as clearly-labeled stubs; implement the manual paths now (manual 5★ review log → +200 with attribution).

---

## Build the importer (like Warehouse Wizard's)

Add an **admin-only importer** that ingests this workbook (CSV-per-tab upload, or xlsx parse), tab by tab, mapping columns → the tables above. Requirements:
- **Idempotent / re-runnable** (the client is still filling it in — they'll re-import). Upsert on stable keys (employee id, cert type, rule action, etc.).
- **Never overwrite live/computed values** — points balances and the append-only `points_events` ledger are untouched; the importer only sets config/roster/rules/catalog metadata.
- **Validation report** (imported vs skipped + reasons), like the WW CSV importer.
- Handle blank cells gracefully with the documented defaults.
- Keep the `src/data/seed.ts` demo seed in sync with the same content so demo mode shows the real structure.

---

## Constraints & acceptance
- **Don't regress** the 11 existing tests or Phase-2 logic (wallet, cap, redemption, bonus dollar-gating, cert alerts, the hardened `award-points`). Add tests for: the new permission-matrix gating, cert-alert derivation from validity + lead days, and the importer's per-tab mapping/validation.
- **Keep** the shared Supabase project, the canonical `award-points` path, and the suite design system/brand (`#14A2A4`).
- **RLS:** admin-only columns ([ADMIN] pay band, bonus weight, compensation, write-ups, bonus $) hidden from crew; crew see only their own profile/certs/points + the leaderboard.
- **README:** document the intake→schema mapping, the importer steps, and the two items awaiting client confirmation (brand hexes, $0.05 vs $0.25 anchor).
- No new dependencies beyond what the suite already uses.

## Suggested order
1. Config + Roles/permission matrix + Team profile fields (the spine) + importer scaffold.
2. Certification Types + Certifications + alert derivation.
3. Values/Rituals, Earning rules (with caps), Catalog — wire to `award-points`.
4. Reviews (structure + competencies + scale), KPIs, Bonus config + role weights.
5. Nudges, Forms/SWOT, Integrations stubs.
6. Importer per-tab mapping + validation + tests + README.

Confirm the two flagged items (brand, points anchor) if you can; otherwise proceed with the defaults above (keep suite brand; seed $0.05, keep configurable) and flag them.
