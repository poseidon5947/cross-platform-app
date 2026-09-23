# Live verification report

Date: 23 Sep 2026. Browser checks against the three live sites, signed in with the three accounts named in the prompt (Admin `jrogers@…`, Manager `jdares@…`, Crew `jgregoire@…`). No forms were submitted, no saves, no deletes, no role or points changes. The certificate upload in section 5 was not performed. SOP+ has no numbered steps in the prompt and was not walked.

The most important finding: a Manager in Warehouse Wizard can open **Admin** and sees the same Crew roster, CSV Importer, PO estimate, Quickbooks, and Settings segments as an admin, including a **Users & roles** heading. Separately, Crew+ **Bonus** crashes the whole app for an admin (`Cannot read properties of undefined (reading 'floorsCaps')`), and a Manager’s Onboarding form still shows an **Hourly wage** field.

Screenshots are in `live-verification-screenshots/`. The capture tool frames about 1061px of a 1280px viewport, so a right-edge control can look cut off in the image while still being on screen. Where that mattered, hit-testing at 1280px is what the checklist uses.

## 2. Findings

| # | severity | app | where | expected | observed | screenshot |
|---|---|---|---|---|---|---|
| 1 | critical | Warehouse Wizard | Admin, signed in as Jesse · manager | Record whether Admin appears. A manager should not have the admin console. | Admin is in the nav. It renders Crew (full roster and points), CSV Importer, PO estimate, Quickbooks, Settings, and a Users & roles heading. Nothing was changed. | `ww-6-manager-admin-1280.png` |
| 2 | critical | Crew+ | Onboarding, signed in as Jesse (Crew Lead) | No wage, hourly rate, or compensation UI for a Manager. | The New Employee Form includes an empty **Hourly wage** field next to First day of work. No dollar amount was filled in. The Submitted Onboarding list was not present. | `crew-6-manager-wage-1280.png` |
| 3 | major | Crew+ | Bonus, signed in as J. Rogers · admin | Bonus page renders. | Opening Bonus throws `Uncaught TypeError: Cannot read properties of undefined (reading 'floorsCaps')` and the React root goes blank. Reload restores Home. Not re-tested as Manager or Crew after the crash. | `crew-bonus-crash-1280.png` |
| 4 | major | Crew+ | Sidebar Admin, Manager and Crew | Record whether Admin appears. | Admin is in the sidebar for Jesse (Crew Lead) and for Jon (Senior Technician). Both see the Data intake importer, labeled **Read only**, with **Preview tab**. The team-roster status editor that admin sees is not in their view. | `crew-6-manager-admin-1280.png`, `crew-6-crew-home-1280.png` |
| 5 | major | Warehouse Wizard | Daily Log via Home → View all | Lands on Daily Log and shows history. | Sidebar Daily Log is selected and the heading is “Daily inventory log”. The month input is empty, the label says MONTH (SHOWING ALL), and the body says “Nothing logged for this month.” Home recent activity and Reports → Inventory Log both show September 2026 use lines. | `ww-3-4-view-all-1280.png` |
| 6 | major | Warehouse Wizard | Bottom nav at 390px | All eight tabs usable on a phone. | Home, Daily Log, Tasks, Tools, Inventory, and Jobs are on screen. Reports (left 381px) and Admin (left 441px) sit past the 390px edge. The nav is `overflow-x: auto`, so they can be scrolled to, with no visible cue. | `ww-home-390.png` |
| 7 | major | Crew+ | Bottom nav at 390px | Menu labels remain reachable. | The desktop sidebar is gone. The bottom bar shows only Home, Profile, Time Off, Incidents, and Certs. Onboarding, Wallet, Admin, and the other labels have no visible control. | `crew-4-2-sidebar-390.png` |
| 8 | minor | Warehouse Wizard | Tasks → Warehouse, 390px | Category chips wrap rather than cut off. “As needed” stays fully visible. | “As needed” wraps onto a second row and is fully inside the viewport (right edge 369px). Category chips are `flex-wrap: nowrap` and scroll; Tools & Material Cleaning, Bathroom, and Inventory start past 390px, and the next chip is cut at the edge. | `ww-3-6-warehouse-390.png` |
| 9 | note | Warehouse Wizard | Home header | Header shows `Jordan Rogers · admin`. | Header button reads `J. Rogers · admin`. At 390px only the JR avatar shows. | `ww-3-1-home-1280.png`, `ww-home-390.png` |
| 10 | note | Warehouse Wizard | Inventory → Materials | Production has 121 materials. | Home says SKUS TRACKED 121, 0 reference only. The All chip and the price rows count **101**. | `ww-3-3-reorder-inventory-1280.png` |
| 11 | note | Crew+ | Certs | Production has 17 certificate records. | 14 records, each with a Certificate photo or PDF picker. None show `(not stored)` and none show an openable attachment link. | DOM read on Certs; `crew-4-6-certs-1280.png` is a mis-timed shot of Admin, not Certs |
| 12 | note | Warehouse Wizard | Tremco as Crew | Prices hidden. | Prices are hidden. A button labeled **Export Tremco log for CFO** is still on the page. It was not clicked, so the file contents were not observed. | `ww-6-crew-tremco-1280.png` |
| 13 | note | Warehouse Wizard | Tasks → Warehouse | — | The line “Assign crew member to log into Warehouse Wizard and complete daily checks” appears twice in the daily list. | `ww-3-6-warehouse-freq-1280.png` |

