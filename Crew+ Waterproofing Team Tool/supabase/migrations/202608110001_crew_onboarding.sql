create table crew_onboarding (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references profiles(id) on delete cascade,
  date_of_birth date not null,
  address text not null,
  city text not null,
  postal_code text not null,
  sin text not null,
  drivers_license_number text not null,
  allergies_medical text,
  hourly_wage numeric not null check (hourly_wage > 0),
  start_date date not null,
  vacation_pay_acknowledged boolean not null default false,
  direct_deposit_signed_name text not null,
  direct_deposit_signed_at timestamptz not null,
  hours_tracking_signed_name text not null,
  hours_tracking_signed_at timestamptz not null,
  direct_deposit_file_name text,
  drivers_license_front_file_name text,
  drivers_license_back_file_name text,
  emergency_contact_name text not null,
  emergency_contact_relationship text,
  emergency_contact_phone text not null,
  emergency_contact_email text,
  completed_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Sensitive: SIN, driver's license number, and uploaded document references.
-- Deliberately NOT part of the shared `profiles` table (which is readable by
-- every authenticated user across all three apps) — visibility here is
-- restricted to the submitting employee themselves and admin/HR only, per
-- client instruction ("New employee details are admin/HR only").
alter table crew_onboarding enable row level security;

create policy "onboarding self insert" on crew_onboarding for insert with check (user_id = auth.uid());
create policy "onboarding self or admin readable" on crew_onboarding for select using (user_id = auth.uid() or is_admin());
