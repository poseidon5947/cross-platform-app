# Live verification report — pass 2

Checked Warehouse Wizard, Crew+, and SOP+ in the browser on 23 Sep 2026 against the live worker URLs. Admin, manager, and crew accounts were used only where a step required that role. Crew+ could not be used after sign-in: the signed-in shell unmounts. Because of that, Crew+ persistence (time off, incident, policy, recognition, forms), the certificate upload, the Bonus page, the sidebar, the 390 bottom bar, and the Admin importer were not exercised. No application code was changed.

The most important finding is that Crew+ goes blank immediately after a successful sign-in. The console error is React minified error #310 (`Rendered more hooks than during the previous render`) inside the app shell, at a `useState` that runs only after the loading and sign-in returns. It was observed for Admin and for Manager. It is not the previous `floorsCaps` crash.

## Findings

| # | severity | app | where | expected | observed | screenshot |
|---|---|---|---|---|---|---|
| 1 | critical | Crew+ | After sign-in, any page | Signed-in shell, including Bonus | Blank page. `#root` is empty. Console: `Uncaught Error: Minified React error #310` at `useState` in the app shell (`$t` in `index-DGSS3Qs4.js`). Seen for Admin and Manager. Login screen itself renders. | `live-verification-screenshots/v2-crew-4-4-blank-after-signin-1280.png`, `live-verification-screenshots/v2-crew-manager-blank-1280.png` |
| 2 | critical | Warehouse Wizard | Daily log submission | Toast, then the ZZTEST row still in Daily Log history after reload | Toasts `Log submitted` and `Daily log submitted`. ZZTEST was absent from crew "Your recent daily logs" before reload and after reload, absent from admin "All daily logs", and absent from Reports → Daily Log. That report, month cleared, still lists **67** rows and the newest is still 2026-09-02. The inventory line created with the submit did persist: `use 1 Unit Screws`, Jon, Etro - Hyatt, 1312 Broad Street (AKA Durwest), 2026-09-23. Table that did not show the log: `daily_logs`. | `live-verification-screenshots/v2-ww-5-8-dailylog-missing-after-reload.png` |
| 3 | major | SOP+ | 390 and 768 | Admin reachable | Sidebar nav buttons measure 0×0. Bottom bar is Home, Library, Build, Review. Admin is not in that bar. | `live-verification-screenshots/v2-sop-build-dark-390.png`, `live-verification-screenshots/v2-sop-build-dark-768.png` |
| 4 | minor | Warehouse Wizard | Tasks → Warehouse, 390 | Category chips fully visible | Frequency row wraps and is fully on screen (Daily through As needed). Category chips `Tools & Material Cleaning`, `Bathroom`, and `Inventory` extend past 390px inside a nowrap row. Page `scrollWidth` equals 390. | `live-verification-screenshots/v2-ww-tasks-warehouse-light-390.png` |
| 5 | minor | SOP+ and Warehouse Wizard | 390 | Tappable controls at least 44px tall | SOP+ suite links about 31px, theme and bottom-nav buttons about 38px, step buttons 38px. Warehouse frequency chips 38px. Bottom nav items on Warehouse are about 49px. | `live-verification-screenshots/v2-sop-build-dark-390.png` |
| 6 | note | Warehouse Wizard | Daily Log history | 67 logs listed | Month filter cleared, label `Month (showing all)`. The list shows the newest **50** (oldest visible 2026-08-13). Reports → Daily Log with the month cleared shows **67**. Not empty. | `live-verification-screenshots/v2-ww-4-1-daily-log-1280.png`, `live-verification-screenshots/v2-ww-4-2-reports-daily-log-1280.png` |
| 7 | note | Warehouse Wizard | Bottom nav, 390 | Reports and Admin reachable | Home through Jobs fit. Reports and Admin sit at x 381–501. The tab strip itself scrolls (`overflow-x: auto`, scroll width 507, client width 390). The page does not scroll sideways. | `live-verification-screenshots/v2-ww-tasks-warehouse-light-390.png` |
| 8 | note | Warehouse Wizard | Crew home | Prices hidden on Inventory and Tremco | Those two pages have no `$` amounts. Home still shows `Losses (30d) $0.00`. Tremco shows `Export Tremco log for CFO` to crew. It was not clicked. | `live-verification-screenshots/v2-ww-7-crew-tremco-dark-1280.png` |