## 3. Checklist

### Section 3 — Warehouse Wizard, Admin

1. **PASS.** Signed in as `jrogers@…` and landed on Home. Header reads `J. Rogers · admin`, not the full “Jordan Rogers”. `ww-3-1-home-1280.png`.
2. **PASS.** Nav buttons are exactly Home, Daily Log, Tasks, Tools, Inventory, Jobs, Reports, Admin.
3. **PASS.** Truck tasks remaining today (14) opens Tasks with the Trucks segment. Items below reorder threshold (113) opens Inventory → Materials with Reorder selected. Daily log items need review (140) opens Reports, scrolled so **Needs review** is in view (y ≈ 203), not Admin or Crew. `ww-3-3-trucks-1280.png`, `ww-3-3-reorder-inventory-1280.png`, `ww-3-3-needs-review-1280.png`.
4. **PASS** for the destination, **FAIL** for the history. View all opens Daily Log (“Daily inventory log”, sidebar Daily Log selected). The list says “Nothing logged for this month.” `ww-3-4-view-all-1280.png`.
5. **PASS.** Tasks segments are Trucks, Warehouse, Services. At 1280px Services’ right edge is 1242px and `elementFromPoint(1150, …)` hits it. `ww-3-5-tasks-segments-1280.png`.
6. **PASS** at 1280px for “As needed”; **partial** at 390px for chips. All six frequencies are present. At 1280px “As needed” right edge is 1242px and hit-testing returns that button. At 390px “As needed” is fully visible on row two. Category chips scroll instead of wrapping. `ww-3-6-warehouse-freq-1280.png`, `ww-3-6-warehouse-390.png`.
7. **PASS.** Six trucks. Every row reads `No mileage yet · last service not recorded`. No `1970-01-01`. `ww-3-7-fleet-1280.png`.
8. **PASS.** Ford F150 sheet shows Truck name, Current mileage (km), Last serviced, Last oil change (km), and Save truck. No gas-station receipts. Closed with x. Not saved. `ww-3-8-truck-sheet-1280.png`.
9. **PASS.** “Add new tool” opens a New tool form (name, service, cordless checkbox, Save tool). Closed with x. Not saved. `ww-3-9-add-tool-1280.png`.
10. **PASS.** Jobs renders Active jobs (Etro - Hyatt and others). No Past jobs section. `ww-3-10-jobs-1280.png`.
11. **PASS.** Three sub-tabs: Inventory Log, Tremco Log, Daily Log (Daily Log right edge 1242px, hit-tested). Below them: Needs review, then Exports (Print cost report, Copy transactions CSV, Copy Monthly Inventory Log CSV). `ww-3-11-reports-tabs-1280.png`, `ww-3-11-reports-exports-1280.png`.
12. **PASS.** Five segments, each with its own content: Crew (roster), CSV Importer (file picker), PO estimate (113 lines, subtotal shown), Quickbooks (Connect QuickBooks / Sync jobs, not clicked), Settings (Theme Customization). `ww-3-12-admin-*.png`.
13. **PASS** that materials load and prices are visible to admin (`$688.92/Drum` on SealBoss and others). **Count is 101**, not 121. Reorder attention link landed with the Reorder filter on; All 101 still reads 101 after clearing it.

