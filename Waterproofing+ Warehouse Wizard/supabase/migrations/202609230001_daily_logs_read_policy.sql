-- Production has 67 daily_logs rows, RLS enabled, and no SELECT policy: an
-- authenticated admin read returns zero rows with no error, so the Daily Log
-- history and the Reports > Daily Log tab both looked empty. crew_point_pool,
-- created by the same migration with an identical policy, reads fine - so the
-- select policy below never landed. 202609040001 used bare `create policy`,
-- which aborts the whole script on a re-run, and that is the likely cause.
--
-- Written idempotently so re-running is safe.
drop policy if exists "daily logs readable by team" on daily_logs;
create policy "daily logs readable by team" on daily_logs for select using (
  auth.uid() is not null
);

drop policy if exists "daily logs self insert" on daily_logs;
create policy "daily logs self insert" on daily_logs for insert with check (
  submitted_by_user_id = auth.uid()
);
