# Crew+

Van Isle Water Proofing+ People & Performance app. Crew+ owns the shared points wallet, leaderboard, rewards catalog, redemptions, values/rituals, reviews, KPIs, bonus trajectory, compliance roster, feedback, and recognition.

## Run

```powershell
cd "D:\project\Canada\cross platform\Crew+ Waterproofing Team Tool"
npm install
npm run dev
```

Dev URL:

```text
http://localhost:5175/
```

Production-style preview:

```powershell
npm run build
npm run preview -- --host 127.0.0.1 --port 4175
```

Ngrok for Crew+:

```powershell
cd "D:\project\Canada\cross platform"
.\ngrok.exe http --url=matrix-demote-ripcord.ngrok-free.dev 127.0.0.1:4175
```

## Shared Supabase Setup

Crew+ uses the same Supabase project as Warehouse Wizard and SOP+.

Migration order matters:

1. Apply Warehouse Wizard migration first. It creates `profiles`, `points_events`, and `points_event_type`.
2. Apply Warehouse Wizard `202607280003_points_unification.sql`. It installs the canonical points enum/policy updates.
3. Apply SOP+ migration if SOP+ is part of the shared suite.
4. Apply `supabase/migrations/202607280002_crew_plus_schema.sql`.
5. Apply `supabase/seed/seed.sql`, or run the service-role seed script below.
6. Deploy exactly one `award-points`: `../Waterproofing+ Warehouse Wizard/supabase/functions/award-points`.

Env:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
CREW_PROFILE_MAP_JSON=
```

Without Vite Supabase env vars, Crew+ runs in localStorage demo mode.

## Data-Intake Workbook Mapping

Crew+ is aligned to `DRAFT CrewPlus-Developer-Data-Intake.xlsx`. The local demo seed and service-role seed now carry the workbook spine:

- `crew_config`: legal/display name, admin contact, timezone, Monday week start, shared login/wallet flags, brand confirmation fields, and configurable point anchor.
- `profiles`: employee id, first/last/display name, org role, department, reporting line, status, dates, birthday, phone/address, emergency contact, and admin-only pay/bonus fields.
- `crew_role_permission`: role-by-role permission matrix for bonus dollars, compensation, reviews, config, emergency contact/address, and exports.
- `crew_cert_type` + `crew_certification`: cert master validity/lead days plus per-person roster/gaps.
- `crew_value_ritual`, `crew_review_type`, `crew_rating_scale`, `crew_review_competency`, `crew_kpi`, `crew_bonus_role_weight`, `crew_form`, `crew_form_question`, `crew_integration_decision`, and `crew_nudge`.

Admin importer: open the `Admin` tab, export a workbook tab as CSV, paste it with the header row, choose the tab name, and import. The importer is idempotent and only updates metadata/config/roster/rules/catalog. It never imports or overwrites `points_events`.

Mapped importer tabs:

```text
1. Company & App Config
2. Roles & Access
3. Team Members
4. Job Descriptions
5. Certification Types
6. Certifications
7. Values & Rituals
8. Review Structure
9. Review Competencies
10. KPIs by Role
11. Bonus Program
12. Rewards - Earning
13. Rewards - Catalog
14. Nudges & Cadence
15. Forms & SWOT
16. Integrations & Tech
```

The service-role seed remains the production path for full workbook-backed metadata:

Service-role seed:

```powershell
$env:SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
$env:CREW_PROFILE_MAP_JSON='{"u1":"AUTH_UUID","u2":"AUTH_UUID","u3":"AUTH_UUID"}'
npm run seed:supabase
```

`CREW_PROFILE_MAP_JSON` maps the 15 local demo roster ids (`u1`-`u15`) to real Supabase Auth user ids. At minimum provide `u1`, `u2`, and `u3`; unmapped crew demo records are skipped for profile upsert and dependent rows fall back to `u3`.

## Points Wallet

Balances are derived only from the append-only shared `points_events` ledger:

```text
balance = positive earns - negative redeem events
```

Crew+ earning and redemption events use the canonical idempotent `award-points` function with a unique `{ type, ref }` guard. The client sends only context:

```json
{ "kind": "crew_rule", "crewMemberId": "AUTH_UUID", "ruleKey": "earn-daily", "ref": "ritual:AUTH_UUID:v1:daily:2026-W31", "weekKey": "2026-W31" }
```

The Edge Function ignores any client-supplied point amount, looks up `crew_earning_rule`, enforces self-vs-manager authorization, clamps weekly habit points server-side, and writes the ledger event with the server-approved value. Redemptions use `kind: "redeem"` and require admin/HR approval.

There must be exactly one deployed Supabase function named `award-points`. Crew+ keeps a matching copy only so deploying from this folder does not clobber the canonical implementation with an older one.

Rewards show the configured anchor from the intake workbook:

```text
1 point = $0.25 implied value
```

Confirmed client decision: Crew+ now uses `$0.25/point`. The reward catalog is limited to Cash, Gift Card, and PTO denominations, priced so `$50 ~= 200 points`, `$100 ~= 400 points`, and PTO is priced at the same anchor. Redemptions are quarter-end only: January 31, April 30, July 31, and October 31. Points roll over and wallet balances do not reset; only the quarterly leaderboard can reset.

Current point table:

```text
Perfect daily truck-task day: +25
5-day truck-task streak: +25
Approved SOP: +20
5-star Google review naming crew member: +200
Weekly Monday 6:30am value-share: +5
Certification details completed: +5
Safety milestone: +5
Peer recognition received: +5
Feedback, KPI hit, review on time, certs current, SWOT, written compliment: +5 each (TODO confirm)
```

Weekly cap note: the client confirmed there is no weekly cap on points. Habit and ritual earning is uncapped; idempotency still prevents duplicate awards for the same `(type, ref)`.

Pending value confirmation: small-tier actions remain at `+5` while the client decides between `+5` and `+10`.

Google review URL is stored in `crew_config.google_review_url`:

```text
https://www.google.com/maps/place//data=!4m3!3m2!1s0x548f6b3774eb6afd:0xbd3374f825d460ba!12e1?source=g.page.m._&laa=merchant-review-solicitation
```

One-time seeded Google review awards were added for Jesse Dares, Jon Gregoire, and Jordan Thorpe. V2 adds distinct July 30 Google review seed credits for Jon Gregoire and Jordan Thorpe, bringing both to 400 Google-review points while Jesse remains at 200.

Brand confirmation needed: the intake proposes `#1C5CAB` / `#12A37A`, but the suite keeps the official Van Isle brand `#14A2A4` / `#1C1E20` until the client signs off.