Phone Home also checked: `ww-home-390.png`.

### Section 4 — Crew+, Admin

1. **PASS.** Signed in and landed on Home as J. Rogers, CEO / Owner. `crew-4-1-home-1280.png`.
2. **PASS** at 1280px. Sidebar labels (Home through Admin) are left-aligned (`text-align: left`, label x = 32px), not teal pills on the right edge of the button.
3. **Note.** No count badge was visible on Rewards or Admin, so the teal-pill-on-the-right case was not present to check. Compliance flags show as a Home row (17), not a sidebar badge.
4. **PASS.** Three visible file inputs: Direct deposit form (from your bank), Front, Back. Not submitted. The form also shows Hourly wage, which is expected for admin. `crew-4-4-onboarding-files-1280.png`.
5. **PASS.** Damage and Incident Report includes a Photo file input. Submitted Reports says “No incident reports yet.” and “0 visible”. Not submitted. `crew-4-5-incidents-1280.png`.
6. **FAIL** against the expected count of 17. 14 records loaded, each with a Certificate photo or PDF picker:
   - J. Thorpe: Confined Spaces, Fit Test (respirator), Level 1 First Aid, Lift Operation (all active)
   - Jesse: Fit Test (date_needed), Hearing test, Level 1 First Aid (date_needed), Lift Operation, WHMIS
   - Jon: Confined Spaces, Fit Test, Level 1 First Aid, Lift Operation
   - Shane: Lift Operation
   - Bobby, David, Dominik, Jacob, Ken, Ray, Vitalli: “No certifications yet.”
   - `(not stored)` count: **0**. Openable attachment links: **0**.
7. **PASS.** Button text is **Preview tab**. Copy says the result “previews in your session only and a reload clears it”. Not clicked and no CSV pasted. `crew-4-7-admin-importer-1280.png`.
8. **PASS.** No HSA banner on Home. Page text has no HSA / health-spending match.

At 390px the sidebar labels are replaced by five bottom tabs (`crew-4-2-sidebar-390.png`). Finding 7.

### Section 5 — attachment round trip

**SKIPPED — write step.** Not attached. The certificate card’s save control is “Save details +10”, and there is no delete. A throwaway file was not uploaded.

### Section 6 — Manager (`jdares@…`) and Crew (`jgregoire@…`)

Both temporary passwords signed in. Warehouse Wizard shows `Jesse · manager` and `Jon · crew`. Crew+ shows Jesse as Crew Lead and Jon as Senior Technician.

**Manager — Warehouse Wizard**

1. Nav includes Home, Daily Log, Tasks, Tools, Inventory, Jobs, Reports, and **Admin**. Admin is fully populated. Finding 1. `ww-6-manager-admin-1280.png`.
2. Inventory prices are visible (`$688.92/Drum` and others). The prompt only requires them hidden from Crew. `ww-6-manager-inventory-1280.png` (shot raced and still shows Materials; the price text was read from the live page).
3. Tremco prices are visible (`$989.97/Drum` on TremProof TP 260). `ww-6-manager-tremco-1280.png`.

