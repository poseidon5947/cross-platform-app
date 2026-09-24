# Codex Prompt — Live verification pass 3: the silent-save fixes

> Verification task. **Do not change application code.** The only files you write are the report and cleanup manifest in section 9.
>
> Passes 1 and 2 produced `LIVE_VERIFICATION_REPORT.md` and `LIVE_VERIFICATION_REPORT_V2.md`. Read both first, and read `CLEANUP_MANIFEST.md`.
>
> Since pass 2, a family of bugs was found and fixed in which a record was **saved in the UI and never stored** — the feedback box threw away the message, peer recognition and KPI hits were rejected by the database, and several recurring point awards could only ever fire once. This pass exists to confirm those fixes work against the live system. Section 6 is the reason it exists; do that section even if you run short of time.

---

## 0. Rules

Production system, real employee records, launch imminent.

**This pass may write data, but only where section 6 says so, and only as specified.** Everything else is read-only.

**Never, in any section:**

- **Approve, reject or request a reward redemption, or trigger a cash-out.** This queues a real payroll bonus and cannot be undone. The redemption fix is verified in code; it is deliberately out of scope here.
- Award, adjust or reverse points outside the specific flows in section 6.
- Click **Connect QuickBooks** or **Sync jobs**. Send a test push notification.
- Change any person's role, wage, compensation or profile.
- Submit an onboarding form, or upload to onboarding documents or incident photos.
- Delete anything, including your own test records. **You cannot delete most records from the UI; that is expected.** Record them in the manifest instead.
- Edit or save any *existing* record. Create new ones only.

**Every record you create must carry the literal string `ZZTEST3`** in its most prominent free-text field. Use `ZZTEST3`, not `ZZTEST`, so this pass's records are distinguishable from pass 2's. If a record has no free-text field, say so in the manifest.

If a step cannot be done without breaking a rule, mark it `BLOCKED` and move on. **A missing result is fine; an invented one is not.** Never mark a check passed that you did not observe.

---

## 1. Credentials

Sheet: `https://docs.google.com/spreadsheets/d/1EKxNsSK7GyZ3OYhTupU9XLWnv9tgj79SoyFF-jE0Ck0/edit?gid=1027071879`
CSV: append `/export?format=csv&gid=1027071879` to the document path.

**The "Email (for login)" column is wrong for 11 of 12 rows.** Build the login from the **Username** column instead:

```
<username>@vanislecoatings.com
```

Use exactly these three. **Do not iterate over the other accounts** — that is a credential sweep and will be blocked.

| role | account |
|---|---|
| Admin | `jrogers@vanislecoatings.com` |
| Manager | `jdares@vanislecoatings.com` |
| Crew | `jgregoire@vanislecoatings.com` |

Passwords are the **Temporary PW** column. **Never print a password anywhere.**

---

## 2. Setup

- Warehouse Wizard — `https://warehouse-wizard-vanisle.poseidon5959.workers.dev/`
- Crew+ — `https://crew-plus-vanisle.poseidon5959.workers.dev/`
- SOP+ — `https://sop-plus-vanisle.poseidon5959.workers.dev/`

Capture on every page: uncaught errors, `console.error`, and HTTP ≥ 400. **Ignore only `/favicon.ico` 404s.**

Screenshot each numbered step and reference filenames in the report.

Widths: **390px** (phone — how the crew actually works), **768px**, **1280px**.

---

## 3. Do not report these — known correct

Re-reporting these costs a finding slot.

