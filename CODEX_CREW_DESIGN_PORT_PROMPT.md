# Codex Prompt — Crew+ design-system port (make it match the suite)

> Paste into Codex, working in `D:\project\Canada\cross platform\Crew+ Waterproofing Team Tool`.
> Single-focus, presentational pass. **Do not change any domain logic, the `award-points` Edge Function, the repo, the migration, or the seed** — those are reviewed and correct. This only makes Crew+ look like a sibling of the other two apps. Keep `npm run build` and `npm test` green (all 11 tests must still pass — no behavior changes).

## Why

Crew+ works but its `styles.css` is ~114 lines, so it doesn't read as part of the Van Isle suite. **SOP+ already did this exact port** (its `styles.css` is ~900 lines). Bring Crew+ to the same standard.

## What to do

1. **Port the shared design system** from the reference apps — copy the design tokens and component styles from
   `D:\project\Canada\cross platform\SOP+ Tool\src\styles.css` (which already mirrors `Waterproofing+ Warehouse Wizard\src\styles.css`) into Crew+'s `src/styles.css`. Reuse the **same class names** so components render identically across the suite: cards, chips, pills, buttons, bottom-sheets (with grip), bottom nav, KPI/stat tiles, forms/inputs, toasts, and the brand theme as default (Marine Teal `#14A2A4` / Carbon Black `#1C1E20` / Questrial). Include the responsive mobile-first + widened-desktop layout rules.

2. **Re-skin the existing Crew+ screens** in `src/App.tsx` (Home, Wallet, Rituals, Reviews, Bonus, Compliance, Feedback, Rewards, LoginScreen, Splash) to use those shared component classes. **Change presentation only** — keep every screen's existing behavior, props, state, handlers, and the data it renders. Do not rename or remove functions; do not touch what they compute (wallet balance, redemption, cap, bonus trajectory/dollar-gating, cert alerts all stay exactly as-is).

3. **Keep the reconcile warning banner** on the Rewards screen (the "$0.25/point … reconcile with the client" note) and the **implied-$** display — just style them with the shared toast/pill components.

4. Ensure the **brand theme is the default**, responsive down to phone and up to a widened desktop dashboard for the HR/admin views, matching Warehouse Wizard and SOP+.

## Constraints

- **No logic changes.** No edits to `src/domain/*`, `src/data/repo.ts`, `supabase/**`, or the seed. Purely `styles.css` + presentational JSX/className changes in `App.tsx` (and small presentational helper components if needed).
- **No new dependencies.** No CSS frameworks or chart libs — reuse the suite's plain-CSS/SVG approach.
- Do not regress the 11 tests; they should pass unchanged since nothing computational changes.
- `npm run build` and `npm test` green.

## Acceptance

Placed side by side with Warehouse Wizard and SOP+, Crew+ reads as the same product — same cards, chips, buttons, bottom nav, brand colors, and typography — with all existing behavior intact.