**Manager — Crew+**

1. Same sidebar as admin, including **Admin**. Admin content is the read-only data intake importer, not the roster editor. `crew-6-manager-home-1280.png`, `crew-6-manager-admin-1280.png`.
2. Onboarding does **not** show “Submitted Onboarding (Admin/HR)”. It does show Hourly wage. Finding 2.
3. Home says “Trajectory is visible to everyone. Dollars stay admin/CFO-only.” No dollar compensation figure was on Home. Bonus was not opened for this user after the admin crash.
4. Incidents copy: “Manager/admin view shows all submitted reports.” List: “No incident reports yet.”

**Crew — Warehouse Wizard**

1. Nav is Home, Daily Log, Tasks, Tools, Inventory, Jobs. **No Admin and no Reports.** The restored Admin route shows “Manager or Admin access required.”
2. **PASS.** Inventory prices are hidden. SealBoss reads `reorder 3 · Drum · Vendor: Cascade` with no dollar amount. `ww-6-crew-inventory-1280.png`.
3. **PASS.** Tremco prices are hidden (`reorder 3 · Drum`, no `$`). `ww-6-crew-tremco-1280.png`.

**Crew — Crew+**

1. Sidebar includes Admin. Opening it shows the same read-only Data intake importer. `crew-6-crew-home-1280.png`.
2. Onboarding has an Hourly wage field on Jon’s own form and does not show the Submitted Onboarding list.
3. Incidents copy: “Crew view shows reports you submitted.” List: “0 visible / No incident reports yet.” With zero reports, this confirms the label, not a filtered non-empty list.

## 4. Console and network

- Warehouse Wizard, after an in-page collector was installed post-login: no `console.error`, no uncaught error, and no resource-timing entry with status ≥ 400. `/favicon.ico` was not separately confirmed.
- Crew+ Bonus, admin: one uncaught error, `Cannot read properties of undefined (reading 'floorsCaps')`, then a blank document. `crew-bonus-crash-1280.png`.
- No other `console.error` was observed on the Crew+ pages that stayed mounted (Home, Onboarding, Incidents, Certs, Admin). A full network log for every navigation was not captured; this section only reports what the page collector and that crash showed.

## 5. Open questions

- Certificate attachments: **0 `(not stored)`, 0 openable links**, across **14** records (prompt expected 17).
- Manager compensation UI: **yes**. Onboarding shows an **Hourly wage** field. No filled dollar amount was on that form. Home states dollars stay admin/CFO-only. Bonus could not be read because it crashes.
- Crew prices: **hidden** in both Inventory and Tremco. Unit words remain (Drum, Roll, Unit).
- Logins: **yes**. Manager `jdares@vanislecoatings.com` and Crew `jgregoire@vanislecoatings.com` both signed in with the temporary password, on Warehouse Wizard and on Crew+.

## 6. Not fixed

Left for a later pass:

- Warehouse Wizard Admin is available to the Manager, including Users & roles, CSV Importer, PO estimate, Quickbooks, and Settings.
- Crew+ Onboarding shows Hourly wage to the Manager (and to Crew, on their own form).
- Crew+ Bonus crashes on `floorsCaps`.
- Crew+ Admin nav and read-only importer are visible to Manager and Crew.
- Daily Log “View all” destination is empty while September activity exists on Home and Reports.
- Phone nav: Warehouse Wizard hides Reports and Admin until a horizontal scroll; Crew+ drops most sidebar items at 390px.
- Warehouse category chips scroll instead of wrapping at 390px.
- Inventory All count is 101 while Home says 121 SKUs.
- Cert records are 14, with no stored-file indicator.
- Header uses `J. Rogers · admin`.
- Crew still sees “Export Tremco log for CFO” (not opened).
