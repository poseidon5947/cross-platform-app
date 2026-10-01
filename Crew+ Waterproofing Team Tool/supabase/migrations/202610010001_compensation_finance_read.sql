-- Let the finance roles read wage records.
--
-- The client asked for a Finance login that can see inventory, reports, costs
-- and wages. The first three come with the cfo app role. Wages did not: the
-- read policy on crew_compensation was "your own row, or you are an admin", so
-- even the actual CFO (app role 'cfo', not 'admin') saw only their own pay.
--
-- Editing stays with admin - the client asked for visibility, not control, and
-- payroll is not somewhere to widen write access by accident.

create or replace function public.is_finance()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select app_current_role() in ('admin', 'cfo')
$$;

drop policy if exists "compensation self or admin readable" on public.crew_compensation;

create policy "compensation self admin or finance readable"
  on public.crew_compensation
  for select
  using (user_id = auth.uid() or is_finance());
