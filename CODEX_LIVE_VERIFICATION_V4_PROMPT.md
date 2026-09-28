# Codex Prompt — Live verification pass 4: offline resilience, role gating, and the closed security hole

> Verification task. **Do not change application code.** The only files you write are the report and cleanup manifest in section 10.
>
> Read `LIVE_VERIFICATION_REPORT_V3.md`, `CLEANUP_MANIFEST.md` and `CLEANUP_MANIFEST_V3.md` before starting.
>
> Warehouse Wizard soft-launches to the crew on **October 2nd**. Everything here is ordered by whether it affects that date. Section 3 needs no login and takes two minutes — do it first. Section 6 is the one this pass exists for: **the crew work in basements and crawlspaces, and the app has to not lose their work when the signal goes.**

---

## 0. Rules

Production system, real employee records, launch in days.

**This pass may write data, but only where sections 6 and 8 say so, and only as specified.** Everything else is read-only.

**Never, in any section:**

- **Approve, reject or request a reward redemption, or trigger a cash-out.** That queues a real payroll bonus and cannot be undone.
- **Run a CSV import in section 7 with anything but the file that section names.** An import writes to the live materials list.
- Click **Connect QuickBooks** or **Sync jobs**. Send a test push notification.
- Change any person's role, wage, compensation or profile. **Section 5 looks at the compensation form but does not save it.**
- Submit an onboarding form, or upload to onboarding documents or incident photos.
- Delete anything, including your own test records. Record them in the manifest instead.

**Every record you create must carry the literal string `ZZTEST4`** in its most prominent free-text field — not `ZZTEST` or `ZZTEST3`, which belong to earlier passes.

If a step cannot be done without breaking a rule, mark it `BLOCKED` and move on. **A missing result is fine; an invented one is not.**

---

## 1. Credentials

Sheet: `https://docs.google.com/spreadsheets/d/1EKxNsSK7GyZ3OYhTupU9XLWnv9tgj79SoyFF-jE0Ck0/edit?gid=1027071879`

**The "Email (for login)" column is wrong for 11 of 12 rows.** Build the login from the **Username** column:

```
<username>@vanislecoatings.com
```

| role | account |
|---|---|
| Admin | `jrogers@vanislecoatings.com` |
| Manager | `jdares@vanislecoatings.com` |
| Crew | `jgregoire@vanislecoatings.com` |

Passwords are the **Temporary PW** column. **Do not iterate over other accounts.** **Never print a password anywhere.**

---

## 2. Setup

- Warehouse Wizard — `https://warehouse-wizard-vanisle.poseidon5959.workers.dev/`
- Crew+ — `https://crew-plus-vanisle.poseidon5959.workers.dev/`
- SOP+ — `https://sop-plus-vanisle.poseidon5959.workers.dev/`

Capture uncaught errors, `console.error`, and HTTP ≥ 400 on every page. **Ignore only `/favicon.ico` 404s.** Screenshot each numbered step.

Widths: **390px** (how the crew actually work), **768px**, **1280px**.

---

## 3. Security check — no login needed, do this first

An endpoint was returning staff names, roles and company email addresses to anyone on the internet. It has been closed. Confirm it stayed closed, and that nothing else is open.

Run each of these and record the **HTTP status and body**:

```
curl -s -o /dev/null -w "%{http_code}\n" https://ddcqyxwuvimxsgktlqya.supabase.co/functions/v1/points-feed
curl -s https://ddcqyxwuvimxsgktlqya.supabase.co/functions/v1/points-feed
```

1. **Expected: `401 {"error":"Unauthorized"}`.** Anything returning `200`, or any response containing an `@vanislecoatings.com` address or a person's name, is a **critical** finding — stop and report it immediately.
2. Repeat for each of these. Record status and body for every one. None should return data without credentials:
   `award-points`, `materials-import`, `send-push`, `run-nudges`, `quickbooks-sync`, `quickbooks-oauth`
   A `405 POST required` is a correct answer for the first three. `401` is correct for the rest.
