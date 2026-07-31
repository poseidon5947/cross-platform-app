# Codex Prompt — Apply client V2 build items (units, price flag, certs, values, Google, bonus)

> Cross-app change. Mainly `Crew+ Waterproofing Team Tool` and `Waterproofing+ Warehouse Wizard`; the canonical `award-points` function must stay byte-identical across all three apps. Keep every app's `npm run build` and `npm test` green; update/add tests for changed logic. These are confirmed client decisions from the V2 intake doc + their bonus program PDF.
>
> **Two items are client-pending — do NOT guess; implement with a sensible default and a clearly-marked `TODO_CONFIRM`:** (a) exact unit remapping for the existing catalogue, and (b) the bonus 1–5-vs-3-tier review-scale reconciliation. Both are called out inline.

---

## A. Warehouse Wizard

### A1. Restrict material units to 5 options
The locked unit for a material may now only be one of: **Unit, Roll, Drum, Box, Sausage**.
- Update the add/edit material form's unit selector to these 5 only.
- Update the CSV importer to **validate** unit against these 5; rows with any other unit are reported as skipped-with-reason (so the client sees what to fix in the sheet), not silently accepted.
- **Quarter-step:** apply `step 0.25` (allows .25/.5/.75) to **Drum** (this replaces the old barrel/gallon quarter logic). All other units default to whole steps (`1`). `// TODO_CONFIRM`: rolls were previously half-step (0.5) — flag in README whether Roll should keep 0.5 or move to whole.
- **Existing seed catalogue remap (provisional):** the 121 seeded items use non-conforming units (pail, tube, panel, litre, gallon, barrel, board, boot, sheet, bag, etc.). Remap each to one of the 5 with this documented default, and mark it provisional (real units arrive in the client's Aug 5 sheet):
  - barrel / gallon / litre / pail / jug / can / tank → **Drum**
  - roll → **Roll**
  - box / case → **Box**
  - tube / sausage → **Sausage**
  - everything else (each / unit / panel / board / boot / sheet / bag / cup / lb …) → **Unit**
  Add a `// TODO_CONFIRM: provisional unit mapping — client sets real units in the Aug 5 sheet` note in the seed.

### A2. Price-increase flag
The client wants the Crew Lead alerted when a product gets more expensive.
- Track cost changes: when a material's `cost` changes (via CSV import or edit) to a **higher** value, record the previous cost and the change timestamp (e.g. add `previousCost` / `priceChangedAt`, or a small cost-history).
- Surface it: a **"price up" badge** on the material row (old → new, e.g. "▲ $8.67 → $9.20") and a **"Price increases" list** in the Home/Admin reports area so the Crew Lead can review items that rose in price and reconsider quantities/suppliers.
- Only flag increases (not decreases). Clear/'age out' the flag on demand or after it's acknowledged (keep simple — a visible flag is enough for v1).

---

## B. Crew+ — Certifications

### B1. New cert fields + photo upload + points
- Add to each certification: **course date** (when last taken), **expiry date**, **certificate number**, and a **photo upload of the hard-copy certificate** (store in Supabase Storage like SOP+ media — a private `crew-cert-media` bucket; keep only storage keys/URLs in Postgres).
- Crew members enter these for their own certs; the 60/30/7-day renewal alerts fire once an expiry date exists (already built — keep).
- **Award +5 points per certification completed** (all key details filled — dates + cert #): a new earning rule routed through the canonical `award-points` path. Add a rule `earn-cert-detail` (+5, self-serve) and a new event type (e.g. `crew_cert_detail`); add the enum value to the shared `points_event_type` via `alter type ... add value if not exists`, and keep all three `award-points` copies byte-identical. Idempotent per cert (`ref = cert_detail:{userId}:{certId}`) so it awards once. `// TODO_CONFIRM`: whether +5 is per completed cert record (assumed) or per individual field — default to per-cert-record and note it.

### B2. Load the real cert roster (from V2)
Seed each person's certs (dates blank — entered in-app). Match by name to the existing Crew+ profiles; don't hardcode ids blindly:
- **Jesse** — WHMIS, Hearing, Level 1 First Aid, Fit Test, Lift
- **Shane** — Lift Operation
- **Jon** — Lift Operation, Level 1 First Aid, Fit Test, Confined Spaces
- **Josh** — Confined Spaces
- **Logan** — *none on file* (leave empty; `// TODO_CONFIRM` with client whether this is a real gap)
- **Thorpe** (Jordan Thorpe) — Lift Operation, Level 1 First Aid, Fit Test, Confined Spaces
- **Rogers** (Jordan Rogers) — Level 1 First Aid, Fit Test

---

## C. Crew+ — Company values (switch to 3)

Replace the 5 seeded values with the client's real **3**, using their descriptions:
- **Clear** — "Open, straightforward communication."
- **Helpful** — "We go out of our way to solve problems and make your project easier to manage."
- **Professional** — "Reliable, safety-first work delivered to a consistently high standard, every time."

Ritual/nudge: the core ritual is a **weekly value-share** — crew get a reminder to share how they used a company value at the **Monday 6:30am crew meeting** (nudge surfaces before then; completing it awards +5). Keep it to that weekly ritual as the primary one; `// TODO_CONFIRM` in README whether to also keep a light daily value prompt (client is deciding). Remove references to the old 5 values.

---

## D. Crew+ — Google review seed credits (update)

The client updated the starting credits (Jon & Jordan Thorpe each got a second review on July 30):
- **Jesse** — 200 total (unchanged; existing seed award stays).
- **Jon** — **400 total**: add a *second* +200 award (`ref = google_seed:{jonId}:2026-07-30`, reason noting the July 30 review). Keep the original July award too.
- **Jordan Thorpe** — **400 total**: add a *second* +200 award (`ref = google_seed:{thorpeId}:2026-07-30`).
Distinct `ref` per review keeps each idempotent; two events each for Jon and Thorpe.

---

## E. Crew+ — Bonus model rework (replace the profit-pool model)

Replace the proposed "profit pool → scorecard" bonus with the client's **real** program (from their Bonus Program PDF):

**Formula:** bonus = a percentage of the employee's **gross annual wages**, where the % is driven by their **average annual review score (1–5)**, "up to" the cap (actual % is discretionary within the cap):
- Average score **3 (Meets)** → up to **2%**
- Average score **4 (Exceeds)** → up to **4%**
- Average score **5 (Exceptional)** → up to **6%**
- Below 3 → 0% / not eligible (discretionary).

**Eligibility gates (all required):**
- ≥ 6 months continuous employment
- Participated in ≥ 2 quarterly reviews
- Actively employed at time of payout
- Not under notice of resignation/termination
- No verbal/written disciplinary action in the last 3 months
- Partial-period eligibility not permitted

**Timing:** annual reviews completed 2 weeks prior; payout on the payroll period closest to **Dec 25**; decisions final once communicated; discretionary (not an entitlement).

**Implementation:**
- Rework the bonus config + `bonusTrajectory`/`estimatedBonusDollars` logic to this model. Keep the **dollar figures admin/CFO-only** (preserve the existing `canSeeBonusDollars` gating + RLS); everyone else sees a **green/amber/red trajectory** toward the next threshold.
- **Gross annual wages per employee:** add an admin/CFO-only field on the profile/bonus config. The client hasn't provided wages yet — leave blank/placeholder; compute dollars only when present, otherwise show the % band + trajectory. Flag as pending client data.
- Add the **Employee Performance Scorecard** as the annual review form: 1–5 rating with the client's definitions (1 Unsatisfactory … 5 Exceptional) and header fields (employee, role, review period, reviewer, date).
- **Score scale — RESOLVED (was a TODO):** the client clarified that **quarterly reviews are check-ins with NO payout**, and the **bonus is a separate annual analysis** of whether they get a % payout at fiscal-year end. Both use **1–5** (the old "3-tier for crew" is superseded — everything is 1–5 now). The bonus's **eligibility requires the employee participated in ≥2 quarterly reviews**, and the bonus average is derived from the year's quarterly-review Overall Ratings (see §F). Default: the admin confirms/derives the annual average from the completed quarterly reviews; flag in README if the client wants a fully-separate annual review instead.
- Update the eligibility check and the seed bonus config accordingly; seed the 2026 bonus period. Keep bonus **annual/discretionary**, dollars **admin/CFO-only**.

---

## F. Crew+ — Quarterly Review Scorecard (new module; separate from the bonus)

The client sent their full quarterly scorecard. **Quarterly reviews are coaching check-ins — no financial payout** (that's the bonus). Build this as the quarterly review form in Crew+.

**Cadence & eligibility:**
- Each employee has their **own quarter cycle** (based on hire date) — the client provides per-person **Next Quarterly Review** dates. Seed the ones given below; leave others blank for the client to set.
- Admin is **reminded to do the review with the employee within 2 weeks of the quarter ending**, and to set the next review date (reminder ~2 weeks before it). Wire this into the nudge engine.
- Eligibility: ≥3 months continuous employment, not under notice, no disciplinary action in last 3 months. Some crew are **"Not Eligible"** (under 3 months) — reflect that status.

**Field-level visibility (build permissions from the scorecard's color code):**
- **Admin-only (do not show employee):** Review Job Description ratings, Living Our Core Values, Career Development, Feedback for Management, Manager Summary.
- **Employee-visible anytime:** Company Support, KPI Review, Workmanship Review, Strengths, Opportunities for Improvement, Quarterly Goals, Overall Rating, Employee Comments.
- **Both:** the Check-In and Discussion.

**Sections to build (all ratings 1–5 unless noted):**
1. **Employee Check-In** — "How are things going?" (Excellent / Good / Fair / Struggling) + discussion prompts.
2. **Company Support** (employee-facing) — rate 1–5: have the tools I need · clear instructions · understand what success looks like · communication is good · feel respected. + comments.
3. **Review Job Description** (admin-only) — rate 1–5 each: arrives prepared/on time · prepares truck correctly · protects customer property · completes waterproofing to standard · completes paperwork daily · cleans site before leaving · maintains tools/equipment · represents company professionally.
4. **KPI Review** — KPI / Target / Actual / Rating, seeded with the real crew targets: **Attendance 100% · Daily paperwork 100% · Safety violations Zero · Customer complaints Zero · Rework under target · Vehicle inspections weekly · Training completed Yes.** (These are the real crew KPI targets — use them for the crew role; per-role office targets still come later.)
5. **Workmanship Review** — rate: attention to detail · waterproofing quality · caulking quality · protection of finished work · organization · productivity · following SOPs · pride in workmanship. + manager & employee comments.
6. **Living Our Core Values** (admin-only) — checkboxes: Accountability · Professionalism · Respect · Teamwork · Continuous Improvement, with examples. `// TODO_CONFIRM`: these five differ from the 3 brand values (Clear/Helpful/Professional) from §C — flag the discrepancy; build the scorecard's list as-is but note it.
7. **Strengths** — top 3 + "what do you do best?"
8. **Opportunities for Improvement** — 1–2 highest-impact.
9. **Career Development** (admin-only) — what would you like to learn · where next year.
10. **Feedback for Management** (admin-only) — what slows you down · wastes time · make job easier · equipment needed · SOPs to improve · if you owned the company what would you change.
11. **Quarterly Goals** — 3 goals.
12. **Overall Summary** — Manager Summary (admin-only): what went well / needs improvement.
13. **Overall Rating (1–5)** — Developing · Meets Expectations · Strong Performer · Exceeds Expectations · Ready for More Responsibility. (This is the score that feeds the annual bonus average.)
14. **Employee Comments**, Current Review Date, Manager & Employee signatures, Next Review Date.

**Roster + review dates to seed** (⚠️ includes a NEW member — **Ken Taylor** — not previously in Crew+; add him). Match by name/email to existing profiles; add Ken:
- Jordan Rogers (Admin) — Sept 30 · Tara Clark (Admin) — Sept 30 · Jesse Dares (Manager) — July 31 · Jonathan Gregoire (Crew) — Sept 30 · Jordan Thorpe (Crew) — Sept 30 · Joshua Murray (Crew) — *tbd* · Logan Pardy (Crew) — July 31 · Matthew Chester (Manager) — July 31 · Bobby Wagner (Crew) — July 31 · Ray Boudreault (Crew) — July 31 · Shane Smith (Crew) — Sept 30 · **Desmond Scott, Jacob V, Ken Taylor (Crew) — Not Eligible.**

This partially answers **B1 KPI targets** for the crew role (the KPI Review targets above). Per-role office KPI targets still come from the client later.

---

## Cross-cutting

- **Canonical `award-points`:** any new event types (`crew_cert_detail`, etc.) added to the shared enum via `alter type ... add value if not exists`; all three `award-points/index.ts` copies stay **byte-identical** (verify SHA-256). New self-serve rules follow the existing self/manager authorization + idempotency model.
- **Do NOT change** confirmed values: base +5, perfect day 25, streak 25, SOP 20, Google 200, $0.25 anchor, no weekly cap, quarterly redemption windows.
- **Tests:** update/add for the 5-unit restriction + Drum quarter-step, price-increase flag, cert +5 award (idempotent), the new bonus formula (score band → %, eligibility gates), and the Google double-award refs. Keep all existing tests green (adjust only numbers/data that legitimately changed).
- **READMEs:** record the 5 allowed units + provisional remap, price-increase flag, cert fields/photo/+5, the 3 values + Monday ritual, updated Google credits, the new bonus model, and the new quarterly review scorecard (with its field visibility) — plus the flagged TODO_CONFIRMs (unit remap, Roll step, cert-detail granularity, Logan certs, daily-value prompt, pending gross wages, quarterly-avg-vs-separate-annual review, and the core-values list discrepancy).

## Suggested order
1. WW: 5-unit restriction + Drum quarter-step + provisional remap; price-increase flag.
2. Crew+: cert fields + photo + `earn-cert-detail` +5 (canonical fn + enum) + real roster (incl. Ken Taylor).
3. Crew+: values → 3 + Monday ritual.
4. Crew+: Google seed credit bump (Jon/Thorpe → 400).
5. Crew+: quarterly review scorecard module (§F) with field-level visibility + seeded KPI targets + review dates.
6. Crew+: annual bonus model rework + 1–5 scorecard + wages field (draws avg from quarterly reviews).
7. Enum/award-points sync, tests, READMEs, TODO flags.

Proceed with these defaults; leave every `TODO_CONFIRM` clearly marked rather than guessing.
