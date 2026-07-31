# Codex Prompt — Apply confirmed client decisions (points, rewards, reviews, export)

> Cross-app change. Primary: `Crew+ Waterproofing Team Tool`; also touches `Waterproofing+ Warehouse Wizard` and the canonical `award-points` function (kept byte-identical across all three apps). Keep every app's `npm run build` and `npm test` green — **some point-value tests must be updated to the new numbers** (see each item). These are confirmed client decisions from the returned intake doc.

---

## 1. Point-value changes (cross-app — the canonical `award-points` function is the source of truth)

Update the point amounts. The server-side `award-points` function decides points, so change them **there** (and in any client-side domain logic + seed rules + tests that assert the old values). Keep all three copies of `award-points` byte-identical.

| Action | Old | **New** | Where |
|---|---|---|---|
| Perfect truck-task day (`daily_100`) | 50 | **25** | canonical `award-points` `awardDaily100`; Warehouse Wizard `evaluateDailyPoints`; WW tests asserting `[50, 25]` → `[25, 25]` |
| 5-day streak (`streak_bonus`) | 25 | **25 (unchanged)** | — |
| Approved SOP (`sop_completed`) | 20 | **20 (unchanged)** | — |
| 5★ Google review naming crew | 200 | **200 (unchanged)** | Crew+ earning rule |
| Daily / weekly / monthly **rituals** | 30/40/60 | **5 each** | Crew+ `crew_earning_rule` seed |
| Safety milestone | 150 | **5** | Crew+ rule |
| Peer recognition received | 20 | **5** | Crew+ rule |

- **"…etc. +5" ambiguity:** the client wrote "Daily/weekly/monthly rituals, safety milestones, peer recognition, etc. +5." Apply **+5** to those named small-tier rules. For the other earning rules **not** explicitly listed (feedback submitted, KPI target hit, review completed on time, certs current), default them to **+5** as well but leave a clear `// TODO confirm with client` comment — flag these in the README so we can verify (KPI/review at +5 may be intentionally low, or the client may want them higher).
- Update the Crew+ points-earning table UI + seed to show the new values.
- **Weekly habit cap:** the cap was ~300/week when rituals were 30–60. With rituals now +5, note in the README that the cap is now effectively non-binding; leave the value as-is unless it's trivial to lower (do **not** guess a new cap — flag for confirmation).
- WW's points/streak/reversal tests should still pass with the same structure — only the asserted **numbers** change (50→25). Do not change the reversal logic.

## 2. Point anchor → $0.25/point (reverse the $0.05) + re-price rewards

- Set the point-to-dollar anchor to **$0.25/point** (the client confirmed; this reverses last round's $0.05).
- **Remove the $0.25-vs-$0.05 conflict warning banner** — it's resolved. Keep the implied-$ display next to each reward, now computed at $0.25/point.
- **Re-price the rewards catalog upward** for $0.25/point so dollar values are sensible (a $50 reward ≈ 200 points, $100 ≈ 400 points, etc.).

## 3. Rewards catalog & redemption rules

- **Catalog is limited to three reward types: Cash, Gift Card, PTO.** Remove the other sample rewards (team lunch, hoodie, early-Friday, boots, etc.); keep only Cash / Gift Card / PTO entries (a few denominations each, priced at $0.25/point).
- **Quarterly redemption windows:** redemptions can be requested/approved at quarter-end — **Oct 31, Jan 31, Apr 30, Jul 31**. Outside those windows, redemption is closed but points keep accumulating.
- **Points roll over / accumulate** — unused points are never lost or reset at the window; the wallet balance carries forward. (If there's a quarterly leaderboard reset, the *leaderboard* may reset but the *wallet balance* must persist.)

## 4. Google reviews

- The client confirmed the per-person **Google review QR / link** flow. Wire it with their real Google review URL:
  `https://www.google.com/maps/place//data=!4m3!3m2!1s0x548f6b3774eb6afd:0xbd3374f825d460ba!12e1?source=g.page.m._&laa=merchant-review-solicitation`
  Store this as a configurable setting; render a per-person QR code (or shareable link) crew can show customers.
- Keep the **+200 for a 5★ review naming a crew member**, granted by manager confirmation (manual attribution) through the canonical award function — already the model; just confirm it's wired to this URL/config.

## 5. One-time manual award (+200 each) — recent reviews

Grant **+200 points each** to three crew members for reviews already received, as a one-time seeded/manual award through the canonical `award-points` path (type `crew_google_review`, idempotent so re-running doesn't double-award):
- **Jesse** (Jesse Dares)
- **Jon** (Jonathan Gregoire)
- **Jordan** — ⚠️ **AMBIGUOUS: the roster has two Jordans — Jordan Rogers (admin) and Jordan Thorpe (crew).** Do **not** guess. Wire the award but leave the target Jordan as a clearly-marked `TODO_CONFIRM` (default to **Jordan Thorpe**, the field-crew member, since these are jobsite customer reviews) and flag it in the README for confirmation.

Implement as an idempotent seed/admin action (unique `ref` per person, e.g. `google_seed:{userId}:2026-07`) so it's applied exactly once.

## 6. Warehouse Wizard — monthly Daily Inventory Log export (for accounting)

The client's #1 reason for the app is the daily materials/inventory usage log, and they need to **export a clear usage list of the DAILY INVENTORY LOG at each month-end for their accounting team**.

- Add a **month-scoped export** (CSV / spreadsheet-friendly) of the daily inventory usage log: one row per logged usage with **date, material, quantity, unit, action (used/delivered/loss/return), job/site, service, crew member, unit cost, value**, filtered to a selectable month, ordered by date.
- WW already has a transactions CSV and cost report — this should be a **dedicated "Monthly Inventory Log" export** (clearly labeled, month picker, accounting-ready columns), not just the existing generic CSV. Put it in the Admin/Reports area (admin/manager only).

## Constraints & acceptance

- Keep all three `award-points` copies **byte-identical**; SHA-256 should match across WW / SOP+ / Crew+ after the point-value edits.
- All apps build; tests green — with the point-value assertions updated to the new numbers (50→25 in WW; ritual/safety/peer → 5 in Crew+). Add/adjust tests for: the new perfect-day value, the $0.25 anchor pricing, quarterly redemption windows, and the monthly inventory export.
- **Do not** touch: SOP+20 logic, the reversal logic, the idempotency/authorization model, or RLS — only values, catalog, config, and the new export.
- **READMEs:** record the new point table, the $0.25 anchor, the quarterly redemption windows + roll-over, the Google review URL config, and the two flagged confirmations (the "etc. +5" rules and which Jordan).

## Suggested order
1. Point-value changes in canonical function + WW domain + Crew+ rules + update tests.
2. $0.25 anchor + re-priced Cash/GiftCard/PTO catalog + remove conflict banner.
3. Quarterly redemption windows + roll-over.
4. Google review URL/QR config + one-time +200 seed (with the Jordan TODO).
5. Warehouse Wizard monthly inventory-log export.
6. READMEs + flags.

Proceed with these defaults; leave the two flagged ambiguities (the non-named +5 rules, and which Jordan) as clearly-marked TODOs rather than guessing.