3. **Do not attempt to bypass any of these.** Recording the status is the whole task. Do not retry with keys, do not vary headers beyond the plain request above.

---

## 4. Do not report these — known correct

| observation | status |
|---|---|
| Inventory shows 101 items, Home says 121 SKUs | **Correct.** 20 Tremco items live on the Tremco tab. |
| Crew+ Rituals shows only a **Weekly** ritual | **Correct.** The database has only weekly ritual prompts. |
| Crew+ Reviews shows no Below/Meets/Exceeds picker | **Correct.** All reviews are quarterly, which uses the Scorecard form. |
| Below/Meets/Exceeds chips near "Crew scale" are not clickable | **Correct** — a legend, not a control. |
| No HSA banner, no truck receipts, empty recognition feed | **Correct** — outside its window / empty tables. |
| `ZZTEST` and `ZZTEST3` records | **Known**, on the earlier manifests. Do not re-report. |
| Crew home has no "Losses (30d)" tile and no "Price changes" card | **Correct and deliberate** — see section 5. |

---

## 5. Role gating — prices and awards

Crew must not see material costs, and must not be offered awards the server will refuse.

**Signed in as Crew (`jgregoire@`), in Warehouse Wizard:**

1. **Home.** Confirm there is **no** "Losses (30d)" tile and **no** "Price changes" card. Their presence is a **critical** finding.
2. **Home → tap the "SKUs tracked" tile.** A graph opens. Confirm it shows counts and a chart but **no dollar figure** and no "Total inventory value".
3. **Home → tap "Need reorder".** Same: confirm **no "Est. reorder cost"** and no `$`.
4. **Inventory and Tremco.** Confirm no prices anywhere.
5. Record any `$` you can reach as Crew, on any screen, with the screen name.

**Signed in as Manager (`jdares@`), same four screens:** all of the above **should** show dollars. Record the "Est. reorder cost" figure you see. Absence for a manager is a finding too.

**Crew+, signed in as Crew:**

6. **Reviews → KPIs.** Each KPI shows either a **Hit** pill or a **Not yet** pill. There must be **no "Mark hit" button** for a crew member.
7. **Feedback tab.** Confirm the Google review link is present, but there is **no "Confirm 5-star"** and **no "Written compliment"** button.
8. **Certs.** Confirm there is **no "Current +5"** button on your own compliance card.

**Crew+, signed in as Manager:**

9. **Reviews → KPIs.** A **Mark hit** button should be present here.
10. **Feedback tab.** The customer-review section should appear, with a **"Who earned it"** dropdown listing people. Confirm the dropdown exists and lists more than one name. **Do not click Confirm.**

---

## 6. Offline resilience — the core of this pass

**The crew work where there is no signal.** Work logged offline used to be kept only in memory, and was thrown away by a reload, a killed tab, or a background refresh. It is now written to the phone. Confirm it.

Use Chrome DevTools → Network → **Offline** throttling. Sign in as **Crew** in Warehouse Wizard **first, while online.**

1. **Go online.** Sign in. Go to Daily Log / Log materials. Note the current stock figure of the material you will use.
2. **Switch to Offline** in DevTools.
3. **Log materials**: 1 unit of any material, with `ZZTEST4 offline test` in the note. Submit.
4. **Record the exact message shown.** Expect something like "Saved offline. It will sync when connection returns."
5. **While still offline, hard-reload the page** (Ctrl/Cmd-Shift-R).
6. **Record whether the pending item is still there** after the reload — check for a pending/sync indicator or the entry in the recent list. **Gone = critical**, and this is the single most important result in this pass.
7. **Go back online** in DevTools.
8. Wait, or trigger a refresh. **Record whether it syncs** — watch for a "Pending sync complete" message and a `POST` to `transactions`.
9. **Reload again and confirm the entry is present and the stock figure moved by exactly 1** — not 2. A movement of 2 means it was applied twice and is a **critical** finding.
10. Record the material and the before/after stock in the manifest.

