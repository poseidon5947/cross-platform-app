# Live verification report — pass 4

Date observed: 2026-09-24. Apps: Warehouse Wizard and Crew+ on the live workers. Accounts used: admin `jrogers@vanislecoatings.com` (J. Rogers), manager `jdares@vanislecoatings.com` (Jesse), crew `jgregoire@vanislecoatings.com` (Jon). No application code was changed. Records created this pass use the marker `ZZTEST4` and are listed in `CLEANUP_MANIFEST_V4.md`.

**Did offline work survive a reload? No.** With the browser offline, a 1-unit material log showed "Saved offline. It will sync when connection returns." and "1 pending sync", and the on-hand count dropped from 104 to 103 on screen. A reload while still offline cleared the pending indicator and the saved queue. After the connection returned there was no "Pending sync complete", no transaction, and the stock was 104 again. A truck task ticked offline was also unticked after the same kind of reload. The daily-log sentence itself did stay in recent logs.

**Is the points-feed endpoint still closed? Yes.** An unauthenticated GET returned `401` and `{"error":"Unauthorized"}`. The body had no email address and no person's name.

## Findings

| # | severity | app | where | expected | observed | screenshot |
|---|---|---|---|---|---|---|
| 1 | critical | Warehouse Wizard | Daily Log, crew, offline | A 1-unit log queued offline survives a hard reload, then syncs once. Stock moves by exactly 1. | Tremco BG Grip Tape 6"x75' (8 Roll) was 104 on hand. Offline submit showed "Saved offline. It will sync when connection returns." and "1 pending sync", and the row showed 103. After reload, still offline, the subtitle was "Fast crew flow with offline sync" with no pending count, and the offline-queue storage key was gone. Back online there was no "Pending sync complete" and no transaction post. After another reload the stock was 104 and Home "Units out today" was 0. The use was dropped, not applied twice. | `v4-ww-6-4-saved-offline-message.png`, `v4-ww-6-6-after-offline-reload.png`, `v4-ww-5-manager-tremco.png` |
| 2 | critical | Warehouse Wizard | Tasks, crew, offline | Ticking one truck task offline survives a reload and stays ticked once after reconnect. | "Cleanup supplies" was ticked while offline. The header said "1 pending sync". The checkbox then drew empty again while that pending line was still there. After reload, still offline, Home said 14 truck tasks remaining and 0/14 complete, and the queue was gone. After reconnect the box was still empty and there was no "Pending sync complete". | `v4-ww-6-task-pending-offline.png`, `v4-ww-6-task-after-reload.png` |
| 3 | major | Warehouse Wizard | Admin → CSV Importer | The two-row file updates Backer Rod's cost to 9.99, leaves its quantity alone, and creates ZZTEST4 Import Probe at quantity 7. | The importer reported "0 imported; 2 skipped". Backer Rod stayed 0 on hand at $0.00/Roll. It did not become 999. ZZTEST4 Import Probe was not in inventory. The screen does not say why the rows were skipped. | `v4-ww-7-csv-result.png`, `v4-ww-7-backer-after.png` |
| 4 | note | Warehouse Wizard | Daily Log | The material movement is the offline payload. | Two recent logs both read "ZZTEST4 offline test" for Etro - Hyatt on 2026-09-24, Waterproofing, Jon. Those sentences remained after reload. The matching stock movement did not. | `v4-ww-6-6-logs-no-pending.png` |
| 5 | note | Crew+ | Reviews, manager | A marked KPI stays a Hit pill. | Safety incidents changed from "Mark hit +10" to Hit, toast "KPI marked hit. +10 points.", and still read Hit after reload. Logging accuracy was already Hit from an earlier pass and was not clicked again. | `v4-crew-8-kpi-hit.png` |
| 6 | note | Crew+ | Feedback, crew | Peer recognition points reach the recipient without a raw status-code toast. | Toast was "Sent." Bobby on the company leaderboard went from 110 pts to 120 pts. Jon stayed 530. Both were the same after reload. The feed still showed "ZZTEST4 peer recognition" from Jon, 2026-09-24. No "non-2xx" or "status code" wording appeared. | `v4-crew-8-bobby-110.png`, `v4-crew-8-sent.png` |

## Offline table

