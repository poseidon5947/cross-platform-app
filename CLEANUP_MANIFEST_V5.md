# Cleanup manifest — fix verification (marker `ZZTEST5`), 2026-09-24

Records created while verifying the offline-queue fixes against the live Supabase project from a local build (`localhost:5199`, since fixed code is not deployed). Nothing was deleted, edited, approved, or sent. No password appears in this file.

| App | Where | Record | Account | Details / current state |
| --- | --- | --- | --- | --- |
| Warehouse Wizard | Daily Log → Your recent daily logs | `ZZTEST5 offline test` (Work completed and To do next time) | `jgregoire@vanislecoatings.com` | Etro - Hyatt, 1312 Broad Street (AKA Durwest), 2026-09-24, Waterproofing, Jon. Written to the server by the offline queue replay, once. |
| Warehouse Wizard | transactions | `use` 1 Roll, Tremco BG Grip Tape 6"x75' (8 Roll), Jon, 2026-09-24 10:23 UTC | `jgregoire@vanislecoatings.com` | Row is on the server. Stock still reads 104 because the stock trigger runs under crew RLS (see migration `202609240001_stock_triggers_run_as_definer.sql`). Once that migration is applied, this row will NOT be re-applied; a manager stock-take is the way to reconcile. |
| Warehouse Wizard | points_events | none | — | The +5 `daily_log_entry` for the log above was refused by the deployed `award-points` (`Unsupported award kind`). After the updated function is deployed it may be awarded on the next replay from the localhost origin only (see below). |

Local-only leftovers on the verification browser profile (origin `http://localhost:5199`, not production):

- `warehouse-wizard-offline-queue-v1` holds one `daily_log` command for the ZZTEST5 log with `lastError: "Edge Function returned a non-2xx status code"`. Harmless unless that origin is opened again after `award-points` is deployed, in which case Jon receives +5 once.
- `warehouse-wizard-last-sync-v1` holds a snapshot of Jon's last synced app state (business data, no tokens).

Screenshot: `live-verification-screenshots/v5-ww-offline-fallback-after-reload.png` — reload with Supabase blocked, header `2 pending sync · Offline · showing last synced data`.