| observation | status |
|---|---|
| Inventory shows 101 items, Home says 121 SKUs | **Correct.** 20 Tremco items live on the Tremco tab. |
| Manager sees an "Hourly wage" field on Onboarding | **Correct** — that is their own new-hire form. |
| No HSA banner on Crew+ Home | **Correct.** Its window is 15 Oct – 31 Dec. |
| Header reads `J. Rogers · admin` not the full name | **Intentional.** |
| Crew+ Rituals shows only a **Weekly** ritual per value | **Correct.** The database has only weekly ritual prompts. Daily and monthly render only when a prompt exists. |
| Crew+ Reviews shows no Below/Meets/Exceeds picker on a review | **Correct.** All 11 reviews are `quarterly`, which uses the full Scorecard form. The picker only appears on non-quarterly reviews, of which there are none. |
| Below/Meets/Exceeds chips near "Crew scale"/"Office scale" are not clickable | **Correct.** That is a legend explaining the wording, not a control. |
| No truck receipts, no incident reports, empty recognition feed | **Correct** — these tables are empty. |
| Existing `ZZTEST` records from pass 2 | **Known.** A maintenance request and a checked task on the Ford F150 (LY1180), and a `use 1 Unit Screws` transaction. Already on the manifest — do not re-report. |

---

## 4. The one question this pass must answer

**Can a KPI hit be recorded?**

`crew_kpi_result` is empty in production. A policy allowing rows to be created there was added by hand and **could not be verified from outside the app** — an anonymous probe cannot distinguish a missing policy from one that simply is not satisfied. Signing in is the only way to settle it.

Signed in as **Manager** (`jdares@`), then repeat as **Crew** (`jgregoire@`):

1. Crew+ → **Reviews**. Scroll to the **KPIs** panel.
2. Note which KPIs are listed for that person's org role, and each one's current state.
3. Click **Mark hit** on **one** KPI. Record the exact toast or change.
4. Watch the network tab. Record the request to `crew_kpi_result` and its **HTTP status**. A **403** with code `42501` means the policy did not land — that is the answer we need. Report the status either way.
5. **Hard-reload** (Ctrl/Cmd-Shift-R), return to Reviews → KPIs.
6. **Does the KPI still read as hit?** Present = PASS. Reverted to "not started" = **critical**, and quote the `42501` if you saw one.
7. Record the KPI name in the manifest.

Do this for **one KPI per role, two in total.** Do not mark more.

---

## 5. Regressions — verify the earlier fixes held

Signed in as **Admin** unless stated.

1. **Warehouse Wizard → Daily Log.** Must list logs (there are **67**). Clear any month filter. Empty is a **critical** regression.
2. **Warehouse Wizard → Reports → Daily Log.** Same.
3. **Crew+ → Bonus.** Must render; it once crashed the whole app. Blank = **critical**.
4. **Crew+ sidebar at 1280px.** Labels flush left in plain text, not teal pills floated right.
5. **Crew+ at 390px.** Bottom bar shows Home, Profile, Onboarding, Time Off, Incidents, **More**. More opens a sheet with the rest; choosing one navigates and closes it. No clipped labels; every bar item ≥ 44px tall.
6. **Crew+ Admin tab.** Present for Admin; **absent** for Manager and Crew.
7. **Crew+ → Performance/Wallet → Quarter leaderboard.** It should reflect the **current quarter** (Jul–Sep 2026), not a single month. Note the figures; if every entry is 0, say so.
8. **SOP+ at 390px.** Five tabs reachable including **Admin**.

---

## 6. Persistence round-trips — the core of this pass

**This is the section that may write data.** Each of these flows previously saved in the UI and stored nothing. For **every** flow:

1. Fill the minimum required fields. Put `ZZTEST3` in the most prominent free-text field.
2. Submit. **Record the exact confirmation shown.**
3. Confirm it appears in its list **without reloading**.
4. **Hard-reload** and navigate back.
5. **Record whether it is still there.** Present = PASS. Gone = **critical** — name the table and quote any console or network error.
6. Add it to the cleanup manifest.