| step | action | message shown | survived reload | synced on reconnect | final stock delta |
|---|---|---|---|---|---|
| 6.1 | Online, crew, Daily Log. Material chosen: Tremco BG Grip Tape 6"x75' (8 Roll). | On-hand line: "104 Roll on hand". | — | — | — |
| 6.2–6.4 | Offline. Work completed and to do next time set to `ZZTEST4 offline test`. Plus one unit. Submit. | "Saved offline. It will sync when connection returns." and "Daily log submitted". Header: "1 pending sync". On-hand line became 103. Queue stored one `log_materials` command of quantity 1. | — | — | local −1 |
| 6.5–6.6 | Reload while `navigator.onLine` was still false. | Subtitle returned to "Fast crew flow with offline sync". No pending count. Storage key `warehouse-wizard-offline-queue-v1` was absent. | No. The pending material use was gone. The two `ZZTEST4 offline test` log lines were still in recent logs. Grip tape on hand read 104. | — | back to 0 versus the starting 104 |
| 6.7–6.9 | Back online, then reload again. | No "Pending sync complete". Home "Units out today" stayed 0. | — | No transaction sync observed. | 0. Stock still 104. Not 102. |
| 6 task | Offline, tick "Cleanup supplies" on the Ford F150 start-of-day list. | Header "1 pending sync". The row class was `task done` immediately, then the checkbox drew empty while the queue still held one `complete_task`. | No. After reload: 14 remaining, 0/14 complete, queue empty, box not ticked. | No. Still unticked. No "Pending sync complete". | n/a |

An earlier submit in the same session, before the controlled reload above, also left a `ZZTEST4 offline test` daily log and left the grip-tape stock at 104. That is why recent logs show two of those lines.

## Checklist

### Section 3 — closed endpoints

| step | result | evidence |
|---|---|---|
| 3.1 points-feed | PASS | `401` `{"error":"Unauthorized"}`. No `@vanislecoatings.com` address and no name. |
| 3.2 award-points | PASS | `405` `{"error":"POST required"}`. |
| 3.2 materials-import | PASS | `405` `{"error":"POST a CSV file body."}`. No material data. |
| 3.2 send-push | PASS | `405` `{"error":"POST required"}`. |
| 3.2 run-nudges | PASS | `401` `{"error":"Unauthorized"}`. |
| 3.2 quickbooks-sync | PASS | `401` `{"error":"Unauthorized"}`. |
| 3.2 quickbooks-oauth | PASS | `401` body `Unauthorized`. No token and no account data. |

### Section 5 — role gating

| step | result | evidence | screenshot |
|---|---|---|---|
| 5.1 crew Home | PASS | No "Losses (30d)" tile and no "Price changes" card. No `$` on the page. Same at 390, 768, and 1280. Page scroll width matched the viewport at 390 and 768. | `v4-ww-5-1-home-crew-1280.png`, `v4-ww-5-1-home-crew-390.png`, `v4-ww-5-1-home-crew-768.png` |
| 5.2 crew SKU chart | PASS | Inventory Health showed 121 / 113 / 104 and a bar list. No `$` and no "Total inventory value". | `v4-ww-5-2-sku-chart-crew.png` |
| 5.3 crew Need reorder | PASS | Reorder Alerts showed 104 out of stock and 113 below reorder. No "Est. reorder cost" and no `$`. | `v4-ww-5-3-reorder-chart-crew.png` |
| 5.4 crew Inventory and Tremco | PASS | Inventory listed counts and "Out" / "Reorder" with no `$`. Tremco listed quantities only. The words "Highest-value" appear; no dollar amount does. | `v4-ww-5-4-inventory-crew.png`, `v4-ww-5-4-tremco-crew.png` |
| 5.5 other crew `$` | PASS | Tools and Jobs also had no `$`. | — |
| 5 manager, same screens | PASS | Home has "Losses (30d) $0.00" and a Price changes card ("No material price changes flagged"). SKU chart shows "$166,961 TOTAL INVENTORY VALUE". Need reorder shows "$35,415 EST. REORDER COST". Inventory prices are present (SealBoss `$688.92/Drum`). Tremco prices are present (TremProof TP 260 `$989.97/Drum`). Grip tape still read 104. | `v4-ww-5-manager-home.png`, `v4-ww-5-manager-sku-value.png`, `v4-ww-5-manager-reorder.png`, `v4-ww-5-manager-tremco.png` |
| 5.6 crew KPIs | PASS | Mentoring contribution is a Hit pill. Quality on complex scopes is Not yet. No "Mark hit" button. | `v4-crew-5-6-kpis.png` |
| 5.7 crew Feedback | PASS | "Open the Google review link" is present. No "Confirm 5-star" and no "Written compliment". | `v4-crew-5-7-feedback.png` |
| 5.8 crew Certs | PASS | Jon's compliance block shows 0 urgent and 0 upcoming. There is no "Current +5" button. Certificate rows have "Save details +10"; that button was not clicked. | `v4-crew-5-8-certs.png` |
| 5.9 manager KPIs | PASS | "Mark hit +10" is present on Callback / rework rate, Crew jobs on schedule, and, before this pass's click, Safety incidents. Logging accuracy already read Hit. | `v4-crew-8-kpi-hit.png` |
| 5.10 manager Feedback | PASS | "Who earned it" lists Bobby, David, Desmond, Dominik, J. Rogers, J. Thorpe, Jacob, Jesse, Jon, Ken, Matthew Chester, Ray, Shane, Tara, and Vitalli. Confirm was not clicked. | `v4-crew-5-10-who-earned.png` |