## V2 Decisions And TODO_CONFIRM

- Values are now `Clear`, `Helpful`, and `Professional`; the weekly value-share is the primary ritual.
- Certifications now carry course date, expiry date, certificate number, and a private `crew-cert-media` storage key/photo reference.
- TODO_CONFIRM: cert-detail points are awarded per completed certification record, not per field.
- TODO_CONFIRM: Logan Pardy has no certs on file in the V2 intake; confirm this is a real compliance gap.
- TODO_CONFIRM: decide whether to keep any light daily value prompt; seed keeps only the weekly ritual.
- Bonus model now uses gross annual wages and a 1-5 average review score: 3 up to 2%, 4 up to 4%, 5 up to 6%, below 3 not eligible.
- TODO_CONFIRM: gross annual wages are blank placeholders until payroll/Admin confirms them.
- Quarterly check-ins are coaching only; annual bonus average derives from the year's quarterly Overall Ratings.
- TODO_CONFIRM: confirm whether the client wants a separate annual review score in addition to the quarterly average.
- TODO_CONFIRM: quarterly scorecard core-value checkboxes use Accountability, Professionalism, Respect, Teamwork, Continuous Improvement, which differs from the new three brand values.

## V4 Client Updates

- Target launch: August 15, 2026.
- Crew members maintain their own current address and emergency contact from the Profile screen.
- Crew members can add certifications and record course date, expiry date, certificate number, and certificate photo/PDF evidence.
- Quarterly SWOT is a fillable self-service form with a 500-word maximum for each category. Deadlines are March 31, June 30, September 30, and December 31.
- The Workplace Bullying and Harassment Policy Statement is bundled in the portal. Every crew member must read and electronically acknowledge it annually by August 31, beginning in 2026.
- Crew reviews use Below / Meets / Exceeds. Office roles retain the optional 1-5 scale.
- QuickBooks Online authorization remains a go-live action requiring a client admin for about five minutes; only in-progress customer and job names are in scope.

## V5 Client Updates

- Crew+ tracks 5 paid sick days and 3 unpaid sick days per calendar year for each eligible crew member.
- Eligibility begins after 90 consecutive calendar days with the company and applies to full-time, part-time, temporary, and casual workers.
- Sick and vacation usage is stored as dated entries, so January 1 renewal creates a clean annual balance without deleting prior-year history.
- Vacation allowance is configurable per employee. Vacation balance reminders are prepared for email and text; sick-day usage reminders are intentionally disabled.
- V5 keeps the August 31 annual bullying/harassment acknowledgment and quarterly SWOT requirements from V4.

## Privacy

Bonus dollars are admin/CFO-only. Non-admin/CFO users see only green/amber/red trajectory. The migration restricts bonus config/period reads through RLS to admin profiles whose `org_role` is `CFO` or `Operations`.

## V1 Scope

- Values and daily/weekly/monthly rituals.
- Review cadence: 30/60/90, quarterly, annual.
- KPI scaffold by role with blank editable targets.
- Profit-funded bonus scorecard scaffold.
- Real compliance roster and renewal/gap alerts.
- Shared wallet and leaderboard.
- Rewards catalog and redemption approval flow.
- Recognition and customer feedback points scaffold.

V2 remains out of scope: automated Google review scraping, payroll integration, profit import automation, native push beyond the suite channel, and deep analytics.

Still needs final client numbers before production payroll use: KPI targets, bonus percent/weights/rating factors, exact cert expiry dates where marked "date needed", brand hex confirmation, and final reward catalog reconciliation against the point anchor.