## Checklist

### Section 4 — regressions (Admin unless noted)

1. **PASS.** Warehouse Wizard → Daily Log, month filter cleared (`Month (showing all)`). History lists logs. Newest 50 are on this page; it is not empty. Screenshot `v2-ww-4-1-daily-log-1280.png`.
2. **PASS.** Reports → Daily Log, month cleared. 67 log rows, newest 2026-09-02, no empty state. Screenshot `v2-ww-4-2-reports-daily-log-1280.png`.
3. **PASS.** With the month cleared, neither `Nothing logged for this month.` nor `No daily logs yet.` appeared, because logs are listed.
4. **FAIL.** Crew+ Bonus was not reachable. After sign-in the whole app is blank (finding 1). The `floorsCaps` message was not the error this time.
5. **BLOCKED.** Crew+ sidebar at 1280 was not visible. The signed-in shell does not render.
6. **BLOCKED.** Crew+ at 390 was not reachable past the login screen.
7. **BLOCKED.** Crew+ Admin tab was not visible for Admin, Manager, or Crew because the signed-in shell does not render. Manager and Admin were both signed in and both got a blank page. Crew was not given a separate Crew+ sign-in after that, because the failure is in the shared shell before any tab renders.
8. **BLOCKED.** Data intake importer was not opened. The signed-in Admin shell does not render.

### Section 5 — persistence

1. **BLOCKED.** Crew+ Time Off. Signed-in Crew+ does not render. Nothing created.
2. **BLOCKED.** Crew+ incident, no photo. Nothing created.
3. **BLOCKED.** Crew+ policy acknowledgment. Nothing created.
4. **BLOCKED.** Crew+ recognition. Nothing created. This flow also always writes a points event in the app code, so it would have stayed blocked even if the shell had rendered.
5. **BLOCKED.** Crew+ form submission. Nothing created.
6. **PASS.** Warehouse Wizard maintenance request as crew. Toast `Maintenance request submitted`. Listed before reload and after reload under Tasks → Maintenance requests. Screenshot `v2-ww-5-6-maintenance-after-reload.png`.
7. **PASS.** One truck task marked done: `Hammer drill batteries charged` on Ford F150 XL SuperCab 4WD (2011) - LY1180, Gas Station Check, Start of Day. Progress went from 0% to 7%. After reload the row still has class `task done` and Home says `13` truck tasks remaining and `1/14 daily tasks complete today`. No free-text field on this control. `Mark all shown done` was not used.
8. **FAIL.** Daily log as crew. See finding 2. Confirmation was shown. The ZZTEST daily log row was not in the list before reload and not after reload, for crew or admin.

Certificate photo upload: **BLOCKED.** Crew+ Certs cannot be opened. No file was uploaded.

### Section 6 — UI/UX

Checked pages, not every screen in every app:

- SOP+ Home and Build, light and dark, 1280. Build dark at 768 and 390.
- Warehouse Wizard Daily Log and Reports at 1280 (auto theme, light-looking header). Tasks → Warehouse at 390, light and dark.
- Crew+ login renders. Signed-in Crew+ could not be checked at any width or theme.
- Warehouse Wizard was not separately measured at 768.

1. **PASS** on the pages measured. `document.documentElement.scrollWidth` was not greater than `window.innerWidth` (SOP+ 1280/768/390, Warehouse Tasks at 390, Warehouse at 1280).
2. **FAIL** for Warehouse category chips at 390 (finding 4). Frequency row on that same page is fully visible. SOP+ Build text at 1280 was not cut off inside its boxes (`scrollWidth` did not exceed `clientWidth` on the sampled text).
3. **PASS** on the dark pages that rendered. SOP+ Build textareas in dark theme are dark text (`rgb(19, 33, 53)`) on white, including prefilled step text. Warehouse Tasks dark theme: task labels are light on the dark card and readable. Screenshot `v2-sop-build-dark-1280.png`, `v2-ww-tasks-warehouse-dark-390.png`.
4. **FAIL** at 390 for the controls in finding 5.
5. **PASS** on alignment for the pages screenshotted, aside from the chip overflow and the SOP+ bottom bar omitting Admin.
6. **PASS** where an empty state was on screen. SOP+ Review queue: `No SOPs waiting for approval.` Warehouse maintenance before the test row: `No open maintenance requests.`
7. Crew+ shows `Loading Crew+ from Supabase...` and then the root is cleared (finding 1). No other error flash was captured.

