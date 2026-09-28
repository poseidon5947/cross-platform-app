# Cleanup manifest — pass 4

These rows were created or attempted on 2026-09-24. Nothing was deleted. Earlier `ZZTEST` and `ZZTEST3` records were left as they were.

| app | where it appears | identifying text | created as | how to find it |
|---|---|---|---|---|
| Warehouse Wizard | Daily Log → Your recent daily logs | `ZZTEST4 offline test` | crew (`Jon`) | Two rows. Both are Etro - Hyatt, 1312 Broad Street (AKA Durwest), 2026-09-24, Waterproofing, Jon. The matching inventory use did not stick. |
| Warehouse Wizard | Inventory → Tremco | Tremco BG Grip Tape 6"x75' (8 Roll) | crew (`Jon`), quantity was not changed | Stock before the offline attempt was 104 Roll. After reload and after reconnect it was still 104 Roll. No cleanup of quantity is required for this pass. |
| Warehouse Wizard | Tasks → Trucks → Start of Day | Cleanup supplies | not left ticked | The box was ticked offline and was empty again after reload. Home still showed 0/14 daily tasks complete and 14 truck tasks remaining. Do not clear a box for this pass. |
| Warehouse Wizard | Inventory → Materials, Backer Rod | Backer Rod | not changed by the import | Before and after the CSV: 0 on hand, `$0.00/Roll`, vendor Cascade. The file asked for cost 9.99 and on hand 999. The importer reported "0 imported; 2 skipped". Quantity stayed 0. |
| Warehouse Wizard | Inventory → Materials, Injection Resin | Injection Resin | not in the CSV | Recorded before import only: 0 on hand, `$0.00/Drum`, vendor Cascade. The import did not include this row. |
| Warehouse Wizard | Inventory search `ZZTEST4` | ZZTEST4 Import Probe | not created | The CSV row was Unit, cost 1.23, on hand 7. Search after import found no material with that name. |
| Crew+ | Feedback → Recognition feed | `ZZTEST4 peer recognition` | crew (`Jon`) to Bobby | From Jon, 2026-09-24. Bobby's company-leaderboard balance moved 110 → 120 and was still 120 after reload. Jon stayed 530. |
| Crew+ | Reviews → KPIs, manager Jesse (Crew Lead) | Safety incidents | `jdares@vanislecoatings.com` | The row reads Hit. Callback / rework rate and Crew jobs on schedule were left as Mark hit. Logging accuracy was already Hit from pass 3 and was not clicked. Jesse's header on Bonus read 295 pts. |

The CSV file used was exactly:

```
Item,Unit,Cost,On hand
Backer Rod,Unit,9.99,999
ZZTEST4 Import Probe,Unit,1.23,7
```

No reward was confirmed, no cash-out was requested, no wage was typed or saved, and QuickBooks Connect and Sync jobs were not clicked.
