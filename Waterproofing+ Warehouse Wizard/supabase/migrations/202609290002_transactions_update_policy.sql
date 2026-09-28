-- Resolving a needs-review item has never worked.
--
-- transactions has RLS enabled with an INSERT policy and a SELECT policy and
-- no UPDATE policy at all. Postgres then matches no rows for an update, and
-- PostgREST reports that as success - so the Resolve button has reported
-- "Item resolved" since it shipped on 2026-09-04 while writing nothing. The
-- evidence: 140 rows still flagged and zero rows ever resolved from raw text.
--
-- Same policy covers the new "Not a material" dismiss, which is also an update.
--
-- Deliberately is_manager() - admin and manager only, which is Jordan and
-- Jesse, matching the guide. Crew log materials; they do not reconcile them.
drop policy if exists "manager updates transactions" on transactions;
create policy "manager updates transactions" on transactions for update
  using (is_manager())
  with check (is_manager());