### Section 6 — offline

| step | result | evidence | screenshot |
|---|---|---|---|
| 6.1–6.4 | PASS | Offline submit messages and the local 104 → 103 drop, above. | `v4-ww-6-1-stock-before.png`, `v4-ww-6-4-saved-offline-message.png` |
| 6.5–6.6 | FAIL | Pending material use was gone after reload while still offline. | `v4-ww-6-6-after-offline-reload.png`, `v4-ww-6-6-logs-no-pending.png` |
| 6.7–6.9 | FAIL | No sync. Stock stayed 104, a delta of 0. | manager Tremco still 104 in `v4-ww-5-manager-tremco.png` |
| 6 task | FAIL | Tick did not survive the offline reload and did not sync. | `v4-ww-6-task-pending-offline.png`, `v4-ww-6-task-after-reload.png` |

### Section 7 — material import

| step | result | evidence | screenshot |
|---|---|---|---|
| 7.1–7.2 | PASS | Admin, CSV Importer. Before import: Backer Rod 0 on hand, `$0.00/Roll`. Injection Resin 0 on hand, `$0.00/Drum`. | `v4-ww-7-csv-before.png` |
| 7.3 | PASS | The file was exactly the two rows named in the prompt: Backer Rod and ZZTEST4 Import Probe. | `v4-ww-7-csv-result.png` |
| 7.4 | PASS | Backer Rod stayed 0. It did not become 999. | `v4-ww-7-backer-after.png` |
| 7.5 | FAIL | Cost stayed `$0.00/Roll`. It did not become 9.99. The importer said "0 imported; 2 skipped". | `v4-ww-7-csv-result.png` |
| 7.6 | FAIL | Searching `ZZTEST4` in inventory returned no material. The probe was not created at quantity 7. | — |

### Section 8 — awards

| step | result | evidence | screenshot |
|---|---|---|---|
| 8.1–8.3 | PASS | Recognition to Bobby, message `ZZTEST4 peer recognition`. Toast "Sent." Bobby 110 → 120. Jon stayed 530. No raw status-code toast. | `v4-crew-8-bobby-110.png`, `v4-crew-8-sent.png` |
| 8.4 | PASS | After reload the feed line was still there and Bobby was still 120. | — |
| 8.5–8.7 | PASS | Manager marked Safety incidents. The row became Hit. After reload it still read Hit. | `v4-crew-8-kpi-hit.png` |
| 8.8 | PASS | Recorded in the cleanup manifest. Jesse's header on Bonus read 295 pts (285 before this click, plus 10). | `v4-crew-9-manager-bonus.png` |

### Section 9 — compensation

| step | result | evidence | screenshot |
|---|---|---|---|
| 9.1–9.4 | PASS | Admin Bonus shows "Compensation (admin/HR only)" and "Whose record". The dropdown lists 15 people, including "J. Rogers (you)". Field names: Gross annual wages, Starting hourly wage, Last increase date, Last increase — new hourly wage, Retention bonus amount, Retention bonus pay-out date, Cost of living increase. Every one of those inputs was empty. Nothing was typed and nothing was saved. | `v4-crew-9-admin-compensation.png` |
| 9.5 | PASS | Manager Bonus has no compensation section, no wage word, and no `$` figure. Copy: "Trajectory only. Bonus dollars stay admin/CFO-only." | `v4-crew-9-manager-bonus.png` |

## Console and network

Unauthenticated function checks, no credentials sent:

| endpoint | status | body |
|---|---|---|
| points-feed | 401 | `{"error":"Unauthorized"}` |
| award-points | 405 | `{"error":"POST required"}` |
| materials-import | 405 | `{"error":"POST a CSV file body."}` |
| send-push | 405 | `{"error":"POST required"}` |
| run-nudges | 401 | `{"error":"Unauthorized"}` |
| quickbooks-sync | 401 | `{"error":"Unauthorized"}` |
| quickbooks-oauth | 401 | `Unauthorized` |

No on-screen error banner and no "Could not save" toast appeared on the pages exercised after sign-in. A continuous console hook was not kept across reloads, so this is not a full browser-console dump. `/favicon.ico` was ignored. QuickBooks Connect and Sync jobs were not clicked.

## Not fixed

- Offline material logs and offline task ticks are dropped by a reload. The pending indicator and the on-device queue are gone afterward, and reconnect does not replay them. Stock does not move.
- While still offline, a task can show "1 pending sync" and an empty checkbox at the same time.
- The CSV named for this pass (`Item,Unit,Cost,On hand`, two rows, no category) is skipped in full. Existing quantity is left alone, and the cost update and the new-material opening quantity do not happen either. The importer does not show the skip reason.
