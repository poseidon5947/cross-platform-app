# Codex Build Prompt — "Crew+" (Van Isle Water Proofing+ People & Performance)

> Paste into Codex as the task brief. Self-contained. This is app #3 of the suite (Warehouse Wizard ✅ · SOP+ ✅ · **Crew+ ← you build this**). Crew+ is the app that **owns the shared points wallet and perks** the other two feed into. Match the existing suite's stack, branding, auth, and Supabase project exactly.

---

## 0. Role & mission

You are a senior full-stack engineer. Build a **production-ready, responsive web app (installable PWA)** called **Crew+** for **Van Isle Water Proofing+**, a below-grade waterproofing contractor (Victoria/BC, Canada; CAD; America/Vancouver). Crew+ is the company's **People & Performance / HR platform**: company values & rituals, performance reviews, role KPIs, a transparent profit-funded bonus scorecard, certification/compliance tracking, and — critically — the **single shared points wallet + rewards catalog** for the whole app suite.

Warehouse Wizard and SOP+ already **earn** points and write them into a shared `points_events` ledger. **Crew+ owns that ledger's user-facing side**: one balance, one company leaderboard, and all reward redemption. Crew+ also lets people earn points for HR-side actions (rituals, reviews, certs, customer reviews).

This is a sibling app — share the suite's design system, brand, auth, and Supabase project. Do not build a generic HR template.

---

## 1. Match the existing suite (do this first)

- **Stack:** React + TypeScript + Vite, mobile-first **PWA**. Same as Warehouse Wizard / SOP+.
- **Backend:** **Supabase** — **the same project** as the other two apps. Reuse the shared `profiles` table (roles) and the shared **`points_events`** append-only ledger. Reuse Storage if needed.
- **Brand:** Marine Teal `#14A2A4`, Carbon Black `#1C1E20`, White `#FFFFFF`; font **Questrial**. Port Warehouse Wizard's design system (`D:\project\Canada\cross platform\Waterproofing+ Warehouse Wizard\src\styles.css`) — reuse the same class names (cards, chips, pills, buttons, bottom-sheets, bottom nav, KPI/stat tiles, brand theme default). SOP+ already did this port; keep Crew+ consistent with both.
- **Auth:** Supabase password login + role-from-`profiles`, with a demo/localStorage fallback when env vars are absent (runnable for design review). Same pattern as Warehouse Wizard / SOP+.
- **Points award path:** when Crew+ grants points, write through the **same shared `award-points`-style Edge Function pattern** SOP+ uses (idempotent, into `points_events`). Do not create a competing balance.

---

## 2. Confirmed client decisions (authoritative)

1. **Review scale:** standardize the crew on a **3-tier scale — Below / Meets / Exceeds**. Keep an **optional 1–5 view for office roles**.
2. **Rewards anchor:** roughly **1 point ≈ $0.25** of reward value (client-confirmed). Make this a **single config constant** so it's trivially adjustable.
   - ⚠️ **Flag for the client, don't silently "fix":** the starter rewards catalog below was priced at ~$0.05/point (e.g. "$50 gift card = 1,000 pts"). At $0.25/point those same point costs imply much higher dollar values (1,000 pts = $250). Implement the anchor as configurable, show the **implied $ value next to each reward** (points × anchor), and surface a note so the client can reconcile the catalog point-costs against the $0.25 anchor. Default to what they literally confirmed ($0.25) but make the catalog point-costs editable.
3. **Rewards catalog:** the suggested rewards (team lunch, company gear, early Friday, gas/gift cards, first pick of schedule, extra paid day off, boot/tool allowance, quarterly leaderboard champion) are approved as a starting catalog — editable.
4. **Everything the client is still finalizing is editable/configurable, seeded with starter content:** KPI targets per role (blank measurables), the bonus program specifics (%/role weights/floors/caps), certification expiry dates, and the exact wording of the five values. Build the scaffolds; don't hard-code numbers.

---

## 3. Org structure & roles

