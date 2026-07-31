# Codex Build Prompt — "SOP+" (Van Isle Water Proofing+ SOP Dashboard)

> Paste into Codex as the task brief. Self-contained. This is app #2 of a three-app suite (Warehouse Wizard ✅ built · **SOP+ ← you build this** · Crew+ later). Match the existing suite's stack, branding, and points model exactly.

---

## 0. Role & mission

You are a senior full-stack engineer. Build a **production-ready, responsive web app (installable PWA)** called **SOP+** for **Van Isle Water Proofing+**, a below-grade waterproofing contractor (Victoria/BC, Canada). It turns the company's paper/PDF SOP checklist into a living tool: managers map out the procedures that need documenting, assign each to a crew member, the crew member builds it out as clear steps **with photos and video**, a manager approves it, and the approved SOP becomes a clean, followable checklist for the whole team. Completing an approved SOP earns the creator **+20 points** in the shared points system.

This is **not** a rebuild of the Warehouse Wizard — it is a sibling app that shares its design system, brand, auth model, and points ledger.

---

## 1. Match the existing suite (do this first)

SOP+ must look and behave like a member of the Van Isle suite. Reuse, don't reinvent:

- **Stack:** React + TypeScript + Vite, mobile-first **PWA** (service worker + manifest, offline-tolerant). Same as Warehouse Wizard.
- **Backend:** **Supabase** (Postgres + Auth + RLS + Edge Functions + **Storage** for media). **Use the same Supabase project as Warehouse Wizard** so users and the points ledger are shared. Reuse the existing `profiles` table (roles: admin | manager | crew) and the existing `points_events` append-only ledger.
- **Brand (from the Van Isle logo standards):** Marine Teal `#14A2A4`, Carbon Black `#1C1E20`, White `#FFFFFF`; font **Questrial**. Same tokens/components as Warehouse Wizard — port its design system (cards, chips, bottom-sheets, segmented controls, bottom nav, toasts, brand theme as default). Do **not** introduce a generic admin template.
- **Auth:** Supabase password login + role-driven access, same pattern as Warehouse Wizard. Demo/localStorage fallback when Supabase env vars are absent, so it's runnable for design review.
- **Offline:** same optimistic-write + queue-drain-on-reconnect pattern already in Warehouse Wizard (`src/data/offline.ts`) — extended here to media capture.

If SOP+ lives in the same repo, put it under a clear subfolder/workspace and share the design tokens + Supabase client; if separate, copy the design system verbatim.

---

## 2. Confirmed client decisions (authoritative — these answer the dev-note's open questions)

1. **Point value:** flat **+20 per approved SOP** (never varies by complexity).
2. **Who earns points:** **anyone** who creates an SOP — crew, crew lead, or manager.
3. **Offline capture:** required in v1 — crew can capture photos/videos offline and they **sync later** on reconnect.
4. **Published SOPs are NOT tick-off/runnable checklists** in v1. A published SOP is a clean, readable, followable reference. **But its fields/steps remain editable over time** as things change.
5. **Anyone can edit a published SOP** (not locked to the original author or a manager).
6. **Sign-off:** **one-person approval** only — a single manager approves; no two-person sign-off.

---

## 3. Roles & permissions

Reuse the suite's three roles; keep permissions **configurable**, not hard-coded, consistent with the other apps.

| Capability | Admin / Manager (Owner) | Crew Lead | Crew Member |
|---|---|---|---|
| Create/rename/reorder/archive SOP categories | ✅ | optional (configurable) | ⛔ |
| Create an SOP item & assign it to someone | ✅ | within their crew (configurable) | ⛔ |
| Build/edit steps + attach media on assigned SOPs | ✅ | ✅ | ✅ |
| Submit an SOP for review | ✅ | ✅ | ✅ |
| Approve / request changes (one-person sign-off) | ✅ | configurable | ⛔ |
| **Edit a published SOP** | ✅ | ✅ | ✅ (anyone) |
| View full library / follow published SOPs | ✅ | ✅ | ✅ |
| Completion & points reporting | ✅ | ⛔ | own points only |

Enforce server-side (RLS/middleware), not just UI hiding.

---

## 4. SOP library — structure & seed

A **Category** holds **SOP items** (procedures); each item runs through the status lifecycle (§6). Managers can add, rename, reorder, and archive categories/items — the seed is a starting point, not a fixed schema.

