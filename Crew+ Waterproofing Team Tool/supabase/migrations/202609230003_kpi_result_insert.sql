-- crew_kpi_result had select and update policies but no insert, and the client
-- sync treated it as update-only, so a result row could never be created. The
-- table is empty in production, which means "Mark hit" on the Reviews tab awarded
-- the points and then flipped no status at all - there was no row to flip, and no
-- way to make one.
--
-- Matches the existing update policy: your own row, or a manager's.
-- Written idempotently so re-running is safe.

drop policy if exists "kpi results self or manager insert" on crew_kpi_result;
create policy "kpi results self or manager insert" on crew_kpi_result for insert with check (
  user_id = auth.uid() or is_manager()
);
