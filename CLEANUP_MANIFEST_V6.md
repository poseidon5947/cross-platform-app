# Cleanup manifest — live re-test after fixes (marker `ZZTEST6`), 2026-09-24

Live production URLs, deployed build `assets/index-CRgzqGWS.js` (commit `ccf1713`). Nothing was deleted, edited by hand, approved, or sent. No password appears in this file.

| App | Where | Record | Account | Details / current state |
| --- | --- | --- | --- | --- |
| Warehouse Wizard | Daily Log → recent daily logs | `ZZTEST6 offline test` (Work completed and To do next time) | `jgregoire@vanislecoatings.com` | Etro - Hyatt, 1312 Broad Street (AKA Durwest), 2026-09-24, Waterproofing, Jon. Queued offline, replayed once on reconnect. |
| Warehouse Wizard | transactions / materials | `use` 1 Roll, Tremco BG Grip Tape 6"x75' (8 Roll), Jon | `jgregoire@vanislecoatings.com` | Stock moved 104 → 103 on the server (the stock trigger now runs as definer). Reverse with a manager `return`/exact-count if wanted. |
| Warehouse Wizard | task_completions | Cleanup supplies, daily, 2026-09-24, Jon | `jgregoire@vanislecoatings.com` | Ticked offline, synced. Untick from Tasks if wanted. |
| Warehouse Wizard / Crew+ | points_events | `daily_log_entry` +5, Jon, ref `dailylog:<uuid>` | `jgregoire@vanislecoatings.com` | Jon 530 → 535 pts. Ledger line "Daily log entry submitted". |
| Warehouse Wizard | materials | Backer Rod | `jrogers@vanislecoatings.com` | Import set cost $0.00 → $9.99/Roll (as the pass-4 prompt asked). The same import also wiped reorder point (3 → 0) and pack "Vendor: Cascade" because those columns were not in the sheet (bug, see report); a second corrective import restored `reorder 3 · $9.99/Roll · Vendor: Cascade`. Quantity stayed 0 throughout. Bin was empty before and after. |
| Warehouse Wizard | materials | `ZZTEST6 Import Probe` | — | Not created (skipped: "New material needs a Category column (row 3)"). Nothing to clean. |

CSV files used (exact text):

```
Item,Unit,Cost,On hand
Backer Rod,Roll,9.99,999
ZZTEST6 Import Probe,Unit,1.23,7
```

```
Item,Unit,Cost,Reorder,Pack
Backer Rod,Roll,9.99,3,Vendor: Cascade
```

Screenshots: `live-verification-screenshots/v6-ww-csv-import-report.png`, `v6-ww-tasks-3-pending-offline.png`, `v6-ww-after-offline-reload.png`, `v6-crew-wallet-535.png`.

Browser end state: signed out of Crew+; Warehouse Wizard origin holds Jon's session; network unblocked.
