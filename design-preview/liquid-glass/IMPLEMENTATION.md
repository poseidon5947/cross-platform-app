# Liquid glass implementation

The approved concept is applied through `src/liquid-glass.css`, imported after the existing stylesheet in each app. App-local copies keep the three Vite projects independently deployable. When editing the skin, update all three copies and run `python3 scripts/check-glass-style.py` from the repository root.

The skin covers app chrome, navigation, cards, metrics, controls, forms, tables, graph dialogs and sheets. Existing navigation, permissions, data handling, and workflow components remain in place. Warehouse appearance settings retain their semantic colors. Light, dark, and system themes are supported, with reduced-motion and no-backdrop-filter fallbacks.

The original HTML concept uses illustrative data. Screenshots in `applied/` show the actual applications using their local demo data, with Supabase disabled for browser verification. No backend changes or deployment were made.

Validation: production builds for all three apps; desktop (1440px) and mobile (390px) navigation checks; explicit dark theme switching and graph dialog checks. Browser verification uses admin demo navigation; it does not replace authenticated role-specific acceptance testing.
