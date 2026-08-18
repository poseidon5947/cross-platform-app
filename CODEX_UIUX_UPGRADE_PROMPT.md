# Codex Prompt — UI/UX upgrade pass: dark mode, feedback, home redesign, cross-app nav, code-splitting

> Cross-app change. Touches all three apps independently: `Crew+ Waterproofing Team Tool`, `Waterproofing+ Warehouse Wizard`, `SOP+ Tool`. Each app is a fully separate codebase (own `package.json`, `src/App.tsx`, `src/styles.css`) sharing one Supabase backend — there is no shared component package, so every pattern below gets implemented **independently in each of the three repos**, matching that app's existing conventions. Keep `npm run build` and `npm test` green in all three. Do not touch the canonical `supabase/functions/award-points/index.ts` (must remain byte-identical across all three apps — verify with `diff`/SHA-256 if anything nearby is touched).

## 0. Inspect before building

Each app's `Home`/landing component, `styles.css` token set, and tab list differ. Before writing code in a given app, read its current `App.tsx` and `styles.css` in full and mirror its existing naming/structure (e.g. Crew+ uses `.panel.card`, `--surface`/`--ink`/`--line` CSS vars, a `Tab` union type, and a `rail`/`main`/`mobile-nav` shell — Warehouse Wizard and SOP+ may differ in details even though the shape is similar). Don't assume Crew+'s exact class names apply verbatim to the other two; confirm first.

## 1. Dark mode (all three apps)

- Audit `src/styles.css` in each app for any hardcoded colors that bypass the existing CSS custom properties (`--surface`, `--ink`, `--ink-2`, `--line`, `--accent`, etc.) — tokenize anything hardcoded first, since dark mode only works if every color is a var.
- Add a dark palette under `@media (prefers-color-scheme: dark)`, redefining only the tokens (never restyling components directly inside the media query).
- Add an explicit override block keyed on `:root[data-theme="dark"]` / `:root[data-theme="light"]` so a manual toggle can win over the OS setting in both directions — same pattern as: system default (unstamped) → media query; explicit user choice → `data-theme` attribute beats it.
- Add a small toggle (sun/moon icon or three-way Auto/Light/Dark) in the `rail-foot`/settings area of each app. Persist the choice to `localStorage` (e.g. `theme-preference`) and set `document.documentElement.dataset.theme` on load and on change.
- Test: confirm every existing screen (not just Home) reads correctly in dark mode — cards, tables, pills, toasts, form inputs, disabled button states.

## 2. Toast/confirmation feedback on real actions (all three apps)

