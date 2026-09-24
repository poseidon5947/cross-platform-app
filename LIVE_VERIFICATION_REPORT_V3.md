# Live verification report — pass 3

Date observed: 2026-09-23. Apps: Warehouse Wizard, Crew+, SOP+ on the live workers. Accounts used: admin `jrogers@vanislecoatings.com` (J. Rogers), manager `jdares@vanislecoatings.com` (Jesse), crew `jgregoire@vanislecoatings.com` (Jon). No application code was changed. Records created this pass use the marker `ZZTEST3` and are listed in `CLEANUP_MANIFEST_V3.md`.

**Can a KPI hit be recorded? Yes.** Both the manager and the crew member got `201` on `POST /rest/v1/crew_kpi_result`. That is not the `42501` policy failure. The Reviews row itself never changes: it still says `Mark hit +10` before and after a hard reload, so the screen does not read "hit" or "not started". The manager's points did stick (275 → 285, still 285 after reload). The crew member's points did not: `POST /functions/v1/award-points` returned `403` with `{"error":"This award requires manager/admin approval"}`, and the balance stayed 510.

Crew+ signed in and rendered for all three roles. The pass 2 blank shell (React error #310) did not recur. Bonus rendered. A new Warehouse Wizard daily log with `ZZTEST3` was still in history after a hard reload.

## Findings

| Severity | Where | What happened |
| --- | --- | --- |
| Major | Crew+ Reviews, crew account | Marking **Mentoring contribution** stored the KPI row (`201` on `crew_kpi_result`) and then `award-points` returned `403` `This award requires manager/admin approval`. Balance stayed 510 through a hard reload. The same `403` happened on peer recognition (`Edge Function returned a non-2xx status code` in the header). The recognition row itself saved. |
| Minor | Crew+ Reviews, both roles | The KPI control stays `Mark hit +10` after a successful write and after reload. There is no hit state and no "not started" label on the row. |
| Minor | Crew+ Wallet ledger | The ledger on screen is the oldest events (July–early September). Jesse's KPI +10 and Jon's ritual +10 are in the balance and the leaderboard, and they are not in that ledger list. |
| Note | Warehouse Wizard home, crew | Crew Inventory and Tremco showed no `$` prices. Crew home still shows `Losses (30d) $0.00`. |
| Note | Crew+ Wallet | The quarter board does not print "Jul–Sep 2026". The caption is "Quarterly race resets; wallet balance carries over." Figures are not all zero. |

Manager company-feedback privacy held. Jesse's panel said "No feedback submitted yet" and did not contain Jon's `ZZTEST3` message. Admin's "Company feedback received" list showed that same message attributed to Jon.

## Persistence

| Flow | Confirmation | Before reload | After reload | Write | Verdict |
| --- | --- | --- | --- | --- | --- |
| Manager KPI: Logging accuracy | No toast captured. Header 275 → 285 pts. | Row still `Mark hit +10`. Points 285. | Points still 285. Row still `Mark hit +10`. | `201 POST /rest/v1/crew_kpi_result`. `award-points` was called; its status was not captured. Points survived reload. | PASS for the stored hit. The row label does not show it. |
| Crew KPI: Mentoring contribution | No toast. Points stayed 510. | Row still `Mark hit +10`. | Points still 510. Row still `Mark hit +10`. | `201 POST /rest/v1/crew_kpi_result`. `403 POST /functions/v1/award-points` body `{"error":"This award requires manager/admin approval"}`. Not `42501`. | PASS for the result row. FAIL for the points award. |
| Company feedback | Toast `Thanks - that's gone to the admin team.` | "Your feedback" showed `You` / `ZZTEST3 company feedback from live verification` / 2026-09-23. Peer box stayed empty while this was typed. | Same line still there. Points 520. | `201 POST /rest/v1/crew_feedback`. `200 POST /functions/v1/award-points`. | PASS |
| Peer recognition to Bobby | Toast `Sent.` Later header toast `Edge Function returned a non-2xx status code`. | Feed: Bobby, `ZZTEST3 peer recognition from live verification`, from Jon - 2026-09-23. Company box stayed empty. | Same feed line. Jon's points stayed 520 (the award is for the recipient). | `201 POST /rest/v1/crew_recognition`. `403 POST /functions/v1/award-points` (body not captured). | PASS for the feed row. Points award rejected. |
| Time off | No toast. History line appeared and paid sick left went 5 → 4.5. | `paid sick`, `0.5 days`, `2026-09-23 - ZZTEST3 time off from live verification`. Vacation was disabled because vacation left was TBD, so this was paid sick. | Same line, 4.5 paid sick left. | `POST /rest/v1/crew_time_off_entry` was sent. HTTP status number was not captured. No save-error banner. | PASS |
| Incident, no photo | Toast was not still on screen when checked. List updated immediately. | Submitted Reports, crew copy "Crew view shows reports you submitted.", 1 visible, `ZZTEST3 yard` / `ZZTEST3 test cause` / `ZZTEST3 incident from live verification`, Unconfirmed, awaiting Crew Lead or Owner. | Same report still the only visible crew report. | `POST /rest/v1/crew_incident_report` was sent. Status number not captured. No save-error banner. | PASS |
| Policy acknowledgment | Toast `Policy acknowledged`. | Workplace Bullying and Harassment Policy Statement: `Signed by Jon ZZTEST3 on 2026-09-23.` | Certs was not reopened after the later hard reload. | `POST /rest/v1/crew_policy_acknowledgment` was sent. Status number not captured. No save-error banner. | Write shown immediately. Reload of this screen was not repeated. |
| Form (Quarterly SWOT) | On-screen status `Submitted` and `Submitted 2026-09-23. Your next form opens for the following quarter.` Due 2026-09-30. Toast text was not still visible. | Form closed as submitted. Points stayed 520. | Forms was not reopened after the later hard reload. | `POST /rest/v1/crew_form_submission` was sent. Status number not captured. No save-error banner. | Write shown immediately. Reload of this screen was not repeated. |
| WW maintenance | No toast still visible. List went to 2 open. | `ZZTEST3 maintenance request from live verification`, Ford F150 XL SuperCab 4WD (2011) - LY1180, Requested by Jon - 2026-09-24. The older `ZZTEST` request from 2026-09-22 is still there and was not edited. | Same two open requests after reload. | `POST /rest/v1/maintenance_request` was sent. Status number not captured. No sync-failed toast. | PASS |
| WW daily log | History updated immediately. No sync-failed toast. | Your recent daily logs: Etro - Hyatt, 1312 Broad Street (AKA Durwest), 2026-09-23, Waterproofing, Jon, `ZZTEST3 daily log from live verification`. | Same line still first in recent logs after hard reload. Home "Units out today" read 2. | `POST /rest/v1/daily_logs` and a transactions insert were sent. Status numbers not captured. | PASS |
| Ritual: Clear, weekly Monday 6:30am crew meeting value-share | Toast `Nice work. +10 points.` | Clear changed from `Complete +10` to a Done pill. Helpful and Professional stayed `Complete +10`. Points 520 → 530. The Clear button was gone, so a second click was not possible. | Done pill still there. Points still 530. | `POST /functions/v1/award-points` was sent. Status number not captured. Balance survived reload. | PASS for Done and the balance. The ledger list did not show this award. |

## Checklist

### Section 4 — KPI hit

4.1 Manager Reviews KPIs — PASS. Crew Lead: Callback / rework rate (%), Crew jobs on schedule (%), Logging accuracy (%), Safety incidents (count). Each showed `Mark hit +10`. No hit or not-started label. `v3-crew-4-kpis-manager-before.png`.

4.2 Manager Mark hit — PASS for the write. Clicked Logging accuracy. Points 275 → 285. No toast captured. `201` on `crew_kpi_result`. `v3-crew-4-kpi-after-click.png`.

4.3 Manager after reload — PASS for stored points. Still 285. The row still says `Mark hit +10`.

4.4 Crew Reviews KPIs — PASS. Senior Technician: Mentoring contribution (count), Quality on complex scopes (%). Both `Mark hit +10`. `v3-crew-4-kpis-crew-before.png`.

4.5 Crew Mark hit — PASS for the row, FAIL for points. Mentoring contribution. `201` on `crew_kpi_result`. `403` on `award-points` with `This award requires manager/admin approval`. Points stayed 510.

4.6 Crew after reload — Points still 510. Row still `Mark hit +10`.

### Section 5 — regressions

5.1 WW Daily Log history — PASS. Month filter empty, label "Month (showing all)". Not empty. 50 dated rows on the page, newest 2026-09-02. `v3-ww-5-1-daily-log-1280.png`.

5.2 WW Reports → Daily Log — PASS. Month cleared. 67 lines containing `Waterproofing ·`. Newest 2026-09-02. Not empty. `v3-ww-5-2-reports-daily-log-1280.png`.

5.3 Crew+ Bonus — PASS. Crew: AMBER, 2026 period, 2% cap, dollar privacy "Private", no blank shell. Manager: AMBER, dollars hidden. Admin: AMBER, 0% cap, own compensation fields empty, estimated share `$0`. `v3-crew-5-3-bonus-1280.png`.

5.4 Crew+ sidebar at 1280 — PASS. Labels are flush left in plain buttons. Admin sits at the bottom of that list for the admin account. Not teal pills floated right. Visible in the 1280 Crew+ screenshots.

5.5 Crew+ at 390 — PASS. Bottom bar: Home, Profile, Onboarding, Time Off, Incidents, More. Measured heights 46px (More 45×46). Labels were fully readable. More opened a sheet (Wallet, Rituals, Reviews, Forms, Bonus, Certs, Rewards, Feedback, Admin, because this session was the admin). Choosing Wallet opened Wallet and the sheet closed. `v3-crew-5-5-bottom-390.png`. A separate 768 pass was not done.

5.6 Admin tab — PASS. Present for J. Rogers. Absent for Jesse. Absent for Jon.

5.7 Quarter leaderboard — PASS as a non-zero current board, with no printed quarter range. While Jesse was at 285: Jon 510, J. Thorpe 410, Jesse 285, Bobby 110, J. Rogers 35. After Jon's later awards the company board showed Jon 530. Caption does not say Jul–Sep 2026. `v3-crew-5-7-quarter-leaderboard-1280.png`.

5.8 SOP+ at 390 — PASS. Signed in as J. Rogers. Bottom bar Home, Library, Build, Review, Admin, each 46px tall. No page-level horizontal scroll. `v3-sop-5-8-tabs-390.png`.

### Section 6 — persistence

6.1 Company feedback — PASS. See the persistence table. The two textareas are independent. Crew saw only their own entry, labeled You. Admin saw it as Jon. Manager did not see it. `v3-crew-6-1-feedback-before-reload.png`, `v3-crew-6-1-feedback-after-reload.png`, `v3-crew-6-1-manager-feedback-hidden.png`, `v3-crew-6-1-admin-feedback-attributed.png`.

6.2 Peer recognition — PASS for the feed. Points award `403`. `v3-crew-6-2-recognition-before-reload.png`, `v3-crew-6-2-recognition-after-reload.png`.

6.3 Time off — PASS. `v3-crew-6-3-timeoff-before-reload.png`.

6.4 Incident — PASS. Crew list stayed one report after reload. A screenshot of the form included a prefilled phone number and was not kept.

6.5 Policy — Shown immediately with toast `Policy acknowledged`. Reload of Certs was not repeated after the later hard reload.

6.6 Form — Shown immediately as Submitted 2026-09-23. `v3-crew-6-6-form-before-reload.png`. Reload of Forms was not repeated.

6.7 WW maintenance — PASS. `v3-ww-6-7-maintenance-before-reload.png`, `v3-ww-6-7-maintenance-after-reload.png`.

6.8 WW daily log — PASS. The `ZZTEST3` line was still in "Your recent daily logs" after hard reload. The screenshot named `v3-ww-6-8-dailylog-before-reload.png` is the crew home (Units out today 2). `v3-ww-6-8-dailylog-after-reload.png` is Tasks still loading. The history text after reload is the evidence.

### Section 7 — one ritual

7.1 Before — PASS. Three weekly rituals, all `Complete +10`, all "Monday 6:30am crew meeting value-share": Clear, Helpful, Professional. Points 520.

7.2 Complete one — PASS. Clear. Toast `Nice work. +10 points.` Done pill. Points 530. `v3-crew-7-ritual-done.png` (the file named rituals-before was taken as the click landed and already shows Done).

7.3 Second click — PASS. No button remained on Clear, so it could not award again. Helpful and Professional were left alone.

7.4 After reload — PASS. Clear still Done. Points still 530.

7.5 Wallet — Balance 530 includes the +10. The visible ledger does not list a ritual reason; it still starts at SOP approved 2026-07-21.

### Section 8 — role separation

8.1 Nav — PASS for what was opened. Crew+ manager and crew: Home, Profile, Onboarding, Wallet, Rituals, Reviews, Forms, Time Off, Incidents, Bonus, Certs, Rewards, Feedback. No Admin. Crew+ admin adds Admin. WW crew: Home, Daily Log, Tasks, Tools, Inventory, Jobs. No Reports, no Admin. WW admin also has Reports and Admin.

8.2 Prices — Crew Inventory and Tremco: zero `$` amounts. Manager Inventory/Tremco was not reopened this pass: BLOCKED.

8.3 Other people's wages — PASS on the surfaces opened as manager. Onboarding was Jesse's own empty form (Hourly wage blank, no other names, no dollar amounts). Bonus said dollars stay admin/CFO-only. Admin Bonus shows J. Rogers's own empty compensation fields and `$0` estimated share. Those fields were not edited.

8.4 Crew incidents — PASS. Copy "Crew view shows reports you submitted." One report, Jon's `ZZTEST3` incident. Manager copy "Manager/admin view shows all submitted reports." also showed that one report, with a Confirm receipt button that was not clicked.

8.5 Manager feedback — PASS. "No feedback submitted yet." The recognition feed does show Jon's public `ZZTEST3` recognition of Bobby. That is the recognition feed, not the company-feedback panel.

8.6 WW Admin as manager — BLOCKED. Manager was not signed into Warehouse Wizard this pass, so CSV, Connect QuickBooks, and Sync jobs were not rechecked. They were not clicked.

## Console and network

No uncaught React error and no blank `#root` on Crew+. No `42501`.

HTTP ≥ 400 that was read:

- Crew KPI: `403 POST /functions/v1/award-points` `{"error":"This award requires manager/admin approval"}`.
- Crew recognition: `403 POST /functions/v1/award-points`. Header then showed `Edge Function returned a non-2xx status code`.

Other writes that were observed as sent, with the status number captured only where listed above: `crew_kpi_result` 201 (both roles), `crew_feedback` 201, feedback `award-points` 200, `crew_recognition` 201, `crew_time_off_entry`, `crew_incident_report`, `crew_policy_acknowledgment`, `crew_form_submission`, `maintenance_request`, `daily_logs`, transactions, ritual `award-points`. No `favicon.ico` 404 was separately recorded. Warehouse Wizard and SOP+ did not have a continuous console log.

## Not fixed, or only half fixed

- A KPI hit is stored, and the Reviews button does not show that it was stored.
- A crew member's own KPI points and peer-recognition points are rejected with `403` requiring manager/admin approval. The rows save.
- The wallet ledger on screen does not show the newest awards.
- Crew home still shows a `$0.00` losses figure. Inventory and Tremco prices stay hidden.

## Fixed since pass 2

- Crew+ renders after sign-in.
- Bonus renders.
- A new daily log stays in history after reload.
- Company feedback text is stored, visible to the writer and to admin, and hidden from the manager.
- Peer recognition text is stored in the feed.
- SOP+ at 390 includes Admin.
- The Admin tab is on the admin account and off the manager and crew accounts.
