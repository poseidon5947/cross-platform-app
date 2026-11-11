-- Step C of three. Removes the HR columns from profiles, which is the step
-- that actually ends the exposure - until this runs, every signed-in user can
-- still read them.
--
-- RUN THIS ONLY AFTER the Crew+ deploy that reads profile_private is live and
-- verified. The bundle before it writes these columns on every profile save;
-- drop them underneath it and those saves start failing.
--
-- The guard trigger from 202611120001 is replaced first, in the same
-- transaction. It assigns new.pay_band := old.pay_band and the like, so the
-- moment those columns disappear the function raises on every update to
-- profiles - which would take out profile saves across all three apps. The
-- replacement guards only what is left. The columns that moved are protected
-- by profile_private's own admin-only policy instead, which is stronger: there
-- the crew cannot even read them.

begin;

create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Unchanged from 202611120001: the service role reaches this table without a
  -- session (award-points, seeds) and admins edit crew records from the Crew+
  -- admin tab, which writes the whole row back. Both must pass through.
  if auth.uid() is null then
    return new;
  end if;

  if is_admin() then
    return new;
  end if;

  new.role              := old.role;
  new.org_role          := old.org_role;
  new.points            := old.points;
  new.employment_status := old.employment_status;
  new.hire_date         := old.hire_date;
  new.employee_id       := old.employee_id;
  new.manager_id        := old.manager_id;
  new.reports_to        := old.reports_to;

  return new;
end;
$$;

alter table public.profiles
  drop column if exists bonus_role_weight,
  drop column if exists under_notice,
  drop column if exists disciplinary_action_at,
  drop column if exists termination_reason,
  drop column if exists next_quarterly_review_date,
  drop column if exists review_eligibility,
  drop column if exists probation_end_date,
  drop column if exists vacation_days_annual,
  drop column if exists employment_type,
  drop column if exists agreement_signed_date,
  drop column if exists new_hire_until,
  drop column if exists access_upgraded_at,
  -- Never populated, never read by the Profile type; pay lives in
  -- crew_compensation, which is already admin-only.
  drop column if exists gross_annual_wages,
  drop column if exists pay_band;

commit;