| # | app | flow | signed in as | where to re-check after reload |
|---|---|---|---|---|
| 1 | Crew+ | **Company feedback** — "What should we improve?" | Crew | the panel below it on the same tab |
| 2 | Crew+ | **Peer recognition** to a teammate | Crew | Recognition feed |
| 3 | Crew+ | Time Off request | Crew | Time Off history |
| 4 | Crew+ | Incident report (**no photo**) | Crew | Submitted Reports |
| 5 | Crew+ | Policy acknowledgment | Crew | the policy's signed state |
| 6 | Crew+ | Form submission | Crew | submission history |
| 7 | Warehouse Wizard | Maintenance request | Crew | Maintenance requests |
| 8 | Warehouse Wizard | Daily log submission | Crew | Daily Log history |

**Flows 1 and 2 are the most important** — both were storing nothing at all until this week.

**On flow 1 specifically**, also check the privacy boundary:
- As **Crew**, after submitting, the panel should show **your own** entry only.
- Sign in as **Admin** and confirm the same entry is visible there, attributed to the person who wrote it.
- Sign in as **Manager** and confirm the Crew member's feedback is **not** visible. A manager seeing it is the **highest-severity finding in this pass.**

**Also on flow 1:** the tab has two textareas, "Company feedback" and "Peer recognition". Type into one and confirm the other **stays empty**. They were previously wired to the same value.

**Do not attempt onboarding** — it is one-time per person and cannot be undone.

---

## 7. Recurring awards — do they come back next period?

Previously several point awards could fire exactly once per person and then never again.

Signed in as **Crew**:

1. Crew+ → **Rituals**. Note every value shown and the state of its Complete button.
2. Click **Complete** on **one** ritual. Record the toast and whether the row changes to a **Done** pill.
3. Click the same one again if a button is still present. It must **not** award twice — a message saying it is already done is correct, silence is a finding.
4. **Hard-reload.** The ritual should still read **Done** for this period.
5. Crew+ → **Wallet**. Confirm the points from step 2 appear in the ledger with a sensible reason.

Do this for **one ritual only.** Record it in the manifest.

---

## 8. Role separation

Sign in as **Manager**, then **Crew**. For each, in both Warehouse Wizard and Crew+, record:

1. Which nav tabs are visible.
2. Warehouse Wizard → Inventory and Tremco: are prices visible? Expected **hidden from Crew**, visible to Manager.
3. Crew+ → any wage, compensation or dollar figure for *another person* reachable by the Manager? Expected **no**. (Their own onboarding form's wage field does not count.)
4. Crew+ → Incidents as Crew: only their own reports.
5. Crew+ → Feedback as Manager: another person's feedback must **not** be visible (see section 6).
6. Warehouse Wizard → Admin as Manager: confirm the **CSV file picker**, **Connect QuickBooks** and **Sync jobs** are `disabled`. Report their state — **do not click them.**

Any lower-privileged role seeing something it should not is the **highest-severity finding** — put it first.

---

## 9. Output

Write two files in the repo root. **Do not commit them.**

### `LIVE_VERIFICATION_REPORT_V3.md`

1. **Summary** — one paragraph: what you checked, what you could not, and **a direct answer to section 4** (can a KPI hit be recorded?).
2. **Findings table**, most severe first:

   | # | severity | app | where | expected | observed | screenshot |

   `critical` = data loss, a record vanishing after reload, or a role seeing forbidden data. `major` = feature broken. `minor` = cosmetic. `note` = works, worth knowing.
3. **Persistence table** — one row per section 6 and 7 flow: flow, confirmation message, visible before reload, **visible after reload**, HTTP status of the write, verdict.
4. **Checklist results** — every numbered step in sections 4–8 as `PASS` / `FAIL` / `BLOCKED`, each with one line of evidence citing what you actually saw.
5. **Console and network** — every error and HTTP ≥ 400, with the page. State explicitly if there were none.
6. **Not fixed** — defects found, for the next pass.

### `CLEANUP_MANIFEST_V3.md`

Every record you created, so a human can remove them:

| app | where it appears | identifying text | created as | how to find it |

If you created nothing in a flow because it was blocked, say so. **An accurate manifest matters more than a complete checklist** — an untracked test record in a live system is worse than an unanswered question.