**Then repeat steps 2–9 for a task completion**: go offline, tick one truck task, reload while offline, confirm it is still ticked, go online, confirm it syncs and the task is ticked **once**.

---

## 7. Material import — read the constraint before doing anything

**A CSV import must never change the quantity on hand of a material that already exists.** It may only set an opening quantity for a material that is genuinely new.

This section writes to the live materials list, so it is tightly bounded.

1. Sign in as **Admin**, Warehouse Wizard → **Admin → CSV Importer**.
2. **Before importing**, record the current stock of **Backer Rod** and of **Injection Resin** exactly.
3. Build a CSV with **exactly two rows** and import it:

```
Item,Unit,Cost,On hand
Backer Rod,Unit,9.99,999
ZZTEST4 Import Probe,Unit,1.23,7
```

4. **After the import, record the stock of Backer Rod again.** It **must be unchanged** — the `999` must be ignored. If it became 999, that is a **critical** finding.
5. Confirm **Backer Rod's cost** did update to 9.99 — the import is supposed to update costs.
6. Confirm **ZZTEST4 Import Probe** was created with quantity 7 — a new material may take its opening quantity from the sheet.
7. Record both materials in the manifest. **Do not import anything else.**

---

## 8. Awards that used to fail

These were refused by the server until this week. The function has since been deployed.

**Signed in as Crew:**

1. **Crew+ → Feedback → Peer recognition.** Send recognition to a teammate with `ZZTEST4 peer recognition` as the message.
2. Record the confirmation, and **the recipient's points before and after** (visible on the leaderboard).
3. **Record whether any error toast appears.** Previously this showed `Edge Function returned a non-2xx status code`. Any raw status-code wording reaching the screen is a finding — messages should now be plain English.
4. Hard-reload. Confirm the recognition is still in the feed **and** the recipient's points went up.

**Signed in as Manager:**

5. **Crew+ → Reviews → KPIs → Mark hit** on **one** KPI.
6. Confirm the row changes to a **Hit** pill — not still reading "Mark hit".
7. Hard-reload. **Confirm it still reads Hit.** Reverting is a **critical** finding.
8. Record the KPI in the manifest.

---

## 9. Compensation — look, do not save

1. Sign in as **Admin**, Crew+ → **Bonus**.
2. Confirm a **Compensation (admin/HR only)** section with a **"Whose record"** dropdown.
3. Confirm the dropdown lists multiple people — previously an admin could only ever see their own.
4. **Do not type into any field and do not save.** Record the field names only.
5. Sign in as **Manager**, same tab. Confirm there is **no** compensation section and **no** wage figure for anybody. A manager reaching a wage is the **highest-severity finding in this pass.**

---

## 10. Output

Write two files in the repo root. **Do not commit them.**

### `LIVE_VERIFICATION_REPORT_V4.md`

1. **Summary** — one paragraph, and a direct answer to two questions: **did offline work survive a reload (section 6), and is the points-feed endpoint still closed (section 3)?**
2. **Findings table**, most severe first:

   | # | severity | app | where | expected | observed | screenshot |

   `critical` = data loss, double-counting, a role seeing forbidden data, or an open endpoint. `major` = feature broken. `minor` = cosmetic. `note` = works, worth knowing.
3. **Offline table** — one row per section 6 step: action, message shown, survived reload, synced on reconnect, final stock delta.
4. **Checklist results** — every numbered step in sections 3, 5–9 as `PASS` / `FAIL` / `BLOCKED`, each with one line of evidence citing what you actually saw.
5. **Console and network** — every error and HTTP ≥ 400, with the page. State explicitly if there were none.
6. **Not fixed** — defects found, for the next pass.

### `CLEANUP_MANIFEST_V4.md`

| app | where it appears | identifying text | created as | how to find it |

Include the two materials from section 7 and the stock figures you recorded. **An accurate manifest matters more than a complete checklist.**