Each app already has a `.toast` / `.toast.warn` / `.toast.good` CSS pattern used for persistent banners (e.g. Crew+'s bonus-window notices). Reuse that visual language for a **new, separate, auto-dismissing** toast used for action confirmations — don't repurpose the persistent-banner slots for this.

- Build one small `useToast()` hook + `<ToastHost />` per app (`src/components/Toast.tsx` or similar): a stack of transient messages, each auto-dismissing after ~3s, dismissible early on click, respecting `prefers-reduced-motion` for the enter/exit animation.
- Mount `<ToastHost />` once near the root of each app's shell.
- Wire a success toast into every state-mutating action that currently just silently closes a form or updates data with no feedback — audit each app for these; in Crew+ that includes (non-exhaustive, confirm the full list by reading `App.tsx`): submitting the quarterly self-assessment, completing a quarterly review, submitting onboarding, submitting an incident report, confirming incident receipt, approving a redemption, submitting a maintenance request (Warehouse Wizard), resolving a maintenance request (Warehouse Wizard), acknowledging a policy, submitting the quarterly SWOT.
- Failure paths (the existing `remote.error` chip pattern) should also route through the same toast host where it makes sense, rather than only a static header chip.

## 3. Branded loading screen (all three apps)

Replace the current bare-text loading state (e.g. Crew+'s `<Splash text="Loading Crew+ from Supabase..." />`, which is plain centered text) with:
- The app's existing brand mark (the `.drop.logo` treatment already used in `LoginScreen`/`Splash`), reused rather than duplicated.
- A subtle loading indicator — a CSS pulse or spinner on the mark itself, not a generic spinner graphic — wrapped in `@media (prefers-reduced-motion: reduce)` so it degrades to a static mark.
- Keep the underlying loading logic (`query.isFetching`, session checks) untouched; this is a presentation-only change to the existing `Splash` component.

## 4. Home screen: surface what needs attention first

Each app's Home/landing tab currently shows a flat grid of cards (points, leaderboard, KPIs, etc. all at once) with no prioritization. Add a new top section — an "attention" strip — above the existing grid, built from data the app **already computes elsewhere** (do not invent new domain logic; find and reuse the existing functions):

- **Crew+**: pending quarterly self-assessment due (own), pending quarterly reviews to complete (if `canRunReviews`), new-hire access reviews due (`newHireReviewsDue`, admin only), compliance flags (`certAlerts`/`certAlertLevelFromType`), pending reward redemptions (if `canApproveRedemptions`).
- **Warehouse Wizard**: open maintenance requests (all, or "assigned to you to resolve" if Crew Lead/Owner), incomplete truck tasks for today, any low-stock/reorder-threshold inventory items if that signal already exists in `domain/business.ts`.
- **SOP+**: SOPs not yet acknowledged/completed that are relevant to the signed-in user's role, any recently updated SOPs the user hasn't re-acknowledged.

Render each as a compact row (icon/label + count + link to the relevant tab), not a wall of detail — this is a triage surface, not a duplicate of the destination tab. Hide the whole strip if there's nothing pending (empty state: don't show an empty "0 items" strip).

## 5. Consistent suite-aware navigation (all three apps)

Add a small "Van Isle Suite" switcher to the top of each app's rail/header — three links (Crew+, Warehouse Wizard, SOP+), the current app visually marked active/disabled, the other two as real `<a>` links to their deployed URLs. Read the other two URLs from a `VITE_CREW_URL` / `VITE_WAREHOUSE_URL` / `VITE_SOP_URL` env var set per app (add to each `.env`/`.env.example` and to the GitHub Actions build step alongside the existing `VITE_SUPABASE_URL` secrets) rather than hardcoding URLs in source — they'll change if the client moves to a custom domain later. Each app shows all three links unconditionally (there's no cross-app directory of who has access to what, so don't try to gate this — everyone at the company plausibly needs all three).

## 6. Code-splitting to cut initial bundle size

Every app currently ships one JS bundle around 500–590KB (flagged by Vite's own build warning). Convert the tab-body components (everything rendered by the `{activeTab === "x" && <Y />}` switch in each app's root component) to `React.lazy` + a shared `<Suspense fallback={...}>` boundary, so only the active tab's code loads on demand instead of the whole app up front.
- Keep the shell (nav, Home, login/splash) in the main bundle — only split the less-frequently-opened tabs.
- Use a small inline fallback (a lightweight skeleton matching the `panel card` shape, not a full-page spinner) so switching tabs doesn't flash a jarring loading state.
- After the change, run `npm run build` in each app and confirm the main chunk shrinks and additional per-tab chunks appear in `dist/assets/`.

## Acceptance

- All three apps: `npm run build` and `npm test` pass, no regressions in existing tests.
- Dark mode: toggle works, persists across reload, and every existing screen (not just Home) is legible in both themes — spot-check tables, disabled buttons, and toast/pill colors specifically.
- Toasts appear on the action list in §2 without duplicating or breaking the existing persistent-banner (`toast warn`/`toast good`) usages already in the code.
- Loading screens show the brand mark, not bare text, and respect `prefers-reduced-motion`.
- Home screens show a real, data-driven attention strip per app (confirm by seeding/using real pending data, not a hardcoded example) and correctly hide themselves when nothing is pending.
- Suite nav links point at env-configured URLs, not hardcoded strings; the current app is visually distinguished from the other two links.
- `npm run build` output shows the main JS chunk reduced and separate per-tab chunks present in all three apps.
- `award-points/index.ts` is unchanged and still byte-identical across all three apps.
