# Codex Prompt — Live verification pass 2: persistence, UI/UX, regressions

> Verification task. **Do not change application code.** The only files you write are the report and cleanup manifest in section 8.
>
> This is the second pass. The first produced `LIVE_VERIFICATION_REPORT.md`; read it before starting. That pass was strictly read-only, which left the most important question unanswered: **does data submitted through the UI actually come back after a reload?** That is section 5 and it is the reason this pass exists.

---

## 0. Rules

Production system, real employee records, launch imminent.

**This pass may write data, but only where section 5 says so, and only as specified.** Everything else is read-only: navigate, open sheets, close them with `x` or Cancel, scroll, resize, toggle theme.

**Never, in any section:**

- Approve or reject a reward redemption; award, adjust or reverse points; trigger a cash-out.
- Click **Connect QuickBooks** or **Sync jobs**.
- Send a test push notification.
- Change any person's role, wage, compensation or profile.
- Upload to onboarding documents or incident photos (personal data — section 5 covers what is allowed).
- Delete anything, including your own test records. **You are not able to delete most records from the UI; that is expected.** Record them in the manifest instead.
- Edit or save any *existing* record. Create new ones only.

**Every record you create must be identifiable.** Put the literal string `ZZTEST` in the most prominent free-text field (name, location, description, note). If a record has no free-text field, say so in the manifest.

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

Passwords are the **Temporary PW** column; all three were confirmed working. **Never print a password anywhere.**

---

## 2. Setup

- Warehouse Wizard — `https://warehouse-wizard-vanisle.poseidon5959.workers.dev/`
- Crew+ — `https://crew-plus-vanisle.poseidon5959.workers.dev/`
- SOP+ — `https://sop-plus-vanisle.poseidon5959.workers.dev/`

Capture on every page: uncaught errors, `console.error`, and HTTP ≥ 400. **Ignore only `/favicon.ico` 404s** — known on all three.

Screenshot each numbered step; reference filenames in the report.

Widths to test: **390px** (phone — how the crew actually works), **768px** (tablet), **1280px** (desktop).

---

## 3. Do not report these — known correct

The previous pass raised these; they are resolved or by design. Re-reporting them costs a finding slot.

