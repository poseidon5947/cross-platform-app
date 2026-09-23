# Cleanup manifest — live verification pass 2

Records created or changed on 23 Sep 2026. Nothing was deleted.

| app | where it appears | identifying text | created as | how to find it |
|---|---|---|---|---|
| Warehouse Wizard | Tasks → Trucks → Maintenance requests, and Home "Open maintenance requests" | `ZZTEST maintenance request from live verification` | crew (`Jon`) | Ford F150 XL SuperCab 4WD (2011) - LY1180. Requested by Jon, date shown 2026-09-22. Status open. |
| Warehouse Wizard | Tasks → Trucks, Gas Station Check, Start of Day | `Hammer drill batteries charged` | crew (`Jon`), no free-text field on this control | Ford F150 XL SuperCab 4WD (2011) - LY1180. The checkbox is checked. Home shows 1/14 daily tasks complete and 13 truck tasks remaining. Undo by clearing that one checkbox. `Mark all shown done` was not used. |
| Warehouse Wizard | Home → Recent activity, and Reports → Inventory Log for 2026-09 | `use 1 Unit Screws` | crew (`Jon`), side effect of the daily log submit | Jon · Etro - Hyatt, 1312 Broad Street (AKA Durwest) · 2026-09-23. The matching daily log row with `ZZTEST daily log work completed` / `ZZTEST to do next time` does **not** appear in Daily Log history for crew or admin, and Reports → Daily Log still lists 67 rows. |
| Crew+ | — | — | nothing | Time off, incident, policy acknowledgment, recognition, and form submission were not submitted. Signed-in Crew+ goes blank. |
| Crew+ | — | — | nothing | Certificate photo was not uploaded. |

No points award, cash-out, role change, wage change, onboarding document, or incident photo was submitted. Recognition was not sent. QuickBooks Connect and Sync jobs were not clicked.
