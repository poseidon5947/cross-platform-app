# Codex Prompt — Live production verification pass (browser, logged in)

> **This is a verification task, not a build task. Do not change application code.** The only file you write is the report described in section 7. If you find a defect, document it precisely — do not fix it in this pass.
>
> Three separate apps share one Supabase backend. All three are deployed and live. Everything below is done **in a real browser against the live sites, signed in as a real user.**

---

## 0. Hard rules — read these before touching anything

This is the client's **production** system, days from launch, holding real employee records.

**Never do any of the following:**

- Submit an onboarding form, an incident report, a daily log, or a truck log.
- Save a truck, tool, material, job site, or task edit.
- Approve or request a reward redemption; award, adjust, or reverse points.
- Upload a file anywhere except where section 5 explicitly permits it.
- Change any user's role, wage, or profile.
- Delete anything.

**You may:** sign in, navigate, open tabs and sub-menus, open sheets/modals and close them with the `x` or Cancel, scroll, resize, toggle theme, and type into a field **only** when a step says to — then leave without saving.

If a check cannot be done without writing data, mark it `BLOCKED — needs write` in the report and move on. A missing result is fine; a fabricated one is not. **Never report a check as passed if you did not actually observe it.**

---

## 1. Credentials — read this carefully, the obvious approach fails

Credentials live in the client's sheet:
`https://docs.google.com/spreadsheets/d/1EKxNsSK7GyZ3OYhTupU9XLWnv9tgj79SoyFF-jE0Ck0/edit?gid=1027071879`
Export as CSV: append `/export?format=csv&gid=1027071879` to the document path.

**The sheet's "Email (for login)" column is wrong for 11 of the 12 rows.** Those addresses have no account behind them. The real login is built from the **Username** column:

```
<username>@vanislecoatings.com
```

Verified: `estimating@vanislecoatings.com` → *invalid credentials*; `jrogers@vanislecoatings.com` with the same temporary password → signs in. The only row whose listed email works as-is is Tara Clark (`ops@vanislecoatings.com`).

Use exactly three accounts, one per role. **Do not loop over every account** — that is a credential sweep and will be blocked, correctly.

| role | sign in as | use it for |
|---|---|---|
| Admin | `jrogers@vanislecoatings.com` | sections 3, 4, 5 |
| Manager | `jdares@vanislecoatings.com` | section 6 |
| Crew | `jgregoire@vanislecoatings.com` | section 6 |

Passwords are the **Temporary PW** column. Only Jordan's has been confirmed to still work; if either of the other two is rejected, record that as a finding and continue with the accounts you have.

**Never print a password into the report, a screenshot, a log, or a commit.**

---

## 2. Setup

Live URLs:

- Warehouse Wizard — `https://warehouse-wizard-vanisle.poseidon5959.workers.dev/`
- Crew+ — `https://crew-plus-vanisle.poseidon5959.workers.dev/`
- SOP+ — `https://sop-plus-vanisle.poseidon5959.workers.dev/`

For every page you visit, capture: uncaught page errors, `console.error` output, and any HTTP response ≥ 400. **A 404 for `/favicon.ico` is known and expected on all three — ignore only that one.** Everything else is a finding.

Take a screenshot at each numbered step and reference the filenames in the report.

Run every app at **1280px wide** and again at **390px wide** (phone). The crew uses phones in the field; layout breakage at 390px is a real defect, not a cosmetic note.

---

## 3. Warehouse Wizard — signed in as Admin

Recent changes are concentrated here; these steps target them specifically.

1. **Sign in.** Confirm you land on Home and the header shows `Jordan Rogers · admin`.
2. **Nav.** Expect exactly these tabs: `Home, Daily Log, Tasks, Tools, Inventory, Jobs, Reports, Admin`. Report any extra or missing.
3. **Home → attention links.** Click each row in "Needs attention" and record where it lands. Expected: *Truck tasks remaining today* → Tasks/Trucks; *Items below reorder threshold* → Inventory/Materials. If a *Daily log items need review* row appears, it must land on **Reports** with the Needs review section in view — **not** on Admin or the Crew page. This one was a reported bug; check it closely.
4. **Home → "View all →"** in Recent activity should go to **Daily Log**.
5. **Tasks tab.** Confirm three segments: `Trucks`, `Warehouse`, `Services`.
6. **Tasks → Warehouse.** Confirm the frequency row shows all six (`Daily, Weekly, Monthly, Quarterly, Yearly, As needed`) with **"As needed" fully visible, not clipped**, and that category chips wrap rather than cutting off. Check at 390px too — this was a client-reported bug.
7. **Tasks → Trucks → Fleet.** Six trucks. Each row shows mileage and last-service text. **No row may read `1970-01-01`** — with no data yet, the correct text is `No mileage yet · last service not recorded`.
8. **Open a truck** (tap the row). The sheet should show: Truck name, Current mileage (km), Last serviced, Last oil change (km), and a Save button. **Do not save.** Close with the `x`. If that truck has any gas-station receipts, a "Gas station receipts" list appears beneath with a **View receipt** button per row — production has no truck logs yet, so absence here is expected and correct.
9. **Tools tab.** Confirm an "Add new tool" affordance exists and opens a form. **Do not save.** Close it.
10. **Jobs tab.** Confirm it renders, with Active jobs (and Past jobs only if any exist).
11. **Reports tab.** Confirm **three** sub-tabs — `Inventory Log`, `Tremco Log`, `Daily Log` — and, **below** them, a **Needs review** section and an **Exports** section. This layout is a specific client requirement; report any deviation exactly.
12. **Admin tab.** Confirm five segments: `Crew`, `CSV Importer`, `PO estimate`, `Quickbooks`, `Settings`. Open each and confirm it renders its own content rather than blank.
13. **Inventory.** Confirm materials load (production has 121) and that prices are visible to admin.