| observation | status |
|---|---|
| Inventory shows 101 items, Home says 121 SKUs | **Correct.** 20 Tremco items live on the Tremco tab. 101 + 20 = 121. |
| Manager sees an "Hourly wage" field on Onboarding | **Correct.** That is their *own* new-hire form. The Submitted Onboarding list (other people's data) is correctly admin-only. |
| No HSA banner on Crew+ Home | **Correct.** Its window is 15 Oct – 31 Dec. |
| No count badge in the Crew+ sidebar | **Correct.** Nothing is pending. |
| Header reads `J. Rogers · admin` not the full name | **Intentional** abbreviation. |
| Crew+ Bonus page showing seeded rather than real figures | Only report if it **crashes** or shows nothing. |
| No receipts under a truck | **Correct** — there are no truck logs yet. |

---

## 4. Regressions — verify the recent fixes held

Signed in as **Admin** unless stated.

1. **Warehouse Wizard → Daily Log.** The history must now list daily logs (there are **67**). Clear any month filter. Empty here is a **critical** regression — this was broken and was just fixed.
2. **Warehouse Wizard → Reports → Daily Log.** Same: must show logs, not an empty state.
3. With the month filter cleared, the empty-state wording (if it appears at all) must read "No daily logs yet.", **not** "Nothing logged for this month."
4. **Crew+ → Bonus.** Must render. It previously crashed the whole app with `Cannot read properties of undefined (reading 'floorsCaps')`. A blank page or that error is a **critical** regression.
5. **Crew+ sidebar at 1280px.** Labels flush left in plain text. If they render as teal pills floated right, that fix regressed.
6. **Crew+ at 390px.** The bottom bar shows Home, Profile, Onboarding, Time Off, Incidents, **More**. Tapping More opens a sheet with the remaining tabs (Wallet, Rituals, Reviews, Forms, Bonus, Certs, Rewards, Feedback, Admin). Choosing one navigates and closes the sheet. Confirm no label is clipped and every bar item is at least 44px tall.
7. **Crew+ Admin tab visibility.** Present for Admin; **absent** for Manager and Crew.
8. **Crew+ → Admin → Data intake importer.** Button reads **Preview tab**; copy says it previews in your session only. Do not click it.

---

## 5. Persistence round-trips — the core of this pass

**This is the section that may write data.** The bug pattern being hunted: a record saves, the UI confirms, and after a reload it is gone — because the table's read policy is missing. That exact failure hid 67 daily logs. These tables are all currently **empty**, so nobody has ever exercised them against production.

**For each flow below, the procedure is identical:**

1. Fill the minimum required fields. Put `ZZTEST` in the most prominent free-text field.
2. Submit. Record the exact confirmation shown.
3. Confirm the record appears in its list **without reloading**.
4. **Hard-reload the page** (Ctrl/Cmd-Shift-R) and navigate back.
5. **Record whether it is still there.** Present = PASS. Gone = **critical** finding — name the table.
6. Add it to the cleanup manifest.

| # | app | flow | signed in as | list to re-check after reload |
|---|---|---|---|---|
| 1 | Crew+ | Time Off request | Crew | Time Off history |
| 2 | Crew+ | Incident report (**no photo**) | Crew | Submitted Reports |
| 3 | Crew+ | Policy acknowledgment | Crew | the policy's signed state |
| 4 | Crew+ | Recognition / kudos to a teammate | Crew | recognition feed |
| 5 | Crew+ | Form submission | Crew | submission history |
| 6 | Warehouse Wizard | Maintenance request | Crew | Maintenance requests |
| 7 | Warehouse Wizard | Mark one task complete | Crew | task state after reload |
| 8 | Warehouse Wizard | Daily log submission | Crew | Daily Log history |

**Do not attempt onboarding** — it is one-time per person and cannot be undone.

**Certificate photo upload** (the one permitted file write): as Admin, attach a small throwaway image to one certificate. Record whether the picker shows `Uploading...` → `Uploaded.` or `Upload failed`. Hard-reload and record whether it still shows as attached and whether the link opens. Note the certificate in the manifest.

---

## 6. UI/UX pass

At **390px, 768px and 1280px**, for all three apps, both **light and dark** theme (Crew+ and SOP+ have an Auto/Light/Dark control in the sidebar footer):

1. **No horizontal page scroll** at any width. Report any page where `document.documentElement.scrollWidth > window.innerWidth`.
2. **No clipped text or controls.** Check specifically: Warehouse Wizard → Tasks → Warehouse frequency row and category chips; the segmented controls; table rows; long job-site names.
3. **Dark mode legibility.** Every form field, placeholder, dropdown and disabled control must be readable — no white-on-white or dark-on-dark. This was a client-reported bug before; check inputs with pre-filled values, not just empty ones.
4. **Touch targets ≥ 44px** on anything tappable at 390px.
5. **Alignment and spacing.** Cards in a row share edges and baselines; labels line up with their fields; nothing overlaps.
6. **Empty states** read as intentional sentences, not blank space.
7. **Loading and error states.** Note anything that flashes an error, an empty list, or a layout jump on first paint.

Report each as `app / page / width / theme` with a screenshot.

---

## 7. Role separation

Sign in as **Manager** then **Crew**. For each, in both Warehouse Wizard and Crew+, record:

1. Which nav tabs are visible.
2. Warehouse Wizard → Inventory and Tremco: are prices visible? Expected **hidden from Crew**, visible to Manager.
3. Crew+ → any wage, compensation or dollar figure for *another person* reachable by the Manager? Expected **no**. (Their own onboarding form's wage field does not count — see section 3.)
4. Crew+ → Incidents as Crew: only their own reports.
5. Warehouse Wizard → Admin as Manager: confirm the **CSV file picker**, **Connect QuickBooks** and **Sync jobs** controls are `disabled`. Report their disabled state — **do not click them.**

Any lower-privileged role seeing something it should not is the **highest-severity finding** — put it first.

---

## 8. Output

Write two files in the repo root. **Do not commit them.**

### `LIVE_VERIFICATION_REPORT_V2.md`

1. **Summary** — one paragraph: what you checked, what you could not, the single most important finding.
2. **Findings table**, most severe first:

   | # | severity | app | where | expected | observed | screenshot |

   `critical` = data loss, a record vanishing after reload, or a role seeing forbidden data. `major` = feature broken. `minor` = cosmetic. `note` = works, worth knowing.
3. **Checklist results** — every numbered step in sections 4–7 as `PASS` / `FAIL` / `BLOCKED`, each with one line of evidence citing what you actually saw.
4. **Persistence table** — one row per section 5 flow: flow, confirmation message, visible before reload, **visible after reload**, verdict.
5. **Console and network** — every error and HTTP ≥ 400, with the page. State explicitly if there were none.
6. **Not fixed** — defects found, for the next pass.

### `CLEANUP_MANIFEST.md`

Every record you created, so a human can remove them:

| app | where it appears | identifying text | created as | how to find it |

If you created nothing in a flow because it was blocked, say so. **An accurate manifest matters more than a complete checklist** — an untracked test record in a live system is worse than an unanswered question.