### Section 7 — role separation

**Manager, Warehouse Wizard.** Nav: Home, Daily Log, Tasks, Tools, Inventory, Jobs, Reports, Admin. Header `Jesse · manager`. Inventory shows prices (101 `$` amounts; SealBoss row includes `$688.92/Drum`). Admin opens. CSV file input is `disabled` (`type=file`, accept `.csv,text/csv`). `Connect QuickBooks` and `Sync jobs` are `disabled`. They were not clicked. Screenshots `v2-ww-7-manager-csv-1280.png`, `v2-ww-7-manager-quickbooks-1280.png`. The Admin → Crew tab lists other people and their point totals. That is points, not a wage field.

**Manager, Crew+.** Sign-in succeeds, then the page is blank (finding 1). Wage, compensation, and incident views could not be opened.

**Crew, Warehouse Wizard.** Nav: Home, Daily Log, Tasks, Tools, Inventory, Jobs. No Reports, no Admin. Header `Jon · crew`. Inventory and Tremco show quantities and units, and no `$`. Home shows `Losses (30d) $0.00`. `Export Tremco log for CFO` is visible and was not clicked. Screenshot `v2-ww-7-crew-tremco-dark-1280.png`.

**Crew, Crew+.** Not signed in separately. Admin and Manager both blank the same shell before tabs render, so Crew+ role checks for crew (own incidents only, no Admin tab) were not observed.

## Persistence table

| flow | confirmation | visible before reload | visible after reload | verdict |
|---|---|---|---|---|
| Crew+ Time Off | none | no | no | BLOCKED, nothing created |
| Crew+ incident, no photo | none | no | no | BLOCKED, nothing created |
| Crew+ policy acknowledgment | none | no | no | BLOCKED, nothing created |
| Crew+ recognition | none | no | no | BLOCKED, nothing created |
| Crew+ form | none | no | no | BLOCKED, nothing created |
| WW maintenance request | `Maintenance request submitted` | yes, Tasks → Maintenance requests, 1 open | yes, same text, Home count `Open maintenance requests 1` | PASS |
| WW mark one task | checkbox checked, progress `7%` | yes | yes, `task done`, Home `1/14` | PASS |
| WW daily log | `Log submitted` and `Daily log submitted` | no ZZTEST row in Your recent daily logs | no ZZTEST row for crew or admin; Reports still 67 | FAIL, `daily_logs` |
| Crew+ cert photo | none | no | no | BLOCKED, nothing uploaded |

The daily-log submit also wrote an inventory transaction that is still on Home recent activity after reload: `use 1 Unit Screws`, Jon, Etro - Hyatt, 2026-09-23. That line is real even though the daily log row is not.

## Console and network

Crew+ after Admin sign-in: `Uncaught Error: Minified React error #310` (`https://react.dev/errors/310`), stack in `vendor-react-BLP8_Mi2.js` and `index-DGSS3Qs4.js` function `$t`. The same blank page occurred for Manager; the console hook did not capture a second copy of the message. During the crashed Crew+ load, the app script and the Supabase reads that were recorded (`profiles`, `crew_value`, `crew_bonus_config`, and the other crew tables) returned HTTP 200. No other console error was captured. Favicon 404s were ignored. A continuous console and network log was not attached to Warehouse Wizard or SOP+ for the whole pass.

## Not fixed

- Crew+ signed-in shell blanks with React error #310. Bonus, sidebar, mobile More sheet, Admin tab, and importer could not be rechecked.
- A new Warehouse Wizard daily log confirms in the UI and is missing from `daily_logs` after reload. Reports still shows 67, newest 2026-09-02.
- SOP+ Admin is not in the bottom bar at 390 or 768.
- Warehouse Wizard warehouse category chips still run past the 390px edge.
- Several 390px controls are shorter than 44px.
- Daily Log history on the Daily Log page still shows 50 rows while Reports shows 67.