**Seed these default categories + items (from the company's checklist template):**

- **Warehouse Operations** — Opening Procedures; Safety Checks; Inventory Handling; Standards; Anytime Tasks (Daily/Weekly/Monthly); Tool Inspection; Equipment Inspection; Vehicle Inspection; Fleet Inspection; Materials Inspection; Repairs & Maintenance.
- **Daily Start-Up** — Tool selection; Material selection; Vehicle Inspection; Truck loading procedure.
- **End-of-Day Closeout** — Equipment Cleaning; Equipment Checks; Material returns; Inventory checks; Vehicle Fuel (min. tank to leave for a job; where to get gas & payment); Mileage Checks; Tool maintenance.
- **Truck Loadout (start of day) by Service** — Truck Prep; then Waterproofing, Traffic Coating, Caulking, CFI, XPS.
- **Truck Closeout (end of day)** — Truck Close-Out; then Waterproofing, Traffic Coating, Caulking, CFI, XPS.
- **Service Execution** — Waterproofing; Traffic Coating; Caulking; CFI; XPS (+ room for more).
- **Site Prep** — Hazard Assessments; Equipment Staging; Materials Staging; Crew Planning; Down-time activities; What-if scenarios (broken, battery, lost, forgot).
- **Daily Job Site Closeout** — What to do before leaving; things to bring back (ladders, batteries, tools).
- **Crew Lead** — Scheduling (daily/weekly/monthly lookahead); Site Readiness; Site-manager touchpoints; Materials Ordering; Inventory Tracking; Warehouse management; Downtime Reduction; Add-on opportunities (crack injection).
- **Travel & Mobilization** — Site Readiness; Site Access; GC/Site-Super Comms; Parking Logistics; Site Orientation; Site Safety; What tools/materials are on site; Out-of-town (mileage own car, LOA).
- **Quality Assurance** — Start of job; Middle (50%); End (95%).
- **Demobilization (100%)** — Site Checks & sign-off; What comes back to the warehouse (fence signage, ladders, tools, batteries).
- **Warranty**
- **Other** — free slots the team adds over time.

---

## 5. Screens & flows

### 5.1 Dashboard (home)
- **Manager view:** the library at a glance — categories with progress indicators (e.g. "Service Execution — 3 of 6 documented"), a **Review queue** (submitted, awaiting approval), **In progress**, and **Unassigned** items needing an owner. Quick actions: **+ New SOP**, **Assign**, **Review queue**.
- **Crew view = "My SOPs":** what's assigned to build, what's in review, what's approved, and **their points earned**.

### 5.2 Create / map an SOP (manager)
Pick a category (or create one) and add an SOP item with: **Title** (what the checklist is for) · **Category** · **Short description / why it matters** (optional) · **Assign to** (the responsible crew member) · **Requires photo? / Requires video?** (default Y/N flags signalling expectations — crew can still add media freely) · **Due date** (optional). Saving creates it in **Assigned** status and notifies the assignee.

### 5.3 Build the SOP — guided step form (assignee) — *the heart of the app*
As simple as the paper Process Form, but smarter:
- **Header fields** (pre-filled where known): Date, Created by, What this checklist is for, Who is responsible.
- **Thinking prompts:** surface the category-appropriate guiding prompts so the whole process gets documented, not just the happy path. Prompts live in a small **editable config** (a `PromptSet` per category) so managers can tune/add them. Seed prompt sets from the dev note, e.g.:
  - *Site Prep / Crew Lead:* Has the site manager confirmed scaffolding/access, crew readiness, truck/boom-lift fit? Do we need to review plans first? Enough product — double-checked? What if we run out? What if the site isn't ready? Signage on the fence?
  - *Service Execution:* Go/no-go weather policy (e.g. 30% rain — send the crew)? Quality checks before/during/after? Common mistakes and how this checklist avoids them? What if an item is forgotten? How do you know we're ready to spray?
  - *Warehouse / Truck:* Recent hiccups and how they were resolved? Why load that tool? At least a half tank of gas — if not, where & how paid? Parking ticket? Accident? 10 things to check if the XYZ tool breaks?
  - *Site wrap-up:* Signage taken off the fence? Which job site next?
- **Steps:** an ordered, **unlimited** add-as-you-need list (the paper form caps at 8 — the app must not). Each step: step text · optional photo(s) · optional video(s) · optional short note/caption. Steps can be **reordered (drag), edited, deleted**. **Auto-save throughout.**
- **Media handling:** in-app **camera capture + gallery upload**; thumbnails inline per step; tap to expand; sensible compression/size limits for cellular. **Store media against the step**, not just the SOP (a published checklist shows the picture next to the words). **Offline capture with sync-on-reconnect** (crews are often on low-signal sites) — queue media + metadata locally, upload to Supabase Storage when back online. Store media as `storageKey` + `thumbnailUrl`.
- **Submit** → status **In Review**; manager notified.

### 5.4 Review & approve (manager)
Open a submitted SOP, read steps, view media, then either:
- **Approve** → status **Published**; joins the live library; **fire the +20 points event** for the assignee (§7), **once per SOP**.
- **Request changes** → status back to **In Progress** with comments; assignee revises and resubmits.

### 5.5 Follow / edit a published SOP
Any team member opens a published SOP as a **clean, numbered, readable checklist with media inline**. It is **not** tick-off/runnable in v1. **Any team member can edit** its fields/steps as the process changes over time (keep the schema versionable for a future v2 edit-history — see §10). Editing a published SOP does **not** re-award points.

---

## 6. Status lifecycle

```
Assigned → In Progress → In Review → (Approve) → Published → (Archived, optional)
                            └→ (Request changes) → In Progress → …
```
- **Assigned** — created by manager, waiting on assignee.
- **In Progress** — assignee is building it (auto-set on first edit).
- **In Review** — submitted, awaiting the single approver.
- **Published** — approved & live. **Triggers +20 once.** Remains editable by anyone.
- **Archived** — retired/superseded, kept for history.

---

## 7. Points integration (+20, shared ledger)

Completing (approving) an SOP awards **+20 points to its creator**, in the **shared points system** the whole suite uses.

- **Write to the same `points_events` append-only ledger** Warehouse Wizard already uses (same Supabase project). Add an event type for SOP awards (e.g. `sop_completed`) with `points: 20`, `reason`, `ref = sopId`, `user_id = creator`, `ts`.
- **Idempotent — award exactly once per SOP.** Guard on `ref = sopId` (unique per award); if an SOP is unpublished and re-approved, do **not** re-award. Editing a published SOP never re-awards.
- The dashboard shows a crew member's SOP-earned points by reading the ledger (sum of their `points_events`).
- **Contract note for the future Crew+ app:** Crew+ will own the wallet/perks and consume this ledger via the same `points-feed` seam Warehouse Wizard exposes. Keep the event shape consistent with the dev-note contract:
  `sop.completed → { crewMemberId, sopId, points: 20, awardedAt, awardedBy, reason }`. Don't build a competing balance here.

---

## 8. Notifications
Use the same in-app/push channel as the suite. Notify: assignee when an SOP is assigned; manager when one is submitted; assignee on approval (with the +20 confirmation) or on requested changes (with comments); optional nudge on overdue assigned SOPs.

---

## 9. Data model (Postgres, share the suite's Supabase project)

Add these tables (uuid ids, `created_at`/`updated_at`, FKs, indexes). Reuse existing `profiles`.

- **sop** — `id, title, category_id, description, status (assigned|in_progress|in_review|published|archived), assigned_to (profiles), created_by (profiles), requires_photo bool, requires_video bool, due_date, submitted_at, approved_at, approved_by (profiles), points_awarded bool`.
- **sop_category** — `id, name, sort_order, archived bool, prompt_set_id`.
- **sop_step** — `id, sop_id, sort_order, text, note`.
- **sop_media** — `id, step_id, type (photo|video), storage_key, thumbnail_url, size, captured_at`. (Media belongs to the **step**.)
- **prompt_set** — `id, name, prompts jsonb[]` (editable list surfaced during step building).
- **points_award** (local record of what was fired) — `id, sop_id, crew_member_id, points, awarded_at, external_ref, status`. (The authoritative award still lands in the shared `points_events`.)
- Reuse **profiles**; add `crew_plus_id` there if not present (link to future Crew+ account).

Media files go in **Supabase Storage**; keep only keys/URLs in Postgres. Keep SOPs **versionable** so a future edit-history/diff (v2) doesn't require a schema rewrite.

---

## 10. Out of scope (v2 — note in schema, don't build)
Logging individual **runs** of a published checklist (who ran it, tick-off history); analytics on time saved / downtime; **version history/diffing** of an SOP after edits; digital signatures on sign-off SOPs; bulk import of existing SOPs from the current PDFs. Keep the schema from painting us into a corner (versionable SOPs, media-per-step).

---

## 11. Acceptance criteria (v1)
1. A manager can create a category, add an SOP item, and assign it to a crew member.
2. The assignee is notified and opens a guided form pre-filled with the SOP's header fields.
3. The build form surfaces the category-appropriate **thinking prompts**, editable via config.
4. The assignee can add, reorder, edit, and delete an **unlimited** number of steps, each with optional photos/videos captured in-app or uploaded.
5. Work **auto-saves** and survives the app closing; media captured **offline syncs on reconnect**.
6. The assignee can submit for review; a single manager can **approve or request changes** with comments.
7. On approval, a `sop_completed`/`sop.completed` event awards **exactly +20** points to the creator in the shared ledger, **once and only once** (idempotent on `sopId`).
8. A published SOP is viewable by anyone as a clean, numbered checklist with media inline, and is **editable by anyone** (not tick-off/runnable in v1).
9. Every screen matches the Van Isle Water Proofing+ branding and the existing suite's design system.

---

## 12. Deliverables
Running app (frontend + Supabase) with the stack/brand above; migrations + seed (categories, items, prompt sets); auth + roles; all screens in §5; Supabase Storage media pipeline with offline capture + sync; the shared-ledger +20 award (idempotent); notifications; tests for the status lifecycle, the idempotent award, offline media queue drain, and permissions; a README covering setup, the shared-Supabase/points contract, and what's v2.

## 13. Build order (suggested)
1. Scaffold in the suite (shared design tokens + Supabase client + auth/roles).
2. Schema + seed (categories/items/prompt sets) + RLS.
3. Library + Dashboard (manager + My SOPs).
4. Create/assign SOP.
5. Guided step builder + auto-save (text first).
6. Media pipeline: Supabase Storage + in-app capture + thumbnails + **offline queue/sync**.
7. Review/approve + request-changes + status lifecycle.
8. Idempotent +20 into shared `points_events`; points display.
9. Published-SOP read + anyone-edit.
10. Notifications, PWA polish, tests, README.

Confirm the shared-Supabase-project assumption (§1/§7) and the configurable Crew-Lead permissions (§3) if ambiguous; otherwise proceed with these defaults.
