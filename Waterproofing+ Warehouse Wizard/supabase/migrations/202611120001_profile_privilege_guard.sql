-- A crew member could make themselves an admin.
--
-- Found on 2026-11-11 by signing in to the live tool as a throwaway crew
-- account and calling the REST API the way any crew member can from their own
-- browser console - the anon key ships in the bundle and their JWT is in
-- localStorage:
--
--   PATCH /rest/v1/profiles?id=eq.<their own id>   {"role":"admin"}
--
-- It succeeded. The same token then went from reading nothing to reading
-- everyone's performance reviews (11), certifications (17), incident reports,
-- time off, form submissions, and the entire cost catalogue (168 rows) - the
-- prices Tara specifically asked be kept away from the crew.
--
-- The live policy that allows this is not in this repo. The migrations here
-- grant profiles only "authenticated read profiles" (select) and "admin
-- manages profiles" (all, is_admin()); neither permits a crew self-update, yet
-- the update went through and an update to someone else's row did not. So a
-- self-update policy was added to the database directly at some point. Rather
-- than guess at its name and replace it, this guards the columns themselves,
-- which holds whatever that policy turns out to say.
--
-- Self-service still works: a crew member can still edit their own phone,
-- address and emergency contact. They just cannot grant themselves a role or
-- rewrite their own HR record.

create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() is null for the service role, which is how the award-points
  -- edge function and the seed scripts reach this table. Guarding those would
  -- silently freeze points and break the awards, so they pass through; they
  -- never carry a crew member's session.
  if auth.uid() is null then
    return new;
  end if;

  -- is_admin() reads profiles.role for auth.uid() through a security-definer
  -- function, so it is evaluated against the row as it stands before this
  -- update - an escalation attempt cannot authorise itself. Admins editing
  -- crew records from the Crew+ admin tab are unaffected, which matters
  -- because that screen writes the whole profile row back.
  if is_admin() then
    return new;
  end if;

  new.role                   := old.role;
  new.org_role               := old.org_role;
  new.pay_band               := old.pay_band;
  new.bonus_role_weight      := old.bonus_role_weight;
  new.gross_annual_wages     := old.gross_annual_wages;
  new.points                 := old.points;
  new.employment_status      := old.employment_status;
  new.employment_type        := old.employment_type;
  new.under_notice           := old.under_notice;
  new.disciplinary_action_at := old.disciplinary_action_at;
  new.termination_reason     := old.termination_reason;
  new.review_eligibility     := old.review_eligibility;
  new.next_quarterly_review_date := old.next_quarterly_review_date;
  new.probation_end_date     := old.probation_end_date;
  new.vacation_days_annual   := old.vacation_days_annual;
  new.hire_date              := old.hire_date;
  new.employee_id            := old.employee_id;
  new.manager_id             := old.manager_id;
  new.reports_to             := old.reports_to;
  new.access_upgraded_at     := old.access_upgraded_at;
  new.new_hire_until         := old.new_hire_until;

  return new;
end;
$$;

drop trigger if exists guard_profile_privileges on public.profiles;

create trigger guard_profile_privileges
  before update on public.profiles
  for each row
  execute function public.guard_profile_privileges();