12 people, two branches (map to the suite's `profiles` roles; keep permissions configurable):

- **Field:** Crew Lead ×1, Technicians ×8.
- **Office:** CFO ×1, Operations/Marketing/Accounting ×1, CEO ×1.

Role mapping / ownership:
- **Operations person = admin / HR owner** of Crew+ (manages values, reviews, KPIs, compliance, rewards catalog, user setup).
- **CFO** owns the bonus/cost side (sees dollar figures; funds the pool).
- **CEO** top of org (usually tracked, not scored).
- **Crew Lead** = field manager (runs field reviews, sees their crew).
- **Technicians / field crew** = participants (do rituals, see their points, reviews, certs, bonus trajectory).

Use the suite's three DB roles (admin | manager | crew) and layer a configurable permission map on top for the finer HR distinctions (e.g. CFO-only dollar visibility). Dollar amounts of bonuses are **admin/CFO-only**; everyone else sees trajectory, never dollars (see §7).

---

## 4. Modules (v1)

### 4.1 Values & rituals
- Seed **five starter values**, each editable (wording is the most personal part — leave it editable): **Safety First, Always · Do It Right the First Time · Own the Outcome · Leave It Better · Grow the Crew.** Each has a daily / weekly / monthly ritual and a short exercise (seed from the starter content).
- A **Cadence & Nudge engine** delivers the daily ritual to phones each morning, the weekly one as a Friday prompt, and the monthly one as a team ritual. Completing rituals **earns points** (see §6).

### 4.2 Reviews
- **Scale:** 3-tier (Below / Meets / Exceeds) for crew; optional 1–5 view for office roles (§2).
- **What each review scores:** the person's job-description responsibilities + the five values (are they living them) + their role KPIs — anchored to the role, not memory.
- **Cadence:** new hires at **30 / 60 / 90 days** (probation checkpoints); **everyone quarterly** (a light 15-minute check-in — last quarter's notes, KPI status, one win, one to work on, their quarterly SWOT); **everyone annually** (the full formal scorecard feeding the December bonus). Between reviews, managers drop lightweight feedback notes so the annual is a summary, not a scramble.
- The nudge engine counts down to each review and reminds the manager the week before. **Completing a review on time earns points.**

### 4.3 KPIs by role
- A **scaffold of 3–5 KPIs per role** (Crew Lead, Technician, Senior Technician, Operations/Marketing/Accounting, CFO, CEO), seeded from the starter content with **targets left blank/editable** (the client will supply real numbers). Track status per period; **hitting a KPI target earns points.**

### 4.4 Bonus — transparent scorecard (profit-funded, December payout)
- Model: **pool = a configurable % of annual profit** (CFO confirms). Each person's **share = role weight × performance factor**, where role weight is a fixed configurable number per role and performance factor comes from their **quarterly review ratings averaged over the year** (Below/Meets/Exceeds → e.g. 0.7 / 1.0 / 1.3, configurable), with an optional tenure bump.
- **Show progress all year:** an **"on track for bonus" indicator** (green / amber / red) each quarter, derived from review ratings — **without ever revealing dollars** to non-admins. The **dollar figure is admin/CFO-only**; everyone else sees only the trajectory.
- Keep the **December payout timing.** Make %, role weights, rating→factor mapping, and any floors/caps all **configurable** (the client will provide their real bonus program to map onto this — leave it editable).

### 4.5 Certifications / compliance
- Track each person's certifications with **issue/expiry dates** and fire **60 / 30 / 7-day renewal alerts** via the nudge engine. The single highest-value data entry is expiry dates (Fit Test and First Aid lapse most).
- **Surface gaps prominently** — the module's main value is showing what's missing. Seed the **real roster** from the starter content and flag today's issues, e.g.:
  - **Jesse** — WHMIS, Hearing, Lift (active); **Level 1 First Aid EXPIRED** (renew now); **Fit Test** last tested Sep 9 2025, annual → likely overdue.
  - **Shane** — only **Lift** on file (likely missing WHMIS / First Aid / Fit Test).
  - **Jon** — Lift, **First Aid current (exp Feb 2028)**, Fit Test, Confined Spaces.
  - **Josh** — Fall Arrest, Lift, Confined Spaces.
  - **Logan** — **NO certs on file** (full audit needed).
  - **Thorpe** — Lift, **First Aid current (exp Feb 2028)**, Fit Test, Confined Spaces.
  - **Rogers** — **First Aid current (exp Feb 2028)**, Fit Test.
  - Most certs have **no expiry recorded** — make date entry the obvious next action so alerts can fire. **Keeping all your certs current (monthly, no lapses) earns points.**

### 4.6 Rewards — the shared wallet & catalog (§6 details the economy)
- One balance, one company leaderboard, spanning all three apps. Redemption happens here. Quarterly leaderboard reset with the **wallet balance carrying over** (keeps new people in the running).

### 4.7 Feedback & recognition
- **Company feedback form** submission (earns points). **Peer recognition** (give/receive kudos; receiving earns points). **Google review QR codes:** a per-person Google review QR the crew shows customers; a **5★ Google review naming someone earns +200** (and a written customer compliment +100). (QR generation + attribution can be manual-confirm in v1.)

---

## 5. Cadence & Nudge engine
A scheduling layer that: delivers the daily/weekly/monthly value rituals; counts down to reviews (30/60/90, quarterly, annual) and reminds managers the week before; fires cert renewal alerts at 60/30/7 days; reminds people to use vacation/benefits by Dec 31. Use the suite's notification channel (in-app/push). Keep the schedule config-driven.

---

## 6. The shared point economy (the heart of Crew+)

Crew+ owns the wallet. It **reads the shared `points_events` ledger** (which already contains Warehouse Wizard truck-task points and SOP+ creation points) and **adds Crew+ earning events**, presenting **one balance + one leaderboard**. Redemptions are recorded as **negative `redeem` events** so the ledger stays append-only and auditable.

**Earning table (seed as editable config):**

| Action | Points | Source app |
|---|---|---|
| Perfect daily truck-task day | +50 | Warehouse Wizard *(exists)* |
| 5-day truck-task streak bonus | +25 | Warehouse Wizard *(exists)* |
| SOP created & approved | +20 | SOP+ *(exists)* |
| Clean material/tool logging week (no corrections) | +40 | Warehouse Wizard |
| All tools returned, none damaged (weekly) | +30 | Warehouse Wizard |
| Daily value ritual | +30 | Crew+ |
| Weekly value exercise | +40 | Crew+ |
| Monthly value ritual | +60 | Crew+ |
| Quarterly SWOT on time | +80 | Crew+ |
| Company feedback form submitted | +40 | Crew+ |
| All certs current (monthly, no lapses) | +50 | Crew+ |
| Review completed on time | +50 | Crew+ |
| KPI target hit (per period) | +100 | Crew+ |
| **5★ Google review naming you** | **+200** | Crew+ |
| Written customer compliment | +100 | Crew+ |
| Crew safety milestone (quarter incident-free) | +150 each | Crew+ |
| Peer recognition received | +20 | Crew+ |

**Guardrail:** cap the small habit points (rituals) at ~300/week so points reward behavior, not grinding; big awards (reviews, customer reviews, safety) uncapped. Make the cap configurable.

**Catalog (seed as editable; show implied $ = points × anchor, anchor = $0.25 configurable):** Team lunch 600 · Company hoodie/gear 800 · Leave 1 hr early Friday 700 · $50 gas/gift card 1,000 · First pick of next job/schedule 1,500 · $100 gift card 2,000 · Extra paid day off 2,500 · Boots/premium tool allowance 3,000 · Quarterly leaderboard champion (recognition + bonus points). *(Reconcile point-costs vs the $0.25 anchor with the client — see §2.)*

**Redemption flow:** member requests a reward → admin/HR approves → a negative `redeem` event is written, decrementing the balance; keep a redemption history.

**Award path:** Crew+ earning events go through the shared idempotent award function/pattern (like SOP+'s `award-points`), keyed so nothing double-awards a given action+period. Balances = sum of a user's `points_events` (positive earns minus redemptions).

---

## 7. Permissions & privacy
- **admin/HR (Operations):** manage values, reviews, KPIs, compliance, rewards catalog, users; approve redemptions.
- **CFO:** all of the above's read + **the only role that sees bonus dollar amounts.**
- **manager / Crew Lead:** run reviews for their people, see their crew's status, drop feedback notes.
- **crew:** do rituals, submit feedback, see **own** points/reviews/certs/bonus **trajectory** (never dollars), leaderboard.
- Enforce server-side (RLS/middleware). Bonus dollar figures must be unreadable by non-admin/CFO roles at the DB level.

---

## 8. Data model (Postgres, shared Supabase project)
Reuse `profiles` and shared `points_events`. Add: `value` (+ `ritual` cadence), `review` (type: 30/60/90/quarterly/annual; ratings on responsibilities/values/KPIs; status; scheduled/completed dates), `review_note` (lightweight between-review feedback), `kpi` (role, name, target, period) + `kpi_result`, `bonus_config` (profit %, role weights, rating→factor map, floors/caps) + `bonus_period`, `certification` (person, name, issued_at, expires_at, status) , `reward` (catalog item: name, points, active) + `reward_redemption` (user, reward, points, status, redeemed_at, external_ref to the negative points_event), `recognition` (from/to/message), `nudge`/schedule config. Keep bonus dollar fields access-restricted via RLS.

---

## 9. Out of scope (v1 — note, don't build)
Automated Google-review scraping/attribution (manual-confirm in v1); payroll/benefits integration; automated profit import from accounting (CFO enters the pool %/figure); native mobile push beyond the suite's existing channel; deep analytics dashboards. Keep the schema from painting us into a corner.

---

## 10. Acceptance criteria (v1)
1. Sign in via Supabase; role-driven access; demo fallback works without env vars.
2. Values with daily/weekly/monthly rituals; completing a ritual earns the configured points (respecting the weekly habit cap).
3. Reviews on the 3-tier scale (crew) with the 30/60/90 + quarterly + annual cadence and the nudge countdown; completing on time earns points.
4. KPI scaffold per role with editable, initially-blank targets; hitting a target earns points.
5. Bonus scorecard shows a green/amber/red "on track" trajectory to everyone but **dollars only to admin/CFO**; %/weights/factors are configurable.
6. Compliance module seeded with the real roster, expiry-date entry, and 60/30/7-day alerts; gaps surfaced; keeping certs current earns points.
7. **One wallet:** the balance and leaderboard include Warehouse Wizard and SOP+ points from the shared `points_events`, plus Crew+ earns; redemptions write negative events and decrement the balance.
8. Rewards catalog shows point cost **and** implied $ (points × configurable $0.25 anchor); redemption request → admin approval → balance decremented.
9. Every screen matches the Van Isle Water Proofing+ brand and the suite design system.

---

## 11. Deliverables & build order
Running app (frontend + shared Supabase) with the stack/brand above; migrations + seed (values, review templates, KPI scaffold, real cert roster, rewards catalog, earning config); auth + roles + RLS (dollar privacy); the shared-ledger read + Crew+ award path + redemption; the nudge engine; tests for the points wallet math (earn + redeem + guardrail cap), the idempotent Crew+ awards, review cadence scheduling, cert-alert windows, and bonus-trajectory/dollar-privacy; README covering shared-Supabase setup and the wallet/award contract.

Suggested order:
1. Scaffold in the suite (shared design tokens + Supabase client + auth/roles).
2. Schema + seed + RLS (incl. dollar-privacy).
3. **Wallet:** read shared `points_events` → one balance + leaderboard; Crew+ award path (idempotent) + redemption (negative events). *(Load-bearing — do early.)*
4. Rewards catalog + redemption flow (with configurable anchor + implied $).
5. Values & rituals + the nudge engine.
6. Reviews (cadence + scale + notes) and KPIs.
7. Bonus scorecard (trajectory + admin/CFO dollars).
8. Compliance (roster + expiry + alerts).
9. Feedback, recognition, Google-review QR (+200) — manual-confirm.
10. PWA polish, tests, README.

Confirm the shared-Supabase-project assumption and the CFO-only dollar-visibility rule if ambiguous; otherwise proceed with these defaults. Where the client still owes real numbers (KPI targets, bonus %/weights, cert dates, final value wording), ship the editable scaffold seeded with the starter content.
