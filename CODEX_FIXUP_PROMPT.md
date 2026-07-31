# Codex Fix-Up Prompt — Warehouse Wizard, Phase 2 patch

> Paste into Codex, working in the existing project:
> `D:\project\Canada\cross platform\Waterproofing+ Warehouse Wizard`
> Small, targeted patch. Do not refactor unrelated code. Keep `npm run build` and `npm test` green, and add tests where noted.

Phase 2 is in good shape. A code review found one deploy-blocking bug and two smaller gaps. Fix all three.

---

## 1. BLOCKER — `materials.name` upserts have no matching unique constraint

Three code paths upsert materials with `onConflict: "name"`:
- `src/data/repo.ts` → `upsertMaterial` (~line 168)
- `src/data/repo.ts` → `upsertMaterialsMetadata` (~line 173)
- `supabase/functions/materials-import/index.ts` (~line 98)

But the `materials` table defines `name text not null` **without `unique`**. Against real Postgres every one of these throws:
`there is no unique or exclusion constraint matching the ON CONFLICT specification`.
This breaks the CSV importer and material-edit save the moment the app runs against Supabase. Build/tests don't catch it because there's no live DB in CI.

**Fix:** decide the upsert key and make the schema and all three call sites agree.

- **Preferred:** add a unique constraint on `materials.name` in the initial migration:
  `name text not null unique` (or `create unique index materials_name_key on materials(name);`). Keep `onConflict: "name"` everywhere.
- **If** you'd rather key on a stable SKU/external id (safer than a display name that can be edited), add a `sku text unique` column, map it from the workbook's SKU/item column in the importer and `materialToRow`, and switch all three `onConflict` targets to `"sku"`. Only do this if the workbook actually has a stable SKU column — otherwise use name.

Since this edits the committed initial migration, note in the README that anyone who already applied it must re-run / reset the DB (or ship a follow-up `ALTER TABLE materials ADD CONSTRAINT ... UNIQUE (name);` migration). Add a test or a comment documenting the chosen upsert key.

---

## 2. Offline task completions are never queued (so they never sync)

In `src/App.tsx`, `toggleTask` calls `upsertCompletion(...)` directly with no `navigator.onLine` guard and, on failure, only toasts "Task saved locally; sync will retry" — but nothing is enqueued, so it never retries. Meanwhile the `complete_task` `OfflineCommand` type and `replayCommand`'s `complete_task` branch already exist and are unused.

**Fix:** make task completion follow the same offline pattern as `submitTransactions` / `saveTruck`:
- When `remoteMode && !navigator.onLine` (or when the remote call rejects), push a `complete_task` command (`{ id, type: "complete_task", userId, taskId, periodKey, queuedAt }`) onto `offlineQueue` instead of dropping it.
- The existing reconnect `flush` effect already maps `completeTask: replayCommand`, so drained completions will replay. Just confirm the wiring end to end.
- Only enqueue on completion (not un-completion), consistent with the current online path that syncs only when `!existing`. If you also want un-completion to sync, handle it explicitly — otherwise leave a short comment noting completions-only sync is intentional.
- Add a test (or extend the offline-queue test) covering: toggle while offline → command enqueued → drain on reconnect → queue cleared.

---

## 3. Drop the `unique` on `profiles.name`

The Phase-2 migration made `profiles.name` `unique`. Two crew members can legitimately share a display name, so this will reject valid users. Change it back to `name text not null` (keep `email ... unique`). No other change needed.

---

## Constraints
- Keep changes minimal and localized; don't restyle or re-architect.
- `npm run build` and `npm test` stay green; add the tests noted in §1 and §2.
- Update the README only where the schema change requires a re-seed/reset note.
- Do not touch the QuickBooks OAuth or `adjust`-delta logic — both were reviewed and are correct.