---

## 4. Crew+ — signed in as Admin

1. **Sign in.** Land on Home.
2. **Sidebar — check this carefully.** Every menu label (`Home`, `Profile`, `Onboarding`, …) must sit **flush left**, in normal text, aligned with the other labels. A recent fix stopped them rendering as teal rounded pills floated to the right edge of their own button. If you see right-aligned pill labels, the fix has regressed — screenshot it.
3. Any count badge (e.g. on Rewards or Admin) should still be a teal pill on the **right**. Both behaviours must hold together.
4. **Onboarding tab.** Three file pickers: Direct deposit form, Licence front, Licence back. **Do not submit the form.** Confirm all three render with a visible file input.
5. **Incidents tab.** Confirm the form renders with a Photo file picker. **Do not submit.** Confirm the Submitted Reports list renders (production has zero reports, so an empty state is correct).
6. **Certs tab.** Confirm certificate records load (production has 17) and each offers a "Certificate photo or PDF" picker.
   - For each cert that already shows an attachment, record whether it displays as a plain name followed by **`(not stored)`**, or as an openable link. `(not stored)` means a pre-upload legacy record — **count how many are in each state and report the number.** This is an open question nobody has answered yet.
7. **Admin → Data intake importer.** Confirm the button reads **"Preview tab"** (not "Import tab") and the description says the result previews in your session only. **Do not paste CSV and do not click it.**
8. **HSA reminder banner.** Today's date is outside its window (it shows 15 Oct – 31 Dec), so **its absence from Home is correct**. Do not report a missing banner as a defect; just confirm it is absent.

---

## 5. The one permitted write — attachment round trip

This is the only step that may create data, and **only in Crew+ Certs**, which is the one place a stray record is harmless and reversible.

1. As **Admin**, go to Certs and pick any one certificate record.
2. Attach a small throwaway image to "Certificate photo or PDF".
3. Record exactly what the picker shows: `Uploading...`, then `Uploaded.`, or `Upload failed - nothing was saved. Try again.`
4. Record whether any request to `/storage/v1/object/crew-cert-media/...` returned an error.
5. **Report the certificate name and the file you attached so a human can remove it afterwards.** Do not attempt to delete it yourself — no delete policy exists, and the app cannot undo it.

If you are not comfortable that this is reversible, skip it and mark `SKIPPED — write step`.

---

## 6. Role separation — Manager and Crew

Sign out, then sign in as **Manager** (`jdares@…`), and afterwards as **Crew** (`jgregoire@…`).

Record for each role, in **both** Warehouse Wizard and Crew+:

1. Which nav tabs are visible — and specifically whether `Admin` appears.
2. **Warehouse Wizard → Inventory:** are material **prices** visible? Expected: hidden from Crew.
3. **Warehouse Wizard → Tremco:** same question.
4. **Crew+ → Onboarding:** does the "Submitted Onboarding (Admin/HR)" list appear? Expected: **admin only** — a Manager must not see it.
5. **Crew+:** is any wage, hourly rate, or compensation figure visible to the Manager? Expected: **no** — compensation is admin-only, explicitly not visible to managers. Production's compensation table is currently empty, so absence of numbers is not proof; report what the UI *offers*, e.g. whether a Compensation section or column exists at all.
6. **Crew+ → Incidents:** confirm a Crew user sees only their own reports, not everyone's.

Any case where a lower-privileged role can see something the table above says it shouldn't is the **highest-severity finding in this pass** — put it first in the report.

---

## 7. The report

Write `LIVE_VERIFICATION_REPORT.md` in the repo root.

Structure it as:

**1. Summary** — one paragraph: what you checked, what you could not, and the single most important finding.

**2. Findings table**, most severe first:

| # | severity | app | where | expected | observed | screenshot |
|---|---|---|---|---|---|---|

Severity: `critical` (data loss, or a role seeing data it must not), `major` (a feature does not work), `minor` (cosmetic/layout), `note` (works, worth knowing).

**3. Checklist results** — every numbered step from sections 3–6 with `PASS` / `FAIL` / `BLOCKED` / `SKIPPED` and one line of evidence each. A `PASS` must cite what you actually saw, e.g. *"fleet row read `No mileage yet · last service not recorded`"*, not *"looked fine"*.

**4. Console and network** — every page error, `console.error`, and HTTP ≥ 400, with the page it occurred on. State explicitly if there were none.

**5. Open questions answered** — give a direct answer to each:
   - How many certificate records show `(not stored)` versus an openable link?
   - Can a Manager reach any wage or compensation figure or UI?
   - Are prices hidden from Crew in Inventory and Tremco?
   - Did the Crew+ login work for the Manager and Crew accounts with their temporary passwords?

**6. Anything you were asked not to fix** — list defects found, so the next pass can pick them up.

Do not commit the report. Leave it in the working tree for review.
