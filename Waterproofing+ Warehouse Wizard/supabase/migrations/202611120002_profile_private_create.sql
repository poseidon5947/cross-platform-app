-- Step A of three. Creates the admin-only home for the HR fields and copies
-- the data in. Nothing is removed here and no application breaks: the columns
-- stay on profiles until step C, so the bundle running right now is unaffected.
--
-- Why: "authenticated read profiles" is `using (true)`, so every signed-in user
-- reads every column of every profile. RLS is row-level, so no policy can hide
-- a column - the fields have to live somewhere else. Today that exposes
-- colleagues' hire dates and employment status; it would expose pay, discipline
-- and termination reasons the moment HR fills them in, which is the reason to
-- move them before the data arrives rather than after.
--
-- What stays on profiles, deliberately:
--   employment_status  - the Wizard filters its crew pickers on it
--                        (user.status !== "Inactive"), so it must stay readable
--   phone, address, email, emergency_contact_*
--                      - the crew member edits these themselves on Crew+
--                        "My details"; moving them would break that screen
--   birthday, employee_id, hire_date, manager_id, reports_to
--                      - team directory, visible to colleagues by choice
--
-- gross_annual_wages and pay_band are NOT copied. They are null on all 21 rows
-- and the Profile type does not read them - pay belongs to crew_compensation,
-- which already has its own admin-only policy. Step C drops them.
--
-- Order of operations: run this, then the Crew+ deploy that reads this table,
-- then 202611120003_profile_private_drop.sql. Running the drop early strands
-- the deployed bundle on columns that no longer exist.

create table if not exists public.profile_private (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  bonus_role_weight numeric,
  under_notice boolean not null default false,
  disciplinary_action_at timestamptz,
  termination_reason text,
  next_quarterly_review_date date,
  review_eligibility text,
  probation_end_date date,
  vacation_days_annual numeric,
  employment_type text,
  agreement_signed_date date,
  new_hire_until date,
  access_upgraded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profile_private enable row level security;

-- Admins manage every row. Everyone else sees their own and nobody else's -
-- a person reading their own probation date or vacation entitlement is normal,
-- and Crew+ shows both on the crew member's own tabs.
drop policy if exists "admin manages profile_private" on public.profile_private;
create policy "admin manages profile_private" on public.profile_private
  for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists "read own profile_private" on public.profile_private;
create policy "read own profile_private" on public.profile_private
  for select to authenticated
  using (user_id = auth.uid());

-- Seed one row per profile, carrying today's values across. Re-runnable: on
-- conflict it leaves existing rows alone rather than overwriting edits made
-- between this running and step C.
insert into public.profile_private (
  user_id, bonus_role_weight, under_notice, disciplinary_action_at, termination_reason,
  next_quarterly_review_date, review_eligibility, probation_end_date, vacation_days_annual,
  employment_type, agreement_signed_date, new_hire_until, access_upgraded_at
)
select
  p.id, p.bonus_role_weight, coalesce(p.under_notice, false), p.disciplinary_action_at, p.termination_reason,
  p.next_quarterly_review_date, p.review_eligibility, p.probation_end_date, p.vacation_days_annual,
  p.employment_type, p.agreement_signed_date, p.new_hire_until, p.access_upgraded_at
from public.profiles p
on conflict (user_id) do nothing;

-- A new hire needs their private row to exist, or the admin screen has nothing
-- to write to.
create or replace function public.create_profile_private()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profile_private (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_profile_private on public.profiles;

create trigger create_profile_private
  after insert on public.profiles
  for each row
  execute function public.create_profile_private();
